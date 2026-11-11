"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { deleteMemo, getMemo, type Memo } from "@/lib/memos";

export default function MemoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [memo, setMemo] = useState<Memo | null | undefined>(undefined);

  useEffect(() => {
    // localStorage read must happen client-side only, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMemo(getMemo(id));
  }, [id]);

  function handleDelete() {
    deleteMemo(id);
    router.push("/memos");
  }

  return (
    <div className="page-shell">
      <Link href="/memos" className="link-back">
        ← 메모 목록
      </Link>

      {memo === undefined && null}
      {memo === null && <p className="chat-empty-text">메모를 찾을 수 없어요.</p>}
      {memo && (
        <div className="card memo-detail-card">
          <p className="memo-detail-question">{memo.question}</p>
          <p className="memo-detail-answer">{memo.answer}</p>
          <div className="memo-item-footer">
            <span className="timeline-step-value">{new Date(memo.createdAt).toLocaleString("ko-KR")}</span>
            <button type="button" className="btn-text-danger" onClick={handleDelete}>
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
