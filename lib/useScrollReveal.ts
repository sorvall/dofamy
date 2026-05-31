import { useCallback, useRef } from "react";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const BOTTOM_THRESHOLD = 32;
const ANIM_MS = 240;

function isAtBottom(y: number, contentH: number, viewH: number) {
  if (viewH <= 0 || contentH <= 0) return false;
  const scrollable = contentH > viewH + 1;
  return !scrollable || y + viewH >= contentH - BOTTOM_THRESHOLD;
}

/** Показывает плашку только когда список долистан до самого низа. */
export function useScrollReveal() {
  const visible = useSharedValue(0);
  const scrollY = useRef(0);
  const viewH = useRef(0);
  const contentH = useRef(0);

  const sync = useCallback(() => {
    const atBottom = isAtBottom(scrollY.current, contentH.current, viewH.current);
    const next = atBottom ? 1 : 0;
    if (visible.value !== next) {
      visible.value = withTiming(next, { duration: ANIM_MS });
    }
  }, [visible]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      scrollY.current = contentOffset.y;
      viewH.current = layoutMeasurement.height;
      contentH.current = contentSize.height;
      sync();
    },
    [sync]
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewH.current = e.nativeEvent.layout.height;
      sync();
    },
    [sync]
  );

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      contentH.current = h;
      sync();
    },
    [sync]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateY: (1 - visible.value) * 88 }],
  }));

  return { onScroll, onLayout, onContentSizeChange, animatedStyle };
}
