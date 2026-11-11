"use client";

import { useEffect, useState } from "react";
import { CalendarIcon } from "@/components/Icons";

type EventItem = { id: string; title: string; date: string | null; url: string | null };

export default function SchedulePanel() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    fetch("/api/notion/calendar")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error);
        return data;
      })
      .then((data: { events: EventItem[] }) => {
        setEvents(data.events);
        setState(data.events.length ? "ready" : "empty");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <aside className="card schedule-panel">
      <div className="section-heading schedule-heading">
        <div>
          <p className="eyebrow">FROM NOTION</p>
          <h3>다가오는 일정</h3>
        </div>
        <span className="notion-label"><CalendarIcon /></span>
      </div>
      {state === "loading" && <p className="schedule-message">Learning 캘린더를 불러오는 중…</p>}
      {state === "error" && (
        <div className="schedule-message">
          <strong>Learning 캘린더를 확인할 수 없어요.</strong>
          <p>Notion에서 캘린더 데이터베이스를 <b>ai-tool</b> Integration에 공유했는지 확인해주세요.</p>
        </div>
      )}
      {state === "empty" && <p className="schedule-message">예정된 일정이 없습니다.</p>}
      {state === "ready" && (
        <ol className="schedule-list">
          {events.map((event) => (
            <li key={event.id} className="schedule-item">
              <time>{event.date ? new Date(event.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "날짜 없음"}</time>
              {event.url ? <a href={event.url} target="_blank" rel="noreferrer">{event.title}</a> : <span>{event.title}</span>}
            </li>
          ))}
        </ol>
      )}
      <p className="schedule-caption">Learning (JInseung Yu) · Notion</p>
    </aside>
  );
}
