import { deepseekChat } from "./deepseek";
import { qualityLabelRu } from "./qualityLabel";
import type { Topic, TopicStatus } from "../types/topic";
import { deriveTopicStatus, mergeTopicStatus } from "../stores/sessionStore";

export const DAY_REPORT_SYSTEM_PROMPT = `Ты коуч по СДВГ. Помогаешь понять день через нейробиологию — просто, без терминов, на человеческом языке.

Ниже JSON с задачами за день. Напиши итог (до 800 символов) по структуре:
1. Что получилось — объясни ПОЧЕМУ сработало через механику СДВГ
   (якорь / дофамин от завершения / инерция серии / внешняя подотчётность)
2. Что не получилось — объясни без осуждения
   (не было триггера начала / задача размытая / time blindness — не учёл переход / провал после обеда)
3. Один конкретный совет на завтра — по одной задаче из завтрашнего дня
   (через: якорь-старт / снижение порога / внешний триггер)
4. Короткая ободряющая фраза

Запрещено:
- Выдумывать задачи, детали, причины которых нет в JSON
- Медицинские советы или выводы о личности/характере
- Если данных мало — честно сказать: "сегодня мало данных, вот что вижу"
- Если все задачи выполнены — пункт 2 пропусти, не выдумывай проблемы
- Если ни одна задача не выполнена — пункт 1 пропусти, не хвали за несуществующее

Структура гибкая — используй только те пункты для которых есть реальные данные в JSON.
Стиль: тёплый, 2–3 эмодзи, обращение на «ты». Не пересказывай JSON. Один текст, строго до 800 символов.`;

export interface DayReportTaskJson {
  title: string;
  description: string;
  emoji: string;
  /** Выполнено по правилам приложения (фото «после» или свайп «готово») */
  completed: boolean;
  status: TopicStatus;
  /** Ориентир прогресса 0–100 для модели */
  progressPercent: number;
  /** Оценка шкалы 0–1, если пользователь её выставлял */
  qualityScore?: number;
  /** Подпись с шкалы (Слабо / Так себе / …), если есть оценка */
  qualityLabel?: string;
  /** Текст голосового отчёта по карточке, если есть */
  voiceReport?: string;
  /** Сколько времени заняла задача (в секундах), если запускался таймер */
  trackedTimeSec?: number;
  /** Человекочитаемое время по таймеру (например 12 мин, 1 ч 05 мин) */
  trackedTimeLabel?: string;
  /** Идёт ли таймер сейчас */
  timerRunning?: boolean;
  /** Целевое время таймера по задаче (в секундах), если было задано */
  timerTargetSec?: number;
  /** Целевое время в человекочитаемом виде */
  timerTargetLabel?: string;
  /** Было ли уведомление о достижении цели таймера */
  timerTargetReached?: boolean;
  hasBeforePhoto: boolean;
  hasAfterPhoto: boolean;
}

function trackedTimeLabelRu(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) {
    return `${h} ч ${String(m).padStart(2, "0")} мин`;
  }
  return `${Math.max(1, m)} мин`;
}

function timerTargetLabel(totalSec: number): string {
  return trackedTimeLabelRu(totalSec);
}

function progressPercentForTopic(t: Topic): number {
  const s = deriveTopicStatus(t);
  if (s === "done") return 100;
  if (s === "in_progress") {
    return t.voiceTranscript ? 72 : 48;
  }
  return 0;
}

export function buildDayReportTasksJson(topics: Topic[]): DayReportTaskJson[] {
  return topics.map((raw) => {
    const t = mergeTopicStatus(raw);
    const status = deriveTopicStatus(t);
    const completed = status === "done";
    const q = t.qualityScore;
    const runningSec = t.timingStartedAtMs ? Math.max(0, Math.floor((Date.now() - t.timingStartedAtMs) / 1000)) : 0;
    const trackedTimeSec = (t.timeSpentSec ?? 0) + runningSec;
    return {
      title: t.title,
      description: t.description,
      emoji: t.emoji,
      completed,
      status,
      progressPercent: progressPercentForTopic(t),
      ...(q !== undefined
        ? {
            qualityScore: q,
            qualityLabel: qualityLabelRu(q),
          }
        : {}),
      ...(t.voiceTranscript?.trim()
        ? { voiceReport: t.voiceTranscript.trim() }
        : {}),
      ...(trackedTimeSec > 0
        ? {
            trackedTimeSec,
            trackedTimeLabel: trackedTimeLabelRu(trackedTimeSec),
          }
        : {}),
      ...(t.timingStartedAtMs ? { timerRunning: true } : {}),
      ...(t.timerTargetSec
        ? {
            timerTargetSec: t.timerTargetSec,
            timerTargetLabel: timerTargetLabel(t.timerTargetSec),
            timerTargetReached: Boolean(t.timerTargetReachedNotified),
          }
        : {}),
      hasBeforePhoto: Boolean(t.beforePhotoUri),
      hasAfterPhoto: Boolean(t.afterPhotoUri),
    };
  });
}

export async function fetchDayClosingReflection(
  tasks: DayReportTaskJson[],
  dateKey: string
): Promise<string> {
  const userPayload = {
    dateKey,
    tasks,
  };

  return deepseekChat({
    system: DAY_REPORT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Данные за день (JSON):\n${JSON.stringify(userPayload, null, 2)}\n\ndateKey — календарный день пользователя. Контекст полей tasks: completed — задача закрыта в приложении; progressPercent — ориентир прогресса 0–100; qualityScore / qualityLabel — оценка качества, если есть; voiceReport — голосовой отчёт по карточке; trackedTimeSec / trackedTimeLabel — фактически накопленное время; timerRunning — таймер был активен на момент отчёта; timerTargetSec / timerTargetLabel — поставленная цель по времени; timerTargetReached — цель по времени достигалась; hasBeforePhoto / hasAfterPhoto — якорные фото. Учитывай любой осмысленный прогресс, не только completed.\n\nОтветь одним текстом по инструкции из system.`,
      },
    ],
    max_tokens: 900,
    temperature: 0.65,
  });
}
