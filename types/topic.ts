export type TopicStatus = "not_started" | "in_progress" | "done";

export interface Topic {
  id: string;
  title: string;
  description: string;
  emoji: string;
  /** Мотивационный призыв для старта задачи. */
  boost?: string;
  dateKey: string;
  beforePhotoUri?: string;
  afterPhotoUri?: string;
  /** Быстрая отметка «выполнено» свайпом (без фото «после»). */
  manualComplete?: boolean;
  /** Оценка качества выполнения, 0…1 (ползунок на карточке). */
  qualityScore?: number;
  /** Суммарное зафиксированное время по задаче (в секундах). */
  timeSpentSec?: number;
  /** Если таймер запущен — timestamp старта в ms. */
  timingStartedAtMs?: number;
  /** Цель таймера для задачи (в секундах), если пользователь поставил. */
  timerTargetSec?: number;
  /** Уведомление о достижении цели уже показано для текущего запуска. */
  timerTargetReachedNotified?: boolean;
  voiceTranscript?: string;
  status: TopicStatus;
}
