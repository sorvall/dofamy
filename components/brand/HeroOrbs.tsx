import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

function Orb({
  size,
  top,
  left,
  colors,
  delay,
}: {
  size: number;
  top: number;
  left: number;
  colors: [string, string];
  delay: number;
}) {
  const y = useSharedValue(0);
  const o = useSharedValue(0.55);

  useEffect(() => {
    const t = setTimeout(() => {
      y.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
          withTiming(5, { duration: 2600, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      );
      o.value = withRepeat(
        withSequence(
          withTiming(0.75, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.45, { duration: 2200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, delay);
    return () => {
      clearTimeout(t);
      cancelAnimation(y);
      cancelAnimation(o);
    };
  }, [delay, o, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: o.value,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: "absolute",
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
}

/** Абстрактные «облака» как в промо-иллюстрациях Яндекса */
export function HeroOrbs() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Orb size={120} top={-28} left={-36} colors={["#F5C842", "#FDF3D0"]} delay={0} />
      <Orb size={72} top={72} left={12} colors={["#FFE082", "#FFF59D"]} delay={120} />
      <Orb size={56} top={16} left={160} colors={["#E3F2FD", "#BBDEFB"]} delay={200} />
    </View>
  );
}
