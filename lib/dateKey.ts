import { formatDateKey, todayDateKey } from "../stores/sessionStore";

export { formatDateKey, todayDateKey };

export function parseDateKey(dateKey: string): { y: number; m: number; d: number } | null {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return { y, m, d };
}

/** Пон, 3 мая — для заголовка экрана */
export function dateTitleRu(dateKey: string): string {
  const p = parseDateKey(dateKey);
  if (!p) return dateKey;
  const dt = new Date(p.y, p.m - 1, p.d);
  return dt.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function isTodayKey(dateKey: string): boolean {
  return dateKey === todayDateKey();
}

export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isFutureKey(dateKey: string): boolean {
  return compareDateKeys(dateKey, todayDateKey()) > 0;
}

export function isPastKey(dateKey: string): boolean {
  return compareDateKeys(dateKey, todayDateKey()) < 0;
}

/** «завтра», «послезавтра» или дата — для подписи к будущему дню */
export function futureDayLabelRu(dateKey: string): string | null {
  if (!isFutureKey(dateKey)) return null;
  const today = parseDateKey(todayDateKey());
  const target = parseDateKey(dateKey);
  if (!today || !target) return null;
  const t0 = new Date(today.y, today.m - 1, today.d).getTime();
  const t1 = new Date(target.y, target.m - 1, target.d).getTime();
  const diff = Math.round((t1 - t0) / 86_400_000);
  if (diff === 1) return "завтра";
  if (diff === 2) return "послезавтра";
  return datePillRu(dateKey);
}

/** «пн, 4 мая» — как date-pill в макете */
export function datePillRu(dateKey: string): string {
  const p = parseDateKey(dateKey);
  if (!p) return dateKey;
  const dt = new Date(p.y, p.m - 1, p.d);
  return dt.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}
