"use client";

export type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

const LABELS: Record<VoicePhase, string> = {
  idle: "눌러서 대화 시작",
  listening: "듣고 있어요…",
  thinking: "생각 중…",
  speaking: "말하는 중…",
};

export default function VoiceButton({
  phase,
  onClick,
  unsupportedMessage,
}: {
  phase: VoicePhase;
  onClick: () => void;
  unsupportedMessage?: string | null;
}) {
  if (unsupportedMessage) {
    return <span className="voice-unsupported">{unsupportedMessage}</span>;
  }

  return (
    <div className="voice-command">
      <button
        type="button"
        className={`voice-btn-prominent voice-btn-${phase}`}
        onClick={onClick}
        aria-pressed={phase !== "idle"}
        aria-label="음성 대화"
        title="음성 대화"
      >
        <span className="sr-only">{LABELS[phase]}</span>
      </button>
      <p className="voice-status">{LABELS[phase]}</p>
    </div>
  );
}
