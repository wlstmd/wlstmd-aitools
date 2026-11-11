"use client";

import { useEffect, useRef, useState } from "react";
import VoiceButton, { type VoicePhase } from "@/components/VoiceButton";
import { addMemo, findRelevantMemos, loadMemos } from "@/lib/memos";
import { cached } from "@/lib/cache";

type Exchange = { question: string; answer: string; usedMemo: boolean };
type ScheduleEvent = { title: string; date: string | null; detail?: string };
type TodoItem = { text: string; checked: boolean };
type HistoryTurn = { role: "user" | "assistant"; content: string };

const MAX_HISTORY_TURNS = 10;
const CONTEXT_TTL_MS = 30_000;

async function fetchScheduleEvents(): Promise<{ events: ScheduleEvent[]; failed: boolean }> {
  return cached("schedule-events", CONTEXT_TTL_MS, async () => {
    try {
      const res = await fetch("/api/notion/calendar");
      if (!res.ok) return { events: [], failed: true };
      const data = await res.json();
      return { events: Array.isArray(data?.events) ? data.events : [], failed: false };
    } catch {
      return { events: [], failed: true };
    }
  });
}

async function fetchTodoItems(): Promise<TodoItem[]> {
  return cached("todo-items", CONTEXT_TTL_MS, async () => {
    try {
      const res = await fetch("/api/notion/todos");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.todos) ? data.todos : [];
    } catch {
      return [];
    }
  });
}

type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { isFinal: boolean; length: number; [j: number]: SpeechRecognitionAlternative };
type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResult };
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const Impl = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Impl) return null;
  const recognition = new Impl();
  recognition.lang = "ko-KR";
  recognition.interimResults = true;
  recognition.continuous = true;
  return recognition;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "마이크 권한을 허용해주세요",
  "audio-capture": "마이크를 찾을 수 없어요",
};

export default function ChatPanel() {
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [savedToMemo, setSavedToMemo] = useState(false);

  const historyRef = useRef<HistoryTurn[]>([]);
  const activeRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    // warm the schedule/todo caches so the first turn doesn't pay the fetch latency
    void fetchScheduleEvents();
    void fetchTodoItems();

    // leaving the page (nav to another tab) must end any active conversation —
    // recognition/TTS are browser-global and keep running past unmount otherwise.
    return () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  function speak(text: string, onDone: () => void) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onDone();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.onend = onDone;
    utterance.onerror = onDone;
    window.speechSynthesis.speak(utterance);
  }

  function startListening() {
    const recognition = createRecognition();
    if (!recognition) {
      setUnsupported(
        typeof window !== "undefined" && !window.isSecureContext
          ? "음성 입력은 localhost 또는 HTTPS에서만 사용할 수 있습니다."
          : "이 브라우저에서는 음성 입력을 사용할 수 없습니다. Chrome 또는 Safari에서 열어주세요.",
      );
      activeRef.current = false;
      setPhase("idle");
      return;
    }
    recognitionRef.current = recognition;
    setStatus(null);
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          recognition.stop();
          recognitionRef.current = null;
          if (transcript) void handleTurn(transcript);
          else if (activeRef.current) startListening();
          return;
        }
      }
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      // ponytail: silence ("no-speech") during an active conversation just
      // re-opens the mic instead of ending the session — a brief pause
      // between turns shouldn't feel like a dropped call.
      if (event.error === "no-speech" && activeRef.current) {
        startListening();
        return;
      }
      setStatus(ERROR_MESSAGES[event.error] ?? "음성 인식에 실패했어요");
      activeRef.current = false;
      setPhase("idle");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
    };
    try {
      recognition.start();
      setPhase("listening");
    } catch {
      setStatus("마이크를 시작할 수 없어요");
      activeRef.current = false;
      setPhase("idle");
    }
  }

  async function handleTurn(message: string) {
    setPhase("thinking");

    const relevantMemos = findRelevantMemos(message, loadMemos());
    const [{ events: scheduleEvents, failed: scheduleFetchFailed }, todoItems] = await Promise.all([
      fetchScheduleEvents(),
      fetchTodoItems(),
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          history: historyRef.current,
          memoContext: relevantMemos.map((m) => `${m.question}: ${m.answer}`),
          scheduleEvents,
          scheduleFetchFailed,
          todoItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "요청이 실패했어요.");

      setExchange({ question: message, answer: data.reply, usedMemo: relevantMemos.length > 0 });
      setSavedToMemo(false);
      const newTurns: HistoryTurn[] = [
        { role: "user", content: message },
        { role: "assistant", content: data.reply },
      ];
      historyRef.current = [...historyRef.current, ...newTurns].slice(-MAX_HISTORY_TURNS);

      setPhase("speaking");
      speak(data.reply, () => {
        if (activeRef.current) startListening();
        else setPhase("idle");
      });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요.");
      if (activeRef.current) startListening();
      else setPhase("idle");
    }
  }

  function toggleConversation() {
    if (activeRef.current) {
      activeRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      setPhase("idle");
    } else {
      activeRef.current = true;
      startListening();
    }
  }

  return (
    <div className="assistant-shell">
      <div className="assistant-orb-area">
        <VoiceButton phase={phase} onClick={toggleConversation} unsupportedMessage={unsupported} />
      </div>

      <div className="assistant-result">
        {!exchange && phase === "idle" && !status && (
          <p className="assistant-placeholder">마이크를 누르고 대화를 시작해보세요.</p>
        )}
        {status && phase === "idle" && <p className="assistant-error">{status}</p>}
        {exchange && (
          <div className="assistant-exchange">
            <p className="assistant-question">{exchange.question}</p>
            <p className="assistant-answer">{exchange.answer}</p>
            {exchange.usedMemo && <span className="chat-memo-badge">메모 참고함</span>}
            <button
              type="button"
              className="assistant-save-btn"
              disabled={savedToMemo}
              onClick={() => {
                addMemo(exchange.question, exchange.answer);
                setSavedToMemo(true);
              }}
            >
              {savedToMemo ? "메모에 저장됨" : "메모에 저장"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
