"use client";

import { useMemo, useState } from "react";
import { PROMPTS, PROMPT_CATEGORIES } from "@/data/prompts";

export default function PromptsPage() {
  const [category, setCategory] = useState<string>("전체");
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return PROMPTS.filter((p) => {
      const matchesCategory = category === "전체" || p.category === category;
      const matchesQuery = query.trim() === "" || p.title.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      // clipboard permission denied — nothing to recover, just skip the "복사됨" flash
    }
  }

  return (
    <div className="page-shell">
      <div className="control-panel">
        <div className="control-panel-inner">
          <div className="control-group">
            {PROMPT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={c === category ? "chip chip-active" : "chip"}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            className="input prompt-search"
            placeholder="프롬프트 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="prompt-grid">
        {filtered.map((p) => (
          <div key={p.id} className="card prompt-card">
            <div className="prompt-card-head">
              <span className="badge badge-neutral">{p.category}</span>
              <h3>{p.title}</h3>
            </div>
            <p className="prompt-card-text">{p.text}</p>
            <button type="button" className="btn-primary" onClick={() => copy(p.id, p.text)}>
              {copiedId === p.id ? "복사됨" : "복사하기"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
