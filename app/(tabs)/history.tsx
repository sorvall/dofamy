import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { HeroCard } from "../../components/brand/HeroCard";
import { TopicCard } from "../../components/TopicCard";
import { useSessionStore } from "../../stores/sessionStore";

const HISTORY_IMAGE =
  "https://images.unsplash.com/photo-1484480974693-6ca0a78b37b7?w=720&q=80&auto=format&fit=crop";

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function HistoryScreen() {
  const router = useRouter();
  const dateKeys = useSessionStore((s) => s.getSortedDateKeys());
  const getTopicsByDateKey = useSessionStore((s) => s.getTopicsByDateKey);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        <HeroCard
          title="История"
          subtitle="Задачи по дням — можно вернуться к любой активности и дорисовать якоря."
          imageUri={HISTORY_IMAGE}
        />

        {dateKeys.length === 0 ? (
          <Animated.View
            entering={FadeIn.duration(320)}
            className="mt-8 rounded-card border border-dashed border-line bg-white/90 p-6"
          >
            <Text className="text-center font-sans text-base text-muted">Пока нет сохранённых дней.</Text>
          </Animated.View>
        ) : (
          dateKeys.map((dk, di) => {
            const dayTopics = getTopicsByDateKey(dk);
            return (
              <Animated.View key={dk} entering={FadeIn.delay(di * 40)} className="mt-10">
                <Text className="mb-3 font-display-semibold text-lg text-ink">{formatDateLabel(dk)}</Text>
                {dayTopics.map((topic, index) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    index={index}
                    onPress={() => router.push(`/activity/${topic.id}`)}
                  />
                ))}
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
