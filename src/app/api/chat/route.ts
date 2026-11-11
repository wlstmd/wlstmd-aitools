import { NextRequest, NextResponse } from "next/server";

// 계명대 AI 게이트웨이(baze, https://docs.factchat.kr) — OpenAI chat completions 호환 포맷.
const GATEWAY_URL = "https://factchat.mindlogic-kr-api.com/v1/gateway/chat/completions/";
const MODEL = "gemini-3.8-flash";

const SYSTEM_PROMPT = `너는 사용자의 일상을 도와주는 비서야. 질문에 짧고 바로 쓸 수 있게 답해줘.
형식적인 인사말이나 "AI로서" 같은 표현은 쓰지 말고, 사람이 메모해둔 걸 보고 답해주는 느낌으로 자연스럽게 답해줘.
답은 소리 내어 읽거나 그대로 화면에 표시돼. 별표, 불릿, 마크다운 문법은 쓰지 말고 자연스러운 문장으로만 답해줘.
답변은 길게 설명하지 말고 1~2문장, 최대한 짧게 해. 사용자가 "자세히", "상세히", "내용 알려줘" 처럼 더 물어볼 때만 자세히 답해.`;

type ChatMessage = { role: "user" | "assistant"; content: string };
type ScheduleEvent = { title: string; date: string | null; detail?: string };
type TodoItem = { text: string; checked: boolean };

function seoulDateISO(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GATEWAY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GATEWAY_API_KEY가 설정되지 않아 챗봇을 쓸 수 없어요. 서버 환경변수를 설정해주세요." },
      { status: 503 },
    );
  }

  const body = await req.json();
  const message: unknown = body?.message;
  const history: unknown = body?.history;
  const memoContext: unknown = body?.memoContext;
  const scheduleEvents: unknown = body?.scheduleEvents;

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  }

  const safeHistory: ChatMessage[] = Array.isArray(history)
    ? history.filter(
        (m): m is ChatMessage =>
          m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
      )
    : [];

  const safeMemoContext: string[] = Array.isArray(memoContext)
    ? memoContext.filter((m): m is string => typeof m === "string")
    : [];

  const safeScheduleEvents: ScheduleEvent[] = Array.isArray(scheduleEvents)
    ? scheduleEvents
        .filter(
          (e): e is ScheduleEvent =>
            e && typeof e.title === "string" && (e.date === null || typeof e.date === "string"),
        )
        .map((e) => ({ ...e, detail: typeof e.detail === "string" ? e.detail : undefined }))
    : [];
  const scheduleFetchFailed = body?.scheduleFetchFailed === true;

  const todoItems: unknown = body?.todoItems;
  const safeTodoItems: TodoItem[] = Array.isArray(todoItems)
    ? todoItems.filter((t): t is TodoItem => t && typeof t.text === "string" && typeof t.checked === "boolean")
    : [];

  const now = new Date();
  const todayISO = seoulDateISO(now);
  const todayLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);

  let systemContent = `${SYSTEM_PROMPT}\n\n오늘은 ${todayLabel}이야.`;
  if (safeMemoContext.length > 0) {
    systemContent += `\n\n사용자가 저장해둔 메모 중 이 질문과 관련 있어 보이는 내용이야. 참고가 되면 활용하고, 관련 없으면 무시해:\n${safeMemoContext.map((m) => `- ${m}`).join("\n")}`;
  }

  if (scheduleFetchFailed) {
    systemContent += `\n\n지금은 Notion 일정 정보를 불러오지 못한 상태야. 일정을 물어보면 "지금 일정을 확인할 수 없어요"라고 답하고, 일정이 없다고 단정하지 마.`;
  } else {
    // "오늘 일정이 있는지"는 모델의 날짜 추론에 맡기지 않고 서버에서 직접 계산해
    // 가장 흔한 질문("오늘 일정")에서는 모델이 틀릴 여지를 없앤다.
    const todaysEvents = safeScheduleEvents.filter((e) => e.date?.slice(0, 10) === todayISO);
    systemContent += `\n\n오늘(${todayLabel}) 등록된 일정: ${
      todaysEvents.length > 0 ? todaysEvents.map((e) => e.title).join(", ") : "없음"
    }. 이건 확정된 사실이니 그대로 답해.`;

    if (safeScheduleEvents.length > 0) {
      const formatted = safeScheduleEvents.map((e) =>
        e.date
          ? `${new Date(e.date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${e.title}`
          : e.title,
      );
      systemContent += `\n\n사용자의 Notion 전체 일정 목록이야(오늘 외의 날짜를 물으면 참고해):\n${formatted.map((s) => `- ${s}`).join("\n")}`;
    }

    const eventsWithDetail = safeScheduleEvents.filter((e) => e.detail && e.detail.trim());
    if (eventsWithDetail.length > 0) {
      systemContent += `\n\n각 일정 페이지 안에 적혀 있는 상세 내용이야. 기본 답변엔 쓰지 말고, 사용자가 상세 내용을 물을 때만 참고해서 답해:\n${eventsWithDetail
        .map((e) => `[${e.title}]\n${e.detail}`)
        .join("\n\n")}`;
    }
  }

  if (safeTodoItems.length > 0) {
    const pending = safeTodoItems.filter((t) => !t.checked).map((t) => t.text);
    const done = safeTodoItems.filter((t) => t.checked).map((t) => t.text);
    systemContent += `\n\n사용자의 할 일 목록이야. 안 끝난 일: ${
      pending.length > 0 ? pending.join(", ") : "없음"
    }. 끝난 일: ${done.length > 0 ? done.join(", ") : "없음"}. 할 일을 물어보거나 브리핑해달라고 하면 안 끝난 일 위주로 답해.`;
  }

  let response: Response;
  try {
    response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemContent },
          ...safeHistory,
          { role: "user", content: message },
        ],
      }),
    });
  } catch {
    return NextResponse.json({ error: "AI 서버에 연결하지 못했어요." }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: `요청이 실패했어요 (${response.status}).` }, { status: 502 });
  }

  const data = await response.json();
  const reply: string = data?.choices?.[0]?.message?.content ?? "";

  if (!reply) {
    return NextResponse.json({ error: "응답을 받지 못했어요." }, { status: 502 });
  }

  return NextResponse.json({ reply });
}
