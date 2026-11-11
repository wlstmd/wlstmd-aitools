"use client";

import { useState } from "react";
import VoiceButton from "@/components/VoiceButton";
import { addMemo, findRelevantMemos, loadMemos } from "@/lib/memos";

type Exchange = { question: string; answer: string; usedMemo: boolean };
type ScheduleEvent = { title: string; date: string | null; detail?: string };
type HistoryTurn = { role: "user" | "assistant"; content: string };

const MAX_HISTORY_TURNS = 10;

async function fetchScheduleEvents(): Promise<{ events: ScheduleEvent[]; failed: boolean }> {
  try {
    const res = await fetch("/api/notion/calendar");
    if (!res.ok) return { events: [], failed: true };
    const data = await res.json();
    const events: ScheduleEvent[] = Array.isArray(data?.events) ? data.events : [];
    return { events, failed: false };
  } catch {
    return { events: [], failed: true };
  }
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  window.speechSynthesis.speak(utterance);
}

export default function ChatPanel() {
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryTurn[]>([]);
  const [savedToMemo, setSavedToMemo] = useState(false);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;

    setError(null);
    setLoading(true);

    const relevantMemos = findRelevantMemos(message, loadMemos());
    const { events: scheduleEvents, failed: scheduleFetchFailed } = await fetchScheduleEvents();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          memoContext: relevantMemos.map((m) => `${m.question}: ${m.answer}`),
          scheduleEvents,
          scheduleFetchFailed,
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
      setHistory((prev) => [...prev, ...newTurns].slice(-MAX_HISTORY_TURNS));
      speak(data.reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="assistant-shell">
      <div className="assistant-orb-area">
        <VoiceButton prominent onTranscript={send} />
      </div>

      <div className="assistant-result">
        {!exchange && !loading && !error && (
          <p className="assistant-placeholder">마이크를 누르고 말을 걸어보세요.</p>
        )}
        {loading && <p className="assistant-thinking">생각 중…</p>}
        {!loading && error && <p className="assistant-error">{error}</p>}
        {!loading && !error && exchange && (
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
