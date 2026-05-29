import { deepseekChat } from "./deepseek";
import { formatDateKey } from "../stores/sessionStore";
import type { DayReportTaskJson } from "./dayReport";

export const PERIOD_REPORT_SYSTEM_PROMPT = `Ты коуч по СДВГ с нейробиологическим уклоном.

Пользователь выбрал период из нескольких дней и хочет увидеть не сухую статистику,
а осмысленный разбор: что менялось, какие паттерны повторились, куда двигаться дальше.

Ниже — JSON с задачами за выбранные дни. Дней может быть от 3 до 30.

Напиши разбор (до 1200 символов) по структуре:

1. ГЛАВНЫЙ ТРЕНД (1 предложение)
   — стало лучше / хуже / без изменений
   — пример: "За эти 5 дней ты закрыл 7 из 12 задач — плотность выше, чем обычно"

2. ЧТО СРАБОТАЛО (коротко, 2-3 пункта)
   — какие механики дали результат (якоря, таймеры, фото, голос)
   — в какие дни было легче всего и почему

3. ЧТО БУКСОВАЛО (без осуждения)
   — какие типы задач откладывались чаще всего
   — было ли время дня, когда задачи вставали
   — если данных мало — честно сказать

4. ОДИН ПАТТЕРН, КОТОРЫЙ СТОИТ УЧЕСТЬ
   — например: "по вторникам ты перегружаешь себя, а в пятницу — провал"
   — или: "после фото-якоря задачи выполняются на 80% чаще"

5. 1-2 СОВЕТА НА СЛЕДУЮЩИЙ ПЕРИОД
   — конкретные, через механику СДВГ
   — например: "добавь таймер 15 мин для утренних писем"

6. ОБОДРЯЮЩАЯ ФРАЗА

ВАЖНЫЕ ЗАПРЕТЫ (те же, что в дневном промпте):
- Не выдумывать задачи/детали, которых нет в JSON
- Не давать медицинских советов
- Не делать выводов о личности или будущем
- Если данных за период мало (например, 3 дня и 2 задачи) — честно сказать: "данных маловато для паттернов, но вот что вижу"

СТИЛЬ: тёплый, 3-4 эмодзи, обращение на «ты». Не пересказывай JSON построчно. Дай связный текст.`;

export interface PeriodReportResult {
  text: string;
}

export interface PeriodReportTaskEntry extends DayReportTaskJson {
  dateKey: string;
}

export interface PeriodReportPayload {
  startDate: string;
  endDate: string;
  daysCount: number;
  totalCompleted: number;
  streak: number;
  tasks: PeriodReportTaskEntry[];
}

export function enumerateDateKeys(startDate: string, endDate: string): string[] {
  const startParts = startDate.split("-");
  const endParts = endDate.split("-");
  const sy = Number(startParts[0] ?? Number.NaN);
  const sm = Number(startParts[1] ?? Number.NaN);
  const sd = Number(startParts[2] ?? Number.NaN);
  const ey = Number(endParts[0] ?? Number.NaN);
  const em = Number(endParts[1] ?? Number.NaN);
  const ed = Number(endParts[2] ?? Number.NaN);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const min = start <= end ? start : end;
  const max = start <= end ? end : start;
  const out: string[] = [];
  const cursor = new Date(min);
  while (cursor <= max) {
    out.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export async function fetchPeriodReflection(payload: PeriodReportPayload): Promise<PeriodReportResult> {
  const text = await deepseekChat({
    system: PERIOD_REPORT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `ПЕРИОД: ${payload.startDate} — ${payload.endDate}\n` +
          `КОЛИЧЕСТВО ДНЕЙ: ${payload.daysCount}\n` +
          `ВЫПОЛНЕНО ЗАДАЧ ВСЕГО: ${payload.totalCompleted}\n` +
          `ОБЩАЯ СЕРИЯ (если есть): ${payload.streak} дней подряд\n\n` +
          `JSON за выбранный период:\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
    max_tokens: 1400,
    temperature: 0.6,
  });
  return { text };
}

