import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { HeroOrbs } from "./HeroOrbs";

const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=720&q=80&auto=format&fit=crop";

interface HeroCardProps {
  title: string;
  subtitle: string;
  /** Декоративное фото (по умолчанию — ненавязчивая «командная» иллюстрация) */
  imageUri?: string;
  /** Доп. контент под подзаголовком (кнопки и т.д.) */
  children?: ReactNode;
}

/**
 * Шапка в духе свежего Яндекс-UI: мягкий градиент, «живые» пятна, фото как акцент.
 */
export function HeroCard({ title, subtitle, imageUri, children }: HeroCardProps) {
  const uri = imageUri ?? DEFAULT_HERO_IMAGE;
  return (
    <Animated.View entering={FadeIn.duration(420)} style={styles.wrap}>
      <LinearGradient
        colors={["#FFFFFF", "#F5F3EE", "#ECEAE4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <HeroOrbs />
      <Image
        source={{ uri }}
        style={styles.heroPhoto}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.94)", "rgba(245,243,238,0.72)", "rgba(236,234,228,0.4)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.inner}>
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </Animated.View>
        {children ? <View style={styles.children}>{children}</View> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8E5DC",
    minHeight: 200,
  },
  heroPhoto: {
    position: "absolute",
    right: -24,
    top: -8,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.55,
  },
  inner: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    zIndex: 2,
  },
  title: {
    fontFamily: "Unbounded_600SemiBold",
    fontSize: 26,
    letterSpacing: -0.6,
    color: "#1A1915",
    maxWidth: "78%",
  },
  subtitle: {
    marginTop: 10,
    fontFamily: "GolosText_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "#8C8A82",
    maxWidth: "92%",
  },
  children: {
    marginTop: 16,
  },
});
