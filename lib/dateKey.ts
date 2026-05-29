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
