import type { ReactNode } from "react";
import { Text, View } from "react-native";

/** Горизонтальные отступы экранов вкладок (совпадает с SafeArea + визуальный ритм). */
export const SCREEN_HORIZONTAL_PADDING = 24;

interface ScreenHeaderProps {
  title: string;
  trailing?: ReactNode;
}

export function ScreenHeader({ title, trailing }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center justify-between gap-4 pb-5 pt-2">
      <Text
        className="flex-1 font-display-semibold text-[22px] lowercase tracking-tight text-ink"
        style={{ letterSpacing: -0.4 }}
      >
        {title}
      </Text>
      {trailing ? <View className="shrink-0">{trailing}</View> : null}
    </View>
  );
}
