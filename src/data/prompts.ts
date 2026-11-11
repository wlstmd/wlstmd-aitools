export type PromptItem = {
  id: string;
  category: "업무" | "공부" | "글쓰기" | "일상" | "코딩";
  title: string;
  text: string;
};

export const PROMPTS: PromptItem[] = [
  {
    id: "work-email",
    category: "업무",
    title: "정중한 메일로 다듬기",
    text: "다음 내용을 상대방이 읽기 편하도록 정중하고 간결한 업무 메일로 다듬어줘. 핵심만 남기고 불필요한 수식어는 빼줘:\n\n",
  },
  {
    id: "work-summary",
    category: "업무",
    title: "회의록 핵심 정리",
    text: "다음 회의 내용을 '결정된 것 / 할 일(담당자 포함) / 보류된 것' 세 가지로 나눠서 불릿으로 정리해줘:\n\n",
  },
  {
    id: "work-decision",
    category: "업무",
    title: "의사결정 체크리스트",
    text: "다음 상황에서 내가 고려해야 할 선택지와 각각의 장단점을 표로 정리해줘:\n\n",
  },
  {
    id: "study-explain",
    category: "공부",
    title: "쉬운 비유로 설명",
    text: "다음 개념을 중학생도 이해할 수 있게 쉬운 비유를 들어 설명해줘:\n\n",
  },
  {
    id: "study-quiz",
    category: "공부",
    title: "복습 퀴즈 만들기",
    text: "다음 내용을 바탕으로 핵심을 확인할 수 있는 객관식 퀴즈 5개를 정답과 함께 만들어줘:\n\n",
  },
  {
    id: "study-plan",
    category: "공부",
    title: "학습 계획 짜기",
    text: "다음 시험/목표까지 남은 기간과 분량을 알려줄게. 하루 단위 학습 계획을 짜줘:\n\n",
  },
  {
    id: "write-tone",
    category: "글쓰기",
    title: "톤 바꾸기",
    text: "다음 글을 더 친근하고 편안한 말투로 바꿔줘. 의미는 그대로 유지해줘:\n\n",
  },
  {
    id: "write-shorten",
    category: "글쓰기",
    title: "짧게 요약",
    text: "다음 글을 세 문장 이내로 요약해줘. 가장 중요한 정보만 남겨줘:\n\n",
  },
  {
    id: "write-sns",
    category: "글쓰기",
    title: "SNS 캡션 만들기",
    text: "다음 내용을 바탕으로 짧고 자연스러운 SNS 캡션 3가지를 만들어줘. 과한 이모지는 빼줘:\n\n",
  },
  {
    id: "daily-recommend",
    category: "일상",
    title: "오늘 뭐 먹을지 추천",
    text: "다음 조건(인원, 예산, 선호 음식, 지역)을 참고해서 메뉴 3가지를 추천해줘:\n\n",
  },
  {
    id: "daily-reply",
    category: "일상",
    title: "카톡/문자 답장 다듬기",
    text: "다음 상황에서 보낼 답장 문구를 자연스럽게 다듬어줘. 너무 딱딱하지 않게:\n\n",
  },
  {
    id: "daily-plan-day",
    category: "일상",
    title: "하루 일정 정리",
    text: "다음 할 일 목록을 시간대별로 정리해줘. 급한 것부터 순서를 잡아줘:\n\n",
  },
  {
    id: "code-explain",
    category: "코딩",
    title: "코드 설명",
    text: "다음 코드가 하는 일을 한 줄 요약 + 단계별 설명으로 알려줘:\n\n",
  },
  {
    id: "code-bug",
    category: "코딩",
    title: "버그 원인 찾기",
    text: "다음 코드에서 발생하는 문제의 원인을 찾아주고, 최소한의 수정으로 고치는 방법을 알려줘:\n\n",
  },
  {
    id: "code-review",
    category: "코딩",
    title: "코드 리뷰 요청",
    text: "다음 코드를 리뷰해줘. 버그, 과한 설계, 더 간단히 쓸 수 있는 부분만 짚어줘:\n\n",
  },
];

export const PROMPT_CATEGORIES = [
  "전체",
  ...Array.from(new Set(PROMPTS.map((p) => p.category))),
] as const;
