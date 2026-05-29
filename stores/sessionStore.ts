import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Topic, TopicStatus } from "../types/topic";

/** Ключ даты `YYYY-MM-DD` для сравнения с `Topic.dateKey`. */
export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayDateKey(): string {
  return formatDateKey(new Date());
}

function tomorrowDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateKey(d);
}

export function deriveTopicStatus(
  t: Pick<Topic, "beforePhotoUri" | "afterPhotoUri" | "manualComplete" | "timingStartedAtMs" | "timeSpentSec">
): TopicStatus {
  if (t.afterPhotoUri || t.manualComplete) return "done";
  if (t.beforePhotoUri || Boolean(t.timingStartedAtMs) || (t.timeSpentSec ?? 0) > 0) return "in_progress";
  return "not_started";
}

type ClaudeTopicInput = Pick<Topic, "id" | "title" | "description" | "emoji" | "boost">;

export interface SavedPeriodReport {
  id: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  totalCompleted: number;
  streak: number;
  text: string;
  createdAt: string;
}

interface SessionState {
  topics: Topic[];
  periodReports: SavedPeriodReport[];
  timerSoundEnabled: boolean;
  appendTopicsFromClaude: (items: ClaudeTopicInput[]) => void;
  setBeforePhoto: (id: string, uri: string) => void;
  setAfterPhoto: (id: string, uri: string) => void;
  setVoiceTranscript: (id: string, text: string) => void;
  setManualComplete: (id: string, value: boolean) => void;
  setQualityScore: (id: string, score: number | undefined) => void;
  startTopicTimer: (id: string) => void;
  stopTopicTimer: (id: string) => void;
  setTopicTimerTarget: (id: string, targetSec: number | undefined) => void;
  markTopicTimerTargetNotified: (id: string) => void;
  toggleTimerSound: () => void;
  removeTopic: (id: string) => void;
  postponeTopicToTomorrow: (id: string) => void;
  getTopic: (id: string) => Topic | undefined;
  getTodayTopics: () => Topic[];
  getSortedDateKeys: () => string[];
  getTopicsByDateKey: (dateKey: string) => Topic[];
  getActiveDateKeys: () => string[];
  getCurrentStreakDays: () => number;
  savePeriodReport: (row: Omit<SavedPeriodReport, "id" | "createdAt">) => void;
  removePeriodReport: (id: string) => void;
}

export function mergeTopicStatus(t: Topic): Topic {
  return { ...t, status: deriveTopicStatus(t) };
}

function newTopicId(): string {
  const c = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof c.crypto?.randomUUID === "function") {
    return c.crypto.randomUUID();
  }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function topicFromClaude(it: ClaudeTopicInput, dateKey: string): Topic {
  const row: Omit<Topic, "status"> = {
    ...it,
    dateKey,
  };
  return { ...row, status: deriveTopicStatus(row) };
}

function dedupeTopicsById(topics: Topic[]): Topic[] {
  const seen = new Set<string>();
  const out: Topic[] = [];
  for (const t of topics) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      topics: [],
      periodReports: [],
      timerSoundEnabled: true,
      appendTopicsFromClaude: (items) => {
        const dateKey = todayDateKey();
        set((s) => ({
          topics: dedupeTopicsById([
            ...s.topics,
            ...items.map((it) =>
              topicFromClaude({ ...it, id: newTopicId() }, dateKey)
            ),
          ]),
        }));
      },
      setBeforePhoto: (id, uri) => {
        set((s) => ({
          topics: s.topics.map((t) =>
            t.id === id
              ? mergeTopicStatus({ ...t, beforePhotoUri: uri })
              : t
          ),
        }));
      },
      setAfterPhoto: (id, uri) => {
        set((s) => ({
          topics: s.topics.map((t) =>
            t.id === id ? mergeTopicStatus({ ...t, afterPhotoUri: uri }) : t
          ),
        }));
      },
      setVoiceTranscript: (id, text) => {
        set((s) => ({
          topics: s.topics.map((t) =>
            t.id === id ? { ...t, voiceTranscript: text } : t
          ),
        }));
      },
      setManualComplete: (id, value) => {
        set((s) => ({
          topics: s.topics.map((t) =>
            t.id === id
              ? mergeTopicStatus({
                  ...t,
                  manualComplete: value ? true : undefined,
                  ...(value ? { timingStartedAtMs: undefined } : {}),
                })
              : t
          ),
        }));
      },
      setQualityScore: (id, score) => {
        set((s) => ({
          topics: s.topics.map((t) => {
            if (t.id !== id) return t;
            const next =
              score === undefined
                ? { ...t, qualityScore: undefined }
                : {
                    ...t,
                    qualityScore: Math.max(0, Math.min(1, Math.round(score * 100) / 100)),
                  };
            return mergeTopicStatus(next);
          }),
        }));
      },
      startTopicTimer: (id) => {
        const now = Date.now();
        set((s) => ({
          topics: s.topics.map((t) => {
            if (t.id !== id) return t;
            if (deriveTopicStatus(t) === "done") return t;
            if (t.timingStartedAtMs) return t;
            return mergeTopicStatus({
              ...t,
              timingStartedAtMs: now,
              timerTargetReachedNotified: false,
            });
          }),
        }));
      },
      stopTopicTimer: (id) => {
        const now = Date.now();
        set((s) => ({
          topics: s.topics.map((t) => {
            if (t.id !== id) return t;
            const start = t.timingStartedAtMs;
            if (!start) return t;
            const elapsedSec = Math.max(1, Math.round((now - start) / 1000));
            const nextSpent = (t.timeSpentSec ?? 0) + elapsedSec;
            return mergeTopicStatus({
              ...t,
              timingStartedAtMs: undefined,
              timeSpentSec: nextSpent,
            });
          }),
        }));
      },
      setTopicTimerTarget: (id, targetSec) => {
        set((s) => ({
          topics: s.topics.map((t) => {
            if (t.id !== id) return t;
            return {
              ...t,
              timerTargetSec: targetSec,
              timerTargetReachedNotified: false,
            };
          }),
        }));
      },
      markTopicTimerTargetNotified: (id) => {
        set((s) => ({
          topics: s.topics.map((t) =>
            t.id === id ? { ...t, timerTargetReachedNotified: true } : t
          ),
        }));
      },
      toggleTimerSound: () => {
        set((s) => ({ timerSoundEnabled: !s.timerSoundEnabled }));
      },
      removeTopic: (id) => {
        set((s) => ({
          topics: s.topics.filter((t) => t.id !== id),
        }));
      },
      postponeTopicToTomorrow: (id) => {
        const dk = tomorrowDateKey();
        set((s) => ({
          topics: s.topics.map((t) =>
            t.id === id ? mergeTopicStatus({ ...t, dateKey: dk }) : t
          ),
        }));
      },
      getTopic: (id) => {
        const t = get().topics.find((x) => x.id === id);
        return t ? mergeTopicStatus(t) : undefined;
      },
      getTodayTopics: () => {
        const dk = todayDateKey();
        return dedupeTopicsById(
          get()
            .topics.filter((t) => t.dateKey === dk)
            .map(mergeTopicStatus)
            .sort((a, b) => a.title.localeCompare(b.title, "ru"))
        );
      },
      getSortedDateKeys: () => {
        const keys = new Set(get().topics.map((t) => t.dateKey));
        return Array.from(keys).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
      },
      getTopicsByDateKey: (dateKey) =>
        dedupeTopicsById(
          get()
            .topics.filter((t) => t.dateKey === dateKey)
            .map(mergeTopicStatus)
            .sort((a, b) => a.title.localeCompare(b.title, "ru"))
        ),
      getActiveDateKeys: () => {
        const keys = new Set(
          get()
            .topics.map(mergeTopicStatus)
            .filter((t) => deriveTopicStatus(t) === "done")
            .map((t) => t.dateKey)
        );
        return Array.from(keys).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
      },
      getCurrentStreakDays: () => {
        const active = new Set(get().getActiveDateKeys());
        let streak = 0;
        const d = new Date();
        while (true) {
          const key = formatDateKey(d);
          if (!active.has(key)) break;
          streak += 1;
          d.setDate(d.getDate() - 1);
        }
        return streak;
      },
      savePeriodReport: (row) => {
        set((s) => ({
          periodReports: [
            {
              id: newTopicId(),
              createdAt: new Date().toISOString(),
              ...row,
            },
            ...s.periodReports,
          ],
        }));
      },
      removePeriodReport: (id) => {
        set((s) => ({
          periodReports: s.periodReports.filter((r) => r.id !== id),
        }));
      },
    }),
    {
      name: "dofamy-session",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        topics: s.topics,
        periodReports: s.periodReports,
        timerSoundEnabled: s.timerSoundEnabled,
      }),
      /** После загрузки из AsyncStorage убираем дубликаты id (раньше модель копировала один uuid из примера). */
      onRehydrateStorage: () => (state, error) => {
        if (error || !state?.topics?.length) return;
        const next = dedupeTopicsById(state.topics);
        if (next.length === state.topics.length) return;
        useSessionStore.setState({ topics: next });
      },
    }
  )
);
