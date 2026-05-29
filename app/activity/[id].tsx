import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { AnchorCamera } from "../../components/AnchorCamera";
import { VoiceRecorder } from "../../components/VoiceRecorder";
import { transcribeAudio } from "../../lib/speechkit";
import { userAlert } from "../../lib/userAlert";
import { mergeTopicStatus, useSessionStore } from "../../stores/sessionStore";

type LiveCameraSlot = "before" | "after" | null;

export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const topicId = typeof id === "string" ? id : id?.[0] ?? "";
  const topicRaw = useSessionStore((s) => s.topics.find((t) => t.id === topicId));
  const topic = topicRaw ? mergeTopicStatus(topicRaw) : undefined;
  const setBefore = useSessionStore((s) => s.setBeforePhoto);
  const setAfter = useSessionStore((s) => s.setAfterPhoto);
  const setVoice = useSessionStore((s) => s.setVoiceTranscript);
  const setManualComplete = useSessionStore((s) => s.setManualComplete);

  const [voiceBusy, setVoiceBusy] = useState(false);
  const [liveCamera, setLiveCamera] = useState<LiveCameraSlot>(null);

  useEffect(() => {
    if (topicRaw) {
      navigation.setOptions({ title: topicRaw.title });
    }
  }, [navigation, topicRaw?.title]);

  const finishTask = useCallback(() => {
    if (!topic) return;
    setManualComplete(topic.id, true);
    setLiveCamera(null);
    router.back();
  }, [router, setManualComplete, topic]);

  if (!topicId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Text className="font-sans text-lg text-muted">Некорректная ссылка.</Text>
      </SafeAreaView>
    );
  }

  if (!topic) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Text className="font-sans text-lg text-muted">Задача не найдена.</Text>
      </SafeAreaView>
    );
  }

  const onVoiceDone = async (uri: string) => {
    setVoiceBusy(true);
    try {
      const text = await transcribeAudio(uri);
      setVoice(topic.id, text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      userAlert("Не удалось расшифровать", msg);
    } finally {
      setVoiceBusy(false);
    }
  };

  const isDone = topic.status === "done";

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["bottom", "left", "right"]}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 44 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      >
        <Animated.View entering={FadeIn.duration(320)}>
          <Text className="mt-2 font-sans text-lg leading-7 text-muted">{topic.description}</Text>
        </Animated.View>

        <SectionTitle n={1} title="Фото «до» — якорь" optional />
        <AnchorCamera
          instruction="Сфотографируй место — это твой якорь"
          existingUri={topic.beforePhotoUri}
          onCapture={(uri) => {
            setBefore(topic.id, uri);
            setLiveCamera(null);
          }}
          sessionActive={liveCamera === "before"}
          onActivateSession={() => setLiveCamera("before")}
        />

        <View className="mt-8">
          <SectionTitle n={2} title="Голосовой отчёт" optional />
          {voiceBusy ? (
            <Animated.View
              entering={FadeIn}
              className="min-h-[88px] items-center justify-center rounded-card border border-line bg-white p-5"
            >
              <ActivityIndicator color="#1A1915" />
              <Text className="mt-3 font-sans-medium text-base text-muted">Расшифровка…</Text>
            </Animated.View>
          ) : (
            <VoiceRecorder
              mode="hold"
              disabled={voiceBusy}
              onRecordingComplete={onVoiceDone}
              recordingLabel="Запись… отпусти, когда закончишь"
            />
          )}
          {topic.voiceTranscript ? (
            <Animated.View
              entering={FadeInDown.delay(40).springify()}
              className="mt-4 rounded-card border border-line bg-white p-5"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.05,
                shadowRadius: 14,
                elevation: 2,
              }}
            >
              <Text className="font-sans-semibold text-xs uppercase tracking-wide text-muted">
                Транскрипция
              </Text>
              <Text className="mt-2 font-sans text-lg leading-7 text-ink">{topic.voiceTranscript}</Text>
            </Animated.View>
          ) : (
            <Text className="mt-3 font-sans text-base text-muted">
              После записи здесь появится текст. Можно перезаписать — зажми кнопку ещё раз.
            </Text>
          )}
        </View>

        <View className="mt-10">
          <SectionTitle n={3} title="Фото «после»" optional />
          <AnchorCamera
            instruction="Сфотографируй результат"
            existingUri={topic.afterPhotoUri}
            onCapture={(uri) => {
              setAfter(topic.id, uri);
              setLiveCamera(null);
            }}
            sessionActive={liveCamera === "after"}
            onActivateSession={() => setLiveCamera("after")}
          />
        </View>

        {isDone ? (
          <Animated.View
            entering={FadeInDown.springify()}
            className="mt-8 rounded-card border border-success/30 bg-white p-5"
            style={{
              shadowColor: "#085041",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <Text className="text-center font-display-semibold text-xl text-success">Готово ✓</Text>
          </Animated.View>
        ) : (
          <View className="mt-10">
            <Pressable
              onPress={finishTask}
              className="items-center justify-center rounded-[18px] bg-ink py-4 active:opacity-90"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 14,
                elevation: 4,
              }}
            >
              <Text className="font-display text-base lowercase tracking-tight text-white">
                закончить задачу
              </Text>
            </Pressable>
            <Text className="mt-2 text-center font-sans text-xs leading-5 text-muted">
              Фото и голосовой отчёт необязательны — можно завершить в любой момент.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ n, title, optional }: { n: number; title: string; optional?: boolean }) {
  return (
    <Animated.View entering={FadeInDown.delay(n * 30).duration(380)} className="mb-3 mt-8 flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-2xl border border-line/60 bg-accent">
        <Text className="font-display-semibold text-lg text-ink">{n}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-display-semibold text-xl text-ink">{title}</Text>
        {optional ? (
          <Text className="mt-0.5 font-sans text-xs text-muted">необязательно</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}
