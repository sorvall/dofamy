import { useCallback, useRef, type UIEvent } from "react";
import { StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

type TouchScrollViewProps = ScrollViewProps & { children?: ReactNode };

/**
 * RN Web ScrollView fights touch on interactive children. A plain overflow div scrolls reliably on mobile.
 */
export function TouchScrollView({
  children,
  style,
  contentContainerStyle,
  onScroll,
  scrollEventThrottle = 16,
}: TouchScrollViewProps) {
  const outer = StyleSheet.flatten(style) as ViewStyle | undefined;
  const inner = StyleSheet.flatten(contentContainerStyle) as ViewStyle | undefined;
  const lastEmitRef = useRef(0);

  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      if (!onScroll) return;
      const el = e.currentTarget;
      const now = Date.now();
      if (scrollEventThrottle > 0 && now - lastEmitRef.current < scrollEventThrottle) {
        return;
      }
      lastEmitRef.current = now;

      onScroll({
        nativeEvent: {
          contentOffset: { x: el.scrollLeft, y: el.scrollTop },
          contentSize: { width: el.scrollWidth, height: el.scrollHeight },
          layoutMeasurement: { width: el.clientWidth, height: el.clientHeight },
        },
      } as NativeSyntheticEvent<NativeScrollEvent>);
    },
    [onScroll, scrollEventThrottle]
  );

  return (
    <div
      onScroll={handleScroll}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        ...(outer as object),
      }}
    >
      <div style={inner as object}>{children}</div>
    </div>
  );
}
