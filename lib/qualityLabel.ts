/** Подписи шкалы «Качество выполнения» (0…1), как на карточке. */
export function qualityLabelRu(p: number): string {
  const x = Math.max(0, Math.min(1, p));
  if (x < 0.22) return "Слабо";
  if (x < 0.42) return "Так себе";
  if (x < 0.62) return "Нормально";
  if (x < 0.82) return "Хорошо";
  return "Отлично";
}
