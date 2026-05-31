import { useCallback, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const SCROLL_DELTA = 8;
const TOP_HIDE_Y = 20;
const ANIM_MS = 240;

/** Показывает плашку при скролле вверх, скрывает при скролле вниз (и у верхнего края). */
export function useScrollReveal() {
  const lastY = useRef(0);
  const visible = useSharedValue(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastY.current;
      lastY.current = y;

      if (y <= TOP_HIDE_Y) {
        if (visible.value !== 0) {
          visible.value = withTiming(0, { duration: ANIM_MS });
        }
        return;
      }

      if (dy > SCROLL_DELTA) {
        visible.value = withTiming(0, { duration: ANIM_MS });
      } else if (dy < -SCROLL_DELTA) {
        visible.value = withTiming(1, { duration: ANIM_MS });
      }
    },
    [visible]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateY: (1 - visible.value) * 88 }],
  }));

  return { onScroll, animatedStyle };
}
