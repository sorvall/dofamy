import { useCallback, useEffect, useRef, type UIEvent } from "react";
import {
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
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
  onLayout,
  onContentSizeChange,
  scrollEventThrottle = 16,
}: TouchScrollViewProps) {
  const outer = StyleSheet.flatten(style) as ViewStyle | undefined;
  const inner = StyleSheet.flatten(contentContainerStyle) as ViewStyle | undefined;
  const lastEmitRef = useRef(0);
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const emitScroll = useCallback(
    (el: HTMLDivElement) => {
      if (!onScroll) return;
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

  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      emitScroll(e.currentTarget);
    },
    [emitScroll]
  );

  useEffect(() => {
    const outerEl = outerRef.current;
    const innerEl = innerRef.current;
    if (!outerEl) return;

    const notifyLayout = () => {
      onLayout?.({
        nativeEvent: { layout: { x: 0, y: 0, width: outerEl.clientWidth, height: outerEl.clientHeight } },
      } as LayoutChangeEvent);
      if (innerEl && onContentSizeChange) {
        onContentSizeChange(innerEl.scrollWidth, innerEl.scrollHeight);
      }
      emitScroll(outerEl);
    };

    notifyLayout();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(notifyLayout) : null;
    ro?.observe(outerEl);
    if (innerEl) ro?.observe(innerEl);

    return () => ro?.disconnect();
  }, [emitScroll, onContentSizeChange, onLayout]);

  return (
    <div
      ref={outerRef}
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
      <div ref={innerRef} style={inner as object}>
        {children}
      </div>
    </div>
  );
}
