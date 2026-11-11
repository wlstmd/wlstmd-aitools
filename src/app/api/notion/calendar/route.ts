import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { findChildDatabase, notion, queryDatabase, titleFromProperties, textFromRichText, type NotionResponse } from "@/lib/notion";

function dateFromProperties(properties: Record<string, unknown>): string | null {
  for (const property of Object.values(properties)) {
    const value = property as { type?: string; date?: { start?: string } | null };
    if (value.type === "date" && value.date?.start) return value.date.start;
  }
  return null;
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

async function loadEvents() {
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
    targetId = await findChildDatabase(pageId);
  }

  if (!targetId) throw new Error("Calendar database not found");
  let query: NotionResponse;
  try {
    query = await queryDatabase(targetId);
  } catch (error) {
    if (!learningPageId || targetId === learningPageId) throw error;
    const fallbackId = await findChildDatabase(learningPageId);
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

  return Promise.all(events.map(async (event) => ({ ...event, detail: await fetchPageDetail(event.id) })));
}

export async function GET() {
  try {
    // short server-side cache: smooths out bursts of chat turns hitting this
    // route back-to-back without re-querying Notion + per-event detail fetches every time.
    const events = await cached("notion-calendar-events", 30_000, loadEvents);
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Notion connection failed" }, { status: 503 });
  }
}
