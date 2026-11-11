import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { notion, queryDatabase, titleFromProperties, textFromRichText } from "@/lib/notion";

type TodoItem = { text: string; checked: boolean };

function isDone(properties: Record<string, unknown>): boolean {
  return Object.values(properties).some((property) => {
    const value = property as { type?: string; checkbox?: boolean; status?: { name?: string }; select?: { name?: string } };
    if (value.type === "checkbox") return value.checkbox === true;
    if (value.type === "status") return /done|완료/i.test(value.status?.name ?? "");
    if (value.type === "select") return /done|완료/i.test(value.select?.name ?? "");
    return false;
  });
}

async function loadTodos(): Promise<TodoItem[]> {
  const pageId = process.env.NOTION_TODO_PAGE_ID;
  if (!pageId) throw new Error("NOTION_TODO_PAGE_ID missing");

  const children = await notion(`/blocks/${pageId}/children?page_size=100`);
  const blocks = children.results ?? [];

  // native to_do blocks written directly on the page
  const nativeTodos: TodoItem[] = blocks
    .filter((b) => b.type === "to_do")
    .map((b) => {
      const todo = (b as Record<string, unknown>).to_do as { rich_text?: Array<{ plain_text?: string }>; checked?: boolean };
      return { text: textFromRichText(todo?.rich_text).trim(), checked: !!todo?.checked };
    });

  // a database embedded on the page (e.g. a "할 일" table)
  const database = blocks.find((b) => b.type === "child_database") as { id?: string } | undefined;
  let dbTodos: TodoItem[] = [];
  if (database?.id) {
    const query = await queryDatabase(database.id);
    dbTodos = (query.results ?? []).map((item) => {
      const page = item as { properties?: Record<string, unknown> };
      const properties = page.properties ?? {};
      return { text: titleFromProperties(properties), checked: isDone(properties) };
    });
  }

  return [...nativeTodos, ...dbTodos].filter((t) => t.text);
}

export async function GET() {
  try {
    const todos = await cached("notion-todo-items", 30_000, loadTodos);
    return NextResponse.json({ todos });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Notion connection failed" }, { status: 503 });
  }
}
