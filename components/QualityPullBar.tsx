import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { qualityLabelRu } from "../lib/qualityLabel";
import { useSessionStore } from "../stores/sessionStore";

const THUMB = 28;
const TRACK_H = 44;
const SUCCESS = "#1D9E75";

function clamp01(v: number): number {
  "worklet";
  return Math.max(0, Math.min(1, v));
}

function clamp01js(v: number): number {
  return Math.max(0, Math.min(1, v));
}

interface QualityPullBarProps {
  topicId: string;
  score?: number;
}

/**
 * Шкала качества для выполненных задач: после отпускания ползунка — круг с галочкой;
 * по нажатию на галочку оценка сохраняется и шкала блокируется.
 */
export function QualityPullBar({ topicId, score }: QualityPullBarProps) {
  const setQualityScore = useSessionStore((s) => s.setQualityScore);
  const trackW = useSharedValue(1);
  const progress = useSharedValue(score ?? 0.5);
  const lastDragRef = useRef(score ?? 0.5);

  const [locked, setLocked] = useState(() => typeof score === "number");
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [label, setLabel] = useState(() => qualityLabelRu(score ?? 0.5));
  const [pct, setPct] = useState(() => Math.round((score ?? 0.5) * 100));

  const syncDisplay = useCallback((p: number) => {
    const v = clamp01js(p);
    setLabel(qualityLabelRu(v));
    setPct(Math.round(v * 100));
  }, []);

  useEffect(() => {
    const p = score ?? 0.5;
    progress.value = p;
    lastDragRef.current = p;
    syncDisplay(p);
    setLocked(typeof score === "number");
    setPendingConfirm(false);
  }, [score, syncDisplay]);

  const onTrackLayout = useCallback(
    (e: LayoutChangeEvent) => {
      trackW.value = Math.max(1, e.nativeEvent.layout.width);
    },
    [trackW]
  );

  const onDragStart = useCallback(() => {
    if (!locked) {
      setPendingConfirm(false);
    }
  }, [locked]);

  const onDragEnd = useCallback(
    (p: number) => {
      if (locked) return;
      const v = clamp01js(Math.round(p * 100) / 100);
      lastDragRef.current = v;
      syncDisplay(v);
      setPendingConfirm(true);
    },
    [locked, syncDisplay]
  );

  const onConfirmPress = useCallback(() => {
    if (locked || !pendingConfirm) return;
    const v = clamp01js(Math.round(lastDragRef.current * 100) / 100);
    setQualityScore(topicId, v);
    setLocked(true);
    setPendingConfirm(false);
    syncDisplay(v);
  }, [locked, pendingConfirm, setQualityScore, syncDisplay, topicId]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!locked)
        .activeOffsetX([-18, 18])
        .failOffsetY([-14, 14])
        .onStart(() => {
          runOnJS(onDragStart)();
        })
        .onUpdate((e) => {
          "worklet";
          const w = Math.max(1, trackW.value);
          progress.value = clamp01(e.x / w);
          runOnJS(syncDisplay)(progress.value);
        })
        .onEnd(() => {
          "worklet";
          const p = progress.value;
          runOnJS(onDragEnd)(p);
        }),
    [locked, onDragEnd, onDragStart, syncDisplay]
  );

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const thumbStyle = useAnimatedStyle(() => {
    const w = Math.max(1, trackW.value);
    const span = Math.max(0, w - THUMB);
    return {
      transform: [{ translateX: progress.value * span }],
    };
  });

  const showCheckThumb = pendingConfirm && !locked;
  const thumbVisualLocked = locked;

  return (
    <View style={[styles.wrap, locked && styles.wrapLocked]}>
      <Text style={styles.caption}>Качество выполнения</Text>
      {!locked ? (
        <Text style={styles.hint}>
          {pendingConfirm ? "Нажми галочку, чтобы зафиксировать оценку" : "Потяни ползунок по шкале"}
        </Text>
      ) : (
        <View style={styles.hintSpacerLocked} />
      )}
      {Platform.OS !== "web" ? (
        <GestureDetector gesture={panGesture}>
          <View
            style={[styles.track, locked && styles.trackDisabled]}
            collapsable={false}
            onLayout={onTrackLayout}
            pointerEvents={locked ? "none" : "auto"}
          >
            <View style={styles.trackBg} />
            <Animated.View style={[styles.fillClip, fillStyle]}>
              <LinearGradient
                colors={["rgba(29, 158, 117, 0.42)", "rgba(245, 200, 66, 0.55)"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Animated.View style={[styles.thumb, thumbStyle, (showCheckThumb || thumbVisualLocked) && styles.thumbCheck]}>
              {showCheckThumb ? (
                <Pressable
                  onPress={onConfirmPress}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Зафиксировать оценку качества"
                  style={styles.thumbCheckInner}
                >
                  <MaterialIcons name="check" size={18} color="#FFFFFF" />
                </Pressable>
              ) : thumbVisualLocked ? (
                <View style={styles.thumbCheckInner}>
                  <MaterialIcons name="check" size={18} color="#FFFFFF" />
                </View>
              ) : (
                <View style={styles.thumbInner} />
              )}
            </Animated.View>
          </View>
        </GestureDetector>
      ) : (
        <View
          style={[styles.track, locked && styles.trackDisabled]}
          className="quality-track"
          collapsable={false}
          onLayout={onTrackLayout}
          pointerEvents={locked ? "none" : "auto"}
        >
          <View style={styles.trackBg} />
          <Animated.View style={[styles.fillClip, fillStyle]}>
            <LinearGradient
              colors={["rgba(29, 158, 117, 0.42)", "rgba(245, 200, 66, 0.55)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View style={[styles.thumb, thumbStyle, (showCheckThumb || thumbVisualLocked) && styles.thumbCheck]}>
            {showCheckThumb ? (
              <Pressable
                onPress={onConfirmPress}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Зафиксировать оценку качества"
                style={styles.thumbCheckInner}
              >
                <MaterialIcons name="check" size={18} color="#FFFFFF" />
              </Pressable>
            ) : thumbVisualLocked ? (
              <View style={styles.thumbCheckInner}>
                <MaterialIcons name="check" size={18} color="#FFFFFF" />
              </View>
            ) : (
              <View style={styles.thumbInner} />
            )}
          </Animated.View>
        </View>
      )}
      <View style={styles.metaRow}>
        <Text style={[styles.label, locked && styles.metaMuted]}>{label}</Text>
        <Text style={[styles.percent, locked && styles.metaMuted]}>{pct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
  },
  wrapLocked: {
    opacity: 0.92,
  },
  caption: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#8C8A82",
  },
  hint: {
    marginTop: 2,
    fontSize: 12,
    color: "#8C8A82",
    marginBottom: 10,
  },
  hintSpacerLocked: {
    height: 10,
    marginBottom: 10,
  },
  track: {
    height: TRACK_H,
    justifyContent: "center",
    position: "relative",
  },
  trackDisabled: {
    opacity: 0.72,
  },
  trackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#E8E5DC",
    borderRadius: TRACK_H / 2,
  },
  fillClip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_H / 2,
    overflow: "hidden",
  },
  thumb: {
    position: "absolute",
    left: 0,
    top: (TRACK_H - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 2,
  },
  thumbCheck: {
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
  thumbInner: {
    width: THUMB - 4,
    height: THUMB - 4,
    borderRadius: (THUMB - 4) / 2,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "rgba(29, 158, 117, 0.4)",
  },
  thumbCheckInner: {
    width: THUMB - 2,
    height: THUMB - 2,
    borderRadius: (THUMB - 2) / 2,
    backgroundColor: SUCCESS,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1915",
  },
  percent: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8C8A82",
  },
  metaMuted: {
    opacity: 0.85,
  },
});
