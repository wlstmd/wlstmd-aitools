export type Memo = {
  id: string;
  question: string;
  answer: string;
  createdAt: number;
};

const STORAGE_KEY = "ai-toolbox-memos";

export function loadMemos(): Memo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Memo[]) : [];
  } catch {
    return [];
  }
}

export function saveMemos(memos: Memo[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

export function addMemo(question: string, answer: string): Memo[] {
  const memos = loadMemos();
  const next = [{ id: crypto.randomUUID(), question, answer, createdAt: Date.now() }, ...memos];
  saveMemos(next);
  return next;
}

export function getMemo(id: string): Memo | null {
  return loadMemos().find((m) => m.id === id) ?? null;
}

export function updateMemoAnswer(id: string, answer: string): Memo[] {
  const next = loadMemos().map((m) => (m.id === id ? { ...m, answer } : m));
  saveMemos(next);
  return next;
}

export function deleteMemo(id: string): Memo[] {
  const next = loadMemos().filter((m) => m.id !== id);
  saveMemos(next);
  return next;
}

// ponytail: 단어 겹침 개수로만 점수를 매기는 단순 매칭. 메모가 많아지면(수백 개 이상)
// 임베딩 기반 검색으로 바꿀 것 — 지금은 개인용 메모장 규모라 과한 설계.
export function findRelevantMemos(query: string, memos: Memo[], limit = 3): Memo[] {
  const queryWords = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (queryWords.length === 0) return [];

  const scored = memos
    .map((memo) => {
      const text = `${memo.question} ${memo.answer}`.toLowerCase();
      const score = queryWords.filter((w) => w.length > 1 && text.includes(w)).length;
      return { memo, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.memo);
}
