import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeInDown,
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
} from "react-native-reanimated";

import { QualityPullBar } from "./QualityPullBar";
import { ConfirmDialog } from "./ConfirmDialog";
import { TopicGlyph } from "./TopicGlyph";
import { notifyTimerReached } from "../lib/localNotifications";
import type { Topic, TopicStatus } from "../types/topic";
import { useSessionStore } from "../stores/sessionStore";

const INK = "#1A1915";
const SUCCESS = "#1D9E75";
const YELLOW = "#F5C842";
const DOT_OFF = "#D3D1C7";

function emojiTileBg(index: number): string {
  const v = index % 3;
  if (v === 0) return "#FDF3D0";
  if (v === 1) return "#E1F5EE";
  return "#FAECE7";
}
const SWIPE_COMMIT = 48;
const SWIPE_MAX_DRAG = 100;
const SWIPE_ACTION_W = 96;
const TIMER_PRESETS_SEC = [15 * 60, 25 * 60, 45 * 60] as const;

function timerTargetLabelRu(sec?: number): string {
  if (!sec) return "без таймера";
  const mins = Math.round(sec / 60);
  return `${mins} мин`;
}

function nextTimerTarget(current?: number): number | undefined {
  if (!current) return TIMER_PRESETS_SEC[0];
  const idx = TIMER_PRESETS_SEC.indexOf(current as (typeof TIMER_PRESETS_SEC)[number]);
  if (idx === -1) return TIMER_PRESETS_SEC[0];
  if (idx >= TIMER_PRESETS_SEC.length - 1) return undefined;
  return TIMER_PRESETS_SEC[idx + 1];
}

function statusLabelRu(status: TopicStatus): string {
  switch (status) {
    case "not_started":
      return "не начато";
    case "in_progress":
      return "в процессе";
    case "done":
      return "готово";
    default:
      return "не начато";
  }
}

function statusPillClass(status: TopicStatus): string {
  switch (status) {
    case "done":
      return "bg-success-light text-success-dark";
    case "in_progress":
      return "bg-amber-soft text-amber-ink";
    default:
      return "bg-mist text-muted";
  }
}

interface TopicCardProps {
  topic: Topic;
  index: number;
  onPress: () => void;
}

export function TopicCard({ topic, index, onPress }: TopicCardProps) {
  const setManualComplete = useSessionStore((s) => s.setManualComplete);
  const removeTopic = useSessionStore((s) => s.removeTopic);
  const postponeTopicToTomorrow = useSessionStore((s) => s.postponeTopicToTomorrow);
  const startTopicTimer = useSessionStore((s) => s.startTopicTimer);
  const stopTopicTimer = useSessionStore((s) => s.stopTopicTimer);
  const setTopicTimerTarget = useSessionStore((s) => s.setTopicTimerTarget);
  const markTopicTimerTargetNotified = useSessionStore((s) => s.markTopicTimerTargetNotified);
  const timerSoundEnabled = useSessionStore((s) => s.timerSoundEnabled);
  const toggleTimerSound = useSessionStore((s) => s.toggleTimerSound);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  /** Двойной тап открывает меню; одиночный тап открывает активность. */
  const suppressNextNavigateRef = useRef(false);
  const lastTapTsRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beforeDone = Boolean(topic.beforePhotoUri);
  const afterDone = Boolean(topic.afterPhotoUri);
  const isDone = topic.status === "done";
  const isTimerRunning = Boolean(topic.timingStartedAtMs);
  const boostText = topic.boost?.trim() ?? "";
  const timerTargetSec = topic.timerTargetSec;
  const timerTargetReachedNotified = Boolean(topic.timerTargetReachedNotified);
  const spentBaseSec = topic.timeSpentSec ?? 0;
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!isTimerRunning) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isTimerRunning]);

  useEffect(() => {
    if (isTimerRunning) {
      pulse.value = withRepeat(
        withTiming(1.02, { duration: 720, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      return;
    }
    cancelAnimation(pulse);
    pulse.value = withTiming(1, { duration: 180 });
  }, [isTimerRunning, pulse]);

  const elapsedRunningSec =
    isTimerRunning && topic.timingStartedAtMs
      ? Math.max(0, Math.floor((nowMs - topic.timingStartedAtMs) / 1000))
      : 0;
  const totalTrackedSec = spentBaseSec + elapsedRunningSec;

  useEffect(() => {
    if (!isTimerRunning || !timerTargetSec || timerTargetReachedNotified) return;
    if (totalTrackedSec < timerTargetSec) return;
    markTopicTimerTargetNotified(topic.id);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    void notifyTimerReached(
      "Таймер задачи",
      `Время «${topic.title}» (${timerTargetLabelRu(timerTargetSec)}) истекло.`,
      timerSoundEnabled
    ).catch(() => {});
  }, [
    isTimerRunning,
    markTopicTimerTargetNotified,
    timerTargetReachedNotified,
    timerTargetSec,
    timerSoundEnabled,
    topic.id,
    topic.title,
    totalTrackedSec,
  ]);

  const cardMotionStyle = useAnimatedStyle(() => {
    const drag = Math.abs(translateX.value);
    const lift = Math.min(0.12, drag / 900);
    return {
      transform: [{ translateX: translateX.value }, { scale: scale.value * pulse.value }],
      shadowOpacity: 0.07 + lift,
      shadowRadius: 20 + drag * 0.08,
      elevation: 4 + Math.min(6, drag / 25),
    };
  });

  const doneRevealStyle = useAnimatedStyle(() => {
    const x = translateX.value;
    if (x <= 0) return { opacity: 0 };
    return {
      opacity: interpolate(x, [0, 14, SWIPE_COMMIT], [0, 0.6, 1], Extrapolation.CLAMP),
    };
  });

  const deleteRevealStyle = useAnimatedStyle(() => {
    const x = translateX.value;
    if (x >= 0) return { opacity: 0 };
    return {
      opacity: interpolate(x, [0, -14, -SWIPE_COMMIT], [0, 0.6, 1], Extrapolation.CLAMP),
    };
  });

  const markDone = useCallback(() => {
    setManualComplete(topic.id, true);
  }, [setManualComplete, topic.id]);

  const swipeDeleteTopic = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    removeTopic(topic.id);
  }, [removeTopic, topic.id]);

  const openDeleteDialog = useCallback(() => {
    setMenuOpen(false);
    setDeleteDialogOpen(true);
  }, []);

  const confirmSwipeDelete = useCallback(() => {
    translateX.value = withSpring(0, { damping: 20, stiffness: 260 });
    openDeleteDialog();
  }, [openDeleteDialog, translateX]);

  const onConfirmDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    swipeDeleteTopic();
  }, [swipeDeleteTopic]);

  const openMenu = useCallback(() => {
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    suppressNextNavigateRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMenuOpen(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      suppressNextNavigateRef.current = false;
    }
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    };
  }, [menuOpen]);

  const handleCardPress = useCallback(() => {
    if (menuOpen) return;

    const now = Date.now();
    if (now - lastTapTsRef.current < 260) {
      lastTapTsRef.current = 0;
      openMenu();
      return;
    }

    lastTapTsRef.current = now;
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }
    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      if (suppressNextNavigateRef.current) {
        suppressNextNavigateRef.current = false;
        return;
      }
      if (isTimerRunning) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        stopTopicTimer(topic.id);
        return;
      }
      onPress();
    }, 270);
  }, [isTimerRunning, menuOpen, onPress, openMenu, stopTopicTimer, topic.id]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(Platform.OS !== "web")
        .activeOffsetX([-24, 24])
        .failOffsetY([-5, 5])
        .onUpdate((e) => {
          "worklet";
          const x = e.translationX;
          translateX.value =
            x > SWIPE_MAX_DRAG
              ? SWIPE_MAX_DRAG + (x - SWIPE_MAX_DRAG) * 0.12
              : x < -SWIPE_MAX_DRAG
                ? -SWIPE_MAX_DRAG + (x + SWIPE_MAX_DRAG) * 0.12
                : x;
        })
        .onEnd((e) => {
          "worklet";
          const x = e.translationX;
          const vx = e.velocityX;
          if (x > SWIPE_COMMIT || (x > 28 && vx > 280)) {
            runOnJS(markDone)();
          } else if (x < -SWIPE_COMMIT || (x < -28 && vx < -280)) {
            runOnJS(confirmSwipeDelete)();
          }
          translateX.value = withSpring(0, { damping: 20, stiffness: 260 });
        }),
    [confirmSwipeDelete, markDone]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(300)
        .maxDistance(12)
        .onEnd((_e, success) => {
          if (success) {
            runOnJS(handleCardPress)();
          }
        }),
    [handleCardPress]
  );

  const cardGestures = useMemo(
    () => Gesture.Exclusive(swipeGesture, tapGesture),
    [swipeGesture, tapGesture]
  );

  const onPostpone = useCallback(() => {
    postponeTopicToTomorrow(topic.id);
    setMenuOpen(false);
  }, [postponeTopicToTomorrow, topic.id]);

  const onToggleTimerFromMenu = useCallback(() => {
    if (isTimerRunning) {
      stopTopicTimer(topic.id);
    } else {
      startTopicTimer(topic.id);
    }
    setMenuOpen(false);
  }, [isTimerRunning, startTopicTimer, stopTopicTimer, topic.id]);

  const onSetTimerTargetFromMenu = useCallback(() => {
    const next = nextTimerTarget(timerTargetSec);
    setTopicTimerTarget(topic.id, next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [setTopicTimerTarget, timerTargetSec, topic.id]);

  const onToggleTimerSound = useCallback(() => {
    toggleTimerSound();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [toggleTimerSound]);

  const timerLabel = useMemo(() => {
    const h = Math.floor(totalTrackedSec / 3600);
    const m = Math.floor((totalTrackedSec % 3600) / 60);
    const s = totalTrackedSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [totalTrackedSec]);

  return (
    <>
      <ConfirmDialog
        visible={deleteDialogOpen}
        title="Удалить план?"
        message={`«${topic.title}» будет убран из планов на сегодня.`}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={onConfirmDelete}
      />

      <Animated.View entering={FadeInDown.delay(index * 70).springify().damping(18)}>
      <View className="relative mb-3">
        {menuOpen ? (
          <Pressable
            accessibilityLabel="Закрыть меню"
            onPress={() => setMenuOpen(false)}
            className="absolute inset-0 z-[15] rounded-card bg-black/25"
          />
        ) : null}
        {menuOpen ? (
          <Animated.View
            entering={FadeIn.duration(160)}
            className="absolute bottom-3 right-3 z-20 overflow-hidden rounded-2xl border border-line bg-white"
            style={styles.popoverShadow}
          >
            {!isDone ? (
              <>
                <Pressable
                  onPress={onSetTimerTargetFromMenu}
                  accessibilityRole="button"
                  accessibilityLabel="Поставить таймер для задачи"
                  className="px-5 py-3.5 active:bg-neutral-50"
                >
                  <Text className="text-base font-semibold text-ink">
                    Поставить таймер: {timerTargetLabelRu(timerTargetSec)}
                  </Text>
                </Pressable>
                <View className="h-px bg-neutral-100" />
                <Pressable
                  onPress={onToggleTimerSound}
                  accessibilityRole="button"
                  accessibilityLabel="Включить или выключить звук таймера"
                  className="px-5 py-3.5 active:bg-neutral-50"
                >
                  <Text className="text-base font-semibold text-ink">
                    Звук таймера: {timerSoundEnabled ? "вкл" : "выкл"}
                  </Text>
                </Pressable>
                <View className="h-px bg-neutral-100" />
                <Pressable
                  onPress={onToggleTimerFromMenu}
                  accessibilityRole="button"
                  accessibilityLabel={isTimerRunning ? "Остановить таймер задачи" : "Начать задачу с таймером"}
                  className="px-5 py-3.5 active:bg-neutral-50"
                >
                  <Text className="text-base font-semibold text-ink">
                    {isTimerRunning ? "Остановить" : "Начать"}
                  </Text>
                </Pressable>
                <View className="h-px bg-neutral-100" />
              </>
            ) : null}
            <Pressable
              onPress={onPostpone}
              accessibilityRole="button"
              accessibilityLabel="Перенести задачу на завтра"
              className="px-5 py-3.5 active:bg-neutral-50"
            >
              <Text className="text-base font-semibold text-ink">Перенести на завтра</Text>
            </Pressable>
            <View className="h-px bg-neutral-100" />
            <Pressable
              onPress={openDeleteDialog}
              accessibilityRole="button"
              accessibilityLabel="Удалить план"
              className="px-5 py-3.5 active:bg-neutral-50"
            >
              <Text className="text-base font-semibold text-coral">Удалить план</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <View className="overflow-hidden rounded-card border border-line bg-line">
        <View pointerEvents="none" className="absolute inset-0 flex-row overflow-hidden rounded-card bg-line">
          <Animated.View
            className="h-full items-center justify-center"
            style={[
              { width: SWIPE_ACTION_W, backgroundColor: "rgba(29, 158, 117, 0.96)" },
              doneRevealStyle,
            ]}
          >
            <Text style={styles.swipeHintLeft}>✓</Text>
            <Text style={styles.swipeHintLeftSub}>готово</Text>
          </Animated.View>
          <View className="min-w-0 flex-1 bg-line" />
          <Animated.View
            className="h-full items-center justify-center"
            style={[{ width: SWIPE_ACTION_W, backgroundColor: "#FAECE7" }, deleteRevealStyle]}
          >
            <MaterialIcons name="delete-outline" size={28} color="#993C1D" />
            <Text style={styles.swipeDeleteLabel}>удалить</Text>
          </Animated.View>
        </View>

        <GestureDetector gesture={cardGestures}>
          <Animated.View
            className="overflow-hidden rounded-card bg-white"
            style={[
              cardMotionStyle,
              styles.cardSurface,
              {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                borderRadius: 20,
              },
            ]}
          >
              <Pressable
                onPressIn={() => {
                  scale.value = withSpring(0.98, { damping: 15, stiffness: 280 });
                }}
                onPressOut={() => {
                  scale.value = withSpring(1, { damping: 14, stiffness: 260 });
                }}
                className="px-4 pb-4 pt-4"
              >
              {!isDone ? (
                <Pressable
                  onPress={openDeleteDialog}
                  hitSlop={10}
                  accessibilityLabel="Удалить план"
                  accessibilityRole="button"
                  style={styles.deleteIconBtn}
                >
                  <MaterialIcons name="delete-outline" size={18} color="#993C1D" />
                </Pressable>
              ) : null}
              {isDone ? (
                <>
                  <LinearGradient
                    pointerEvents="none"
                    colors={["rgba(29, 158, 117, 0.12)", "rgba(255, 255, 255, 0.04)", "rgba(29, 158, 117, 0.08)"]}
                    locations={[0, 0.42, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFillObject, styles.doneWash]}
                  />
                  <View pointerEvents="none" style={styles.doneBadge}>
                    <Text style={styles.doneBadgeText}>✓</Text>
                  </View>
                </>
              ) : null}

              <View className="flex-row items-start gap-2.5">
                <View
                  className="h-[38px] w-[38px] items-center justify-center rounded-xl"
                  style={{ backgroundColor: emojiTileBg(index) }}
                >
                  <TopicGlyph glyph={topic.emoji} color={INK} size={22} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    className="font-display text-[15px] font-medium leading-5 text-ink"
                    style={{ letterSpacing: -0.2 }}
                    numberOfLines={2}
                  >
                    {topic.title}
                  </Text>
                  <Text className="mt-0.5 font-sans text-[11px] leading-[15px] text-muted" numberOfLines={2}>
                    {topic.description}
                  </Text>
                  {isTimerRunning && boostText ? (
                    <View className="mt-1 self-start rounded-full bg-amber-soft px-2 py-0.5">
                      <Text className="font-sans-semibold text-[10px] text-amber-ink">{boostText}</Text>
                    </View>
                  ) : null}
                </View>
                {isDone ? (
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-success-light">
                    <Text style={{ fontSize: 12, color: SUCCESS, fontWeight: "800" }}>✓</Text>
                  </View>
                ) : totalTrackedSec > 0 || isTimerRunning ? (
                  <View
                    className={`rounded-full px-2 py-1 ${isTimerRunning ? "bg-ink" : "bg-mist"}`}
                    style={isTimerRunning ? styles.timerBadgeRunning : undefined}
                  >
                    <Text className={`font-sans-semibold text-[10px] ${isTimerRunning ? "text-white" : "text-ink"}`}>
                      {timerLabel}
                    </Text>
                  </View>
                ) : (
                  <View className="h-7 w-7 rounded-full bg-mist" />
                )}
              </View>

              <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-line/80 pt-3">
                <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  <View className="flex-row items-center gap-1">
                    <View
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: beforeDone ? SUCCESS : DOT_OFF }}
                    />
                    <Text className="font-sans text-[10px] text-muted">фото до</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <View
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: afterDone ? SUCCESS : DOT_OFF }}
                    />
                    <Text className="font-sans text-[10px] text-muted">фото после</Text>
                  </View>
                </View>
                <View className={`shrink-0 rounded-[10px] px-2.5 py-1 ${statusPillClass(topic.status)}`}>
                  <Text className="font-sans-medium text-[10px] font-medium">{statusLabelRu(topic.status)}</Text>
                </View>
              </View>

              {topic.status === "in_progress" ? (
                <View
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-[20px]"
                  style={{ backgroundColor: YELLOW }}
                />
              ) : null}
            </Pressable>

            {isDone ? (
              <View className="border-t border-line px-3.5 pb-4 pt-2">
                <QualityPullBar topicId={topic.id} score={topic.qualityScore} />
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
        </View>
      </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  cardSurface: {
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  swipeHintLeft: {
    fontSize: 28,
    fontWeight: "800",
    color: "rgba(255,255,255,0.95)",
  },
  swipeHintLeftSub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  swipeDeleteLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#993C1D",
    letterSpacing: 0.2,
    textTransform: "lowercase",
  },
  popoverShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
  timerBadgeRunning: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 5,
  },
  doneWash: {
    borderRadius: 20,
  },
  doneBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(29, 158, 117, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneBadgeText: {
    fontSize: 16,
    fontWeight: "800",
    color: "rgba(8, 80, 65, 0.55)",
  },
  deleteIconBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 5,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAECE7",
  },
});
