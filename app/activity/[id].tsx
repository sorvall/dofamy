import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { AnchorCamera } from "../../components/AnchorCamera";
import { VoiceRecorder } from "../../components/VoiceRecorder";
import { transcribeAudio } from "../../lib/speechkit";
import { mergeTopicStatus, useSessionStore } from "../../stores/sessionStore";

export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const topicId = typeof id === "string" ? id : id?.[0] ?? "";
  const topicRaw = useSessionStore((s) => s.topics.find((t) => t.id === topicId));
  const topic = topicRaw ? mergeTopicStatus(topicRaw) : undefined;
  const setBefore = useSessionStore((s) => s.setBeforePhoto);
  const setAfter = useSessionStore((s) => s.setAfterPhoto);
  const setVoice = useSessionStore((s) => s.setVoiceTranscript);

  const [voiceBusy, setVoiceBusy] = useState(false);

  useEffect(() => {
    if (topicRaw) {
      navigation.setOptions({ title: topicRaw.title });
    }
  }, [navigation, topicRaw?.title]);

  const section2Locked = useMemo(() => !topic?.beforePhotoUri, [topic?.beforePhotoUri]);

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
      Alert.alert("Не удалось расшифровать", msg);
    } finally {
      setVoiceBusy(false);
    }
  };

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

        <SectionTitle n={1} title="Фото «до» — якорь" />
        <AnchorCamera
          instruction="Сфотографируй место — это твой якорь"
          existingUri={topic.beforePhotoUri}
          onCapture={(uri) => setBefore(topic.id, uri)}
        />

        <View
          className={section2Locked ? "mt-8 opacity-45" : "mt-8"}
          pointerEvents={section2Locked ? "none" : "auto"}
        >
          <SectionTitle n={2} title="Голосовой отчёт" />
          {section2Locked ? (
            <Text className="mb-3 font-sans text-base text-muted">
              Сначала сделай фото «до», чтобы перейти к отчёту.
            </Text>
          ) : null}
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
              disabled={section2Locked || voiceBusy}
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
          <SectionTitle n={3} title="Фото «после»" />
          {/*
            Две CameraView на экране одновременно ломают превью (одна нативная сессия).
            Камеру «после» монтируем только после фото «до».
          */}
          {topic.beforePhotoUri ? (
            <AnchorCamera
              instruction="Сфотографируй результат"
              existingUri={topic.afterPhotoUri}
              onCapture={(uri) => setAfter(topic.id, uri)}
            />
          ) : (
            <View className="aspect-[4/3] w-full items-center justify-center rounded-card border border-line bg-mist px-4">
              <Text className="text-center font-sans text-base leading-6 text-muted">
                Сначала сделай фото «до» выше. Здесь появится камера для кадра «после», когда якорь будет готов.
              </Text>
            </View>
          )}
        </View>

        {topic.status === "done" ? (
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
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <Animated.View entering={FadeInDown.delay(n * 30).duration(380)} className="mb-3 mt-8 flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-2xl border border-line/60 bg-accent">
        <Text className="font-display-semibold text-lg text-ink">{n}</Text>
      </View>
      <Text className="flex-1 font-display-semibold text-xl text-ink">{title}</Text>
    </Animated.View>
  );
}
