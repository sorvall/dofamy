import { StyleSheet, type ScrollViewProps, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

type TouchScrollViewProps = ScrollViewProps & { children?: ReactNode };

/**
 * RN Web ScrollView fights touch on interactive children. A plain overflow div scrolls reliably on mobile.
 */
export function TouchScrollView({ children, style, contentContainerStyle }: TouchScrollViewProps) {
  const outer = StyleSheet.flatten(style) as ViewStyle | undefined;
  const inner = StyleSheet.flatten(contentContainerStyle) as ViewStyle | undefined;

  return (
    <div
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
