"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addMemo, loadMemos, updateMemoAnswer, type Memo } from "@/lib/memos";

const PENDING_ANSWER = "생성 중…";

export default function MemosPage() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [question, setQuestion] = useState("");

  useEffect(() => {
    // localStorage read must happen client-side only, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMemos(loadMemos());
  }, []);

  function handleAdd() {
    const trimmed = question.trim();
    if (!trimmed) return;
    setQuestion("");

    // save immediately with a placeholder, then fill in the real answer once it's ready —
    // no need to make the user wait on the AI call before they see it land in the list.
    const updated = addMemo(trimmed, PENDING_ANSWER);
    setMemos(updated);
    const newId = updated[0].id;

    fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: `${trimmed}\n\n(필요한 배경과 이유까지 포함해서 자세하고 친절하게 설명해줘.)`,
        history: [],
        memoContext: [],
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "답변을 가져오지 못했어요.");
        setMemos(updateMemoAnswer(newId, data.reply.trim()));
      })
      .catch((err) => {
        setMemos(updateMemoAnswer(newId, err instanceof Error ? err.message : "답변을 가져오지 못했어요."));
      });
  }

  return (
    <div className="page-shell">
      <div className="card memo-composer">
        <input
          className="input memo-input"
          placeholder="궁금한 걸 적어두면 AI가 자세히 답해둬요"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <button type="button" className="btn-primary" onClick={handleAdd} disabled={!question.trim()}>
          저장
        </button>
      </div>

      <div className="memo-list">
        {memos.length === 0 && <p className="chat-empty-text">아직 저장한 메모가 없어요.</p>}
        {memos.map((memo) => (
          <Link key={memo.id} href={`/memos/${memo.id}`} className="card memo-row">
            <span className="memo-row-question">{memo.question}</span>
            <span className="memo-row-date">
              {memo.answer === PENDING_ANSWER ? "생성 중…" : new Date(memo.createdAt).toLocaleDateString("ko-KR")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
