import type { Topic } from "../types/topic";

import { getDeepSeekApiKey } from "./runtimeEnv";

const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/v1/chat/completions";

/** См. https://api-docs.deepseek.com — чат для JSON и коротких текстов */
export const DEEPSEEK_CHAT_MODEL = "deepseek-chat";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function deepseekChat(options: {
  system?: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature?: number;
}): Promise<string> {
  const key = getDeepSeekApiKey();
  if (!key) {
    throw new Error(
      "Не задан EXPO_PUBLIC_DEEPSEEK_API_KEY в .env (или не подхватился через app.config.js → extra)."
    );
  }

  const messages: ChatMessage[] = [];
  if (options.system?.trim()) {
    messages.push({ role: "system", content: options.system.trim() });
  }
  messages.push(...options.messages);

  const response = await fetch(DEEPSEEK_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_CHAT_MODEL,
      messages,
      max_tokens: options.max_tokens,
      temperature: options.temperature ?? 0.4,
    }),
  }).catch((e) => {
    throw new Error(
      `DeepSeek: ${e instanceof Error ? e.message : "load failed"} — проверьте сеть и EXPO_PUBLIC_DEEPSEEK_API_KEY в сборке.`
    );
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek: ${response.status} ${errText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(`DeepSeek: ${data.error.message}`);
  }

  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("Пустой ответ от DeepSeek");
  }
  return text;
}

type ParsedTopicPayload = Pick<Topic, "id" | "title" | "description" | "emoji" | "boost">;

function buildTopicsExtractionPrompt(
  transcribedText: string,
  existingTasks: { title: string }[] = []
): string {
  const trimmed = transcribedText.slice(0, 1500);
  const existing = existingTasks.map((t) => t.title).join(", ") || "нет";

  const parts = [
    "Ты помогаешь людям со СДВГ планировать день.",
    "Из голосового сообщения выдели список активностей, целей и намерений. Верни ТОЛЬКО валидный JSON без пояснений, без markdown.",
    "Пустой {\"topics\": []} — только если в тексте нет ни одной задачи/цели (приветствие, шутка, тишина, «не знаю что делать»).",
    "Одна сказанная цель или проект = минимум одна карточка, даже если это крупная цель: «запустить стартап», «написать диплом», «успешный проект» — оформи как задачу на день (укороти title до 2–5 слов, детали в description).",
    "Максимум 10 задач. Похожие объединяй, не дроби на микрозадачи без просьбы пользователя. Сохраняй порядок как в тексте.",
    "Для каждого элемента укажи уникальный id в формате UUID v4 (разные строки для разных задач, без повторов).",
    "title — короткое действие или цель, 2–5 слов, на языке пользователя (можно глагол + объект: «Запустить стартап»).",
    'Поле description: ТОЛЬКО детали из самого текста — время, место, контекст, длительность если они были упомянуты. Нельзя копировать title или дублировать его. Если деталей не было — вернуть пустую строку "".',
    'Поле emoji: имя компонента из lucide-react-native в PascalCase (например Calendar, Target, Coffee). Не Unicode-эмодзи. Только реально существующие имена пакета.',
    "",
    'Поле boost: короткая мотивирующая фраза (3-5 слов, на языке пользователя), которая появится при старте задачи.',
    "Правила для boost:",
    '- Не "ты сможешь", "давай", "вперёд" — это банально',
    '- Учитывай тип задачи: для звонка — "голос решает всё", для писем — "три письма — уже прогресс"',
    "- Используй магию маленьких шагов, снижай перфекционизм",
    '- Добавь лёгкий вызов или игру: "засеки 5 минут", "сделай по-быстрому"',
    '- Если задача повторяется — вариант "сегодня проще чем вчера"',
    '- Запрещено: ложный позитив ("ты гений"), сравнение с другими, давление',
    `Уже существующие задачи на сегодня (не дублируй их): ${existing}`,
    "Пример структуры:",
    '{"topics": [{"id": "550e8400-e29b-41d4-a716-446655440000", "title": "Запустить стартап", "description": "успешный проект", "emoji": "Rocket", "boost": "один шаг — уже план"}]}',
    "",
    "Текст:",
    trimmed,
  ];
  return parts.join("\n");
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) {
    return fence[1].trim();
  }
  return trimmed;
}

function newTopicId(): string {
  const c = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof c.crypto?.randomUUID === "function") {
    return c.crypto.randomUUID();
  }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/** Если модель вернула [], но в расшифровке есть смысл — одна карточка из текста. */
function fallbackTopicFromTranscript(transcribedText: string): ParsedTopicPayload | null {
  const raw = transcribedText.trim().replace(/\s+/g, " ");
  if (raw.length < 6) return null;
  if (/^(привет|здравствуй|спасибо|тест|окей|да|нет)[\s!.?]*$/i.test(raw)) return null;

  const maxTitleLen = 42;
  let title = raw;
  let description = "";
  if (raw.length > maxTitleLen) {
    const cut = raw.slice(0, maxTitleLen);
    const lastSpace = cut.lastIndexOf(" ");
    title = lastSpace > 8 ? cut.slice(0, lastSpace) : cut;
    description = raw.slice(title.length).trim().replace(/^[,.\s]+/, "");
  }

  return {
    id: newTopicId(),
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description,
    emoji: "Rocket",
    boost: "один шаг — уже план",
  };
}

export async function extractTopicsFromTranscript(
  transcribedText: string,
  existingTasks: { title: string }[] = []
): Promise<ParsedTopicPayload[]> {
  const raw = await deepseekChat({
    messages: [{ role: "user", content: buildTopicsExtractionPrompt(transcribedText, existingTasks) }],
    max_tokens: 500,
    temperature: 0.2,
  });

  const jsonText = stripJsonFence(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("DeepSeek вернул невалидный JSON");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("topics" in parsed) ||
    !Array.isArray((parsed as { topics: unknown }).topics)
  ) {
    throw new Error("В ответе DeepSeek нет массива topics");
  }

  const topics = (parsed as { topics: ParsedTopicPayload[] }).topics;
  const mapped = topics.map((t) => ({
    id: String(t.id),
    title: String(t.title),
    description: String(t.description),
    emoji: String(t.emoji),
    boost: typeof t.boost === "string" ? t.boost : "",
  }));

  if (mapped.length > 0) {
    return mapped;
  }

  const fallback = fallbackTopicFromTranscript(transcribedText);
  return fallback ? [fallback] : [];
}
