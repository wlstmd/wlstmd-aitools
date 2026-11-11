const NOTION_VERSION = "2022-06-28";
const API = "https://api.notion.com/v1";

export type NotionResponse = { results?: Array<Record<string, unknown>>; object?: string; message?: string };

export async function notion(path: string, init?: RequestInit): Promise<NotionResponse> {
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

export async function findChildDatabase(pageId: string): Promise<string | undefined> {
  const children = await notion(`/blocks/${pageId}/children?page_size=100`);
  const database = children.results?.find((item) => item.type === "child_database") as { id?: string } | undefined;
  return database?.id;
}

export async function queryDatabase(databaseId: string): Promise<NotionResponse> {
  return notion(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({ page_size: 100 }),
  });
}

export function textFromRichText(richText: Array<{ plain_text?: string }> | undefined): string {
  return (richText ?? []).map((t) => t.plain_text ?? "").join("");
}

export function titleFromProperties(properties: Record<string, unknown>): string {
  for (const property of Object.values(properties)) {
    const value = property as { type?: string; title?: Array<{ plain_text?: string }>; rich_text?: Array<{ plain_text?: string }> };
    const chunks = value.type === "title" ? value.title : value.type === "rich_text" ? value.rich_text : undefined;
    if (chunks?.length) return chunks.map((chunk) => chunk.plain_text ?? "").join("").trim();
  }
  return "제목 없음";
}
