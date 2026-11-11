import { NextResponse } from "next/server";

const NOTION_VERSION = "2022-06-28";
const API = "https://api.notion.com/v1";

type NotionResponse = { results?: Array<Record<string, unknown>>; object?: string; message?: string };

async function notion(path: string, init?: RequestInit): Promise<NotionResponse> {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error("NOTION_API_KEY missing");
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = (await response.json()) as NotionResponse;
  if (!response.ok) throw new Error(data.message ?? `Notion request failed: ${response.status}`);
  return data;
}

async function findCalendarDatabase(pageId: string): Promise<string | undefined> {
  const children = await notion(`/blocks/${pageId}/children?page_size=100`);
  const calendar = children.results?.find((item) => item.type === "child_database") as { id?: string } | undefined;
  return calendar?.id;
}

async function queryDatabase(databaseId: string): Promise<NotionResponse> {
  return notion(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({ page_size: 100 }),
  });
}

function titleFromProperties(properties: Record<string, unknown>): string {
  for (const property of Object.values(properties)) {
    const value = property as { type?: string; title?: Array<{ plain_text?: string }>; rich_text?: Array<{ plain_text?: string }> };
    const chunks = value.type === "title" ? value.title : value.type === "rich_text" ? value.rich_text : undefined;
    if (chunks?.length) return chunks.map((chunk) => chunk.plain_text ?? "").join("").trim();
  }
  return "제목 없는 일정";
}

function dateFromProperties(properties: Record<string, unknown>): string | null {
  for (const property of Object.values(properties)) {
    const value = property as { type?: string; date?: { start?: string } | null };
    if (value.type === "date" && value.date?.start) return value.date.start;
  }
  return null;
}

function textFromRichText(richText: Array<{ plain_text?: string }> | undefined): string {
  return (richText ?? []).map((t) => t.plain_text ?? "").join("");
}

async function fetchPageDetail(pageId: string): Promise<string> {
  try {
    const children = await notion(`/blocks/${pageId}/children?page_size=50`);
    const lines = (children.results ?? [])
      .map((block) => {
        const b = block as { type?: string } & Record<string, unknown>;
        if (!b.type) return "";
        const content = b[b.type] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
        return textFromRichText(content?.rich_text).trim();
      })
      .filter(Boolean);
    return lines.join("\n").slice(0, 1500);
  } catch {
    return "";
  }
}

export async function GET() {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID;
    const learningPageId = process.env.NOTION_PAGE_ID;
    let targetId = databaseId;

    if (!targetId) {
      let pageId = learningPageId;
      if (!pageId) {
        const search = await notion("/search", {
          method: "POST",
          body: JSON.stringify({ query: "Learning (JInseung Yu)", page_size: 10 }),
        });
        const page = search.results?.find((item) => item.object === "page");
        pageId = typeof page?.id === "string" ? page.id : undefined;
      }
      if (!pageId) throw new Error("Learning page not found");
      targetId = await findCalendarDatabase(pageId);
    }

    if (!targetId) throw new Error("Calendar database not found");
    let query: NotionResponse;
    try {
      query = await queryDatabase(targetId);
    } catch (error) {
      if (!learningPageId || targetId === learningPageId) throw error;
      const fallbackId = await findCalendarDatabase(learningPageId);
      if (!fallbackId || fallbackId === targetId) throw error;
      query = await queryDatabase(fallbackId);
    }
    const events = (query.results ?? [])
      .map((item) => {
        const page = item as { id: string; url?: string; properties?: Record<string, unknown> };
        return { id: page.id, title: titleFromProperties(page.properties ?? {}), date: dateFromProperties(page.properties ?? {}), url: page.url ?? null };
      })
      .filter((event) => !event.date || new Date(event.date).getTime() >= Date.now() - 86400000)
      .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
      .slice(0, 8);

    const eventsWithDetail = await Promise.all(
      events.map(async (event) => ({ ...event, detail: await fetchPageDetail(event.id) })),
    );

    return NextResponse.json({ events: eventsWithDetail });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Notion connection failed" }, { status: 503 });
  }
}
