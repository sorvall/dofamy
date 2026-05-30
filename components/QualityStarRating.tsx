import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { qualityLabelRu } from "../lib/qualityLabel";
import { useSessionStore } from "../stores/sessionStore";

const STAR = "#F5C842";
const STAR_OFF = "#D3D1C7";

function scoreToStars(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score * 5)));
}

function starsToScore(stars: number): number {
  return Math.max(0.2, Math.min(1, stars / 5));
}

interface QualityStarRatingProps {
  topicId: string;
  score?: number;
}

export function QualityStarRating({ topicId, score }: QualityStarRatingProps) {
  const setQualityScore = useSessionStore((s) => s.setQualityScore);
  const rated = typeof score === "number";
  const activeStars = rated ? scoreToStars(score) : 0;

  const onRate = useCallback(
    (stars: number) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setQualityScore(topicId, starsToScore(stars));
    },
    [setQualityScore, topicId]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>
        {rated ? "Качество выполнения" : "Оцените качество выполнения"}
      </Text>
      {!rated ? (
        <Text style={styles.hint}>Нажми на звёзды — от 1 до 5</Text>
      ) : (
        <Text style={styles.hintDone}>{qualityLabelRu(score)}</Text>
      )}
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = rated ? n <= activeStars : false;
          return (
            <Pressable
              key={n}
              onPress={() => onRate(n)}
              disabled={rated}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`${n} из 5`}
              accessibilityState={{ selected: filled, disabled: rated }}
              style={styles.starBtn}
              {...({ dataSet: { noCardOpen: "true" } } as object)}
            >
              <MaterialIcons name={filled ? "star" : "star-border"} size={32} color={filled ? STAR : STAR_OFF} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
  },
  caption: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#8C8A82",
  },
  hint: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 13,
    color: "#1A1915",
  },
  hintDone: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1915",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  starBtn: {
    padding: 2,
  },
});
