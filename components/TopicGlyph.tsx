import type { ComponentType } from "react";
import { createElement } from "react";
import { Text } from "react-native";

import { isAsciiIconName, resolveLucideTaskIcon } from "../lib/lucideTaskIcons";

type IconProps = { size?: number; color?: string; strokeWidth?: number };

/**
 * «Эмодзи» задачи: имя Lucide (ASCII) через явную карту (Metro не вырезает),
 * иначе — текст/эмодзи для старых данных.
 */
export function TopicGlyph({ glyph, color, size = 22 }: { glyph: string; color: string; size?: number }) {
  const raw = glyph.trim();
  if (isAsciiIconName(raw)) {
    const Icon = resolveLucideTaskIcon(raw) as ComponentType<IconProps>;
    return createElement(Icon, { size, color, strokeWidth: 2 });
  }
  return <Text style={{ fontSize: size, lineHeight: size + 4, color }}>{glyph}</Text>;
}
