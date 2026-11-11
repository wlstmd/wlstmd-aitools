"use client";

import { useRef, useState } from "react";
import { MicIcon } from "@/components/Icons";

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
  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const Impl = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
  if (!Impl) return null;
  const recognition = new Impl();
  recognition.lang = "ko-KR";
  // continuous + interim results: a brief pause before the user starts talking
  // no longer ends the session early (non-continuous mode times out after a
  // few seconds of leading silence). We stop manually once a final result lands.
  recognition.interimResults = true;
  recognition.continuous = true;
  return recognition;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "마이크 권한을 허용해주세요",
  "no-speech": "말이 들리지 않았어요, 다시 눌러보세요",
  "audio-capture": "마이크를 찾을 수 없어요",
};

export default function VoiceButton({
  onTranscript,
  prominent = false,
}: {
  onTranscript: (text: string) => void;
  prominent?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  function start() {
    const recognition = createRecognition();
    if (!recognition) {
      setSupported(false);
      return;
    }
    setStatus(null);
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          if (transcript) onTranscript(transcript);
          recognition.stop();
          recognitionRef.current = null;
          setListening(false);
          return;
        }
      }
    };
    recognition.onerror = (event) => {
      setStatus(ERROR_MESSAGES[event.error] ?? "음성 인식에 실패했어요");
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setStatus("마이크를 시작할 수 없어요");
      setSupported(false);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  if (!supported) {
    const secureContextMessage =
      typeof window !== "undefined" && !window.isSecureContext
        ? "음성 입력은 localhost 또는 HTTPS에서만 사용할 수 있습니다."
        : "이 브라우저에서는 음성 입력을 사용할 수 없습니다. Chrome 또는 Safari에서 열어주세요.";
    return <span className="voice-unsupported">{secureContextMessage}</span>;
  }

  return (
    <div className={prominent ? "voice-command" : undefined}>
      <button
        type="button"
        className={`${prominent ? "voice-btn voice-btn-prominent" : "voice-btn"}${listening ? " voice-btn-active" : ""}`}
        onClick={() => (listening ? stop() : start())}
        aria-pressed={listening}
        aria-label="눌러서 말하기"
        title="눌러서 말하기"
      >
        {prominent ? (
          <span className="sr-only">{listening ? "듣고 있어요" : "음성 입력"}</span>
        ) : (
          <MicIcon size={18} />
        )}
      </button>
      {prominent && (
        <p className="voice-status">{listening ? "듣고 있어요…" : status ?? "눌러서 말해보세요"}</p>
      )}
    </div>
  );
}
