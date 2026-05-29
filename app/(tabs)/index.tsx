import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { TopicCard } from "../../components/TopicCard";
import { ScreenHeader, SCREEN_HORIZONTAL_PADDING } from "../../components/ScreenHeader";
import { VoiceRecorder } from "../../components/VoiceRecorder";
import { ReportMarkdownText } from "../../components/ReportMarkdownText";
import { extractTopicsFromTranscript } from "../../lib/deepseek";
import { buildDayReportTasksJson, fetchDayClosingReflection } from "../../lib/dayReport";
import { transcribeAudio } from "../../lib/speechkit";
import { userAlert } from "../../lib/userAlert";
import { datePillRu, todayDateKey } from "../../lib/dateKey";
import { useSessionStore } from "../../stores/sessionStore";

export default function TodayScreen() {
  const router = useRouter();
  const topics = useSessionStore((s) => s.getTodayTopics());
  const appendTopics = useSessionStore((s) => s.appendTopicsFromClaude);
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);

  const onVoiceDone = useCallback(
    async (uri: string) => {
      setBusy(true);
      try {
        const text = await transcribeAudio(uri);
        const parsed = await extractTopicsFromTranscript(
          text,
          topics.map((t) => ({ title: t.title }))
        );
        if (parsed.length === 0) {
          userAlert(
            "Задачи не найдены",
            `Расшифровка: «${text.slice(0, 120)}${text.length > 120 ? "…" : ""}»\n\nНазовите хотя бы одну цель или дело на сегодня — можно и крупное: «запустить проект», «сходить в зал».`
          );
          return;
        }
        appendTopics(parsed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
        userAlert("Не получилось обработать запись", msg);
      } finally {
        setBusy(false);
      }
    },
    [appendTopics, topics]
  );

  const onDayReport = useCallback(async () => {
    if (topics.length === 0) return;
    setReportBusy(true);
    setReportText(null);
    try {
      const tasks = buildDayReportTasksJson(topics);
      const text = await fetchDayClosingReflection(tasks, todayDateKey());
      setReportText(text);
      setReportModalOpen(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
      Alert.alert("Не удалось получить отчёт", msg);
    } finally {
      setReportBusy(false);
    }
  }, [topics]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top", "left", "right"]}>
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 20,
            paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            title="Сегодня"
            trailing={
              <View className="rounded-[20px] bg-line px-3 py-1.5">
                <Text className="font-sans text-[11px] text-muted">{datePillRu(todayDateKey())}</Text>
              </View>
            }
          />

          <View className="pt-2 pb-6">
            {busy ? (
              <Animated.View
                entering={FadeIn.duration(280)}
                className="min-h-[120px] items-center justify-center rounded-card border border-line bg-white p-6"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.06,
                  shadowRadius: 16,
                  elevation: 3,
                }}
              >
                <ActivityIndicator size="large" color="#1A1915" />
                <Text className="mt-4 text-center font-sans-medium text-sm text-muted">
                  SpeechKit и разбор задач…
                </Text>
              </Animated.View>
            ) : (
              <VoiceRecorder
                mode="toggle"
                variant="fab"
                fabCaption="Запишите свои планы на день"
                disabled={busy}
                onRecordingComplete={onVoiceDone}
                idleLabel="Записать план на день"
                recordingLabel="Говори планы вслух…"
              />
            )}
          </View>

          {topics.length === 0 ? (
            <Animated.View
              entering={FadeIn.delay(100)}
              className="mt-10 rounded-card border border-dashed border-line bg-white/90 p-6"
            >
              <Text className="text-center font-sans text-sm leading-6 text-muted">
                Здесь появятся карточки после первой голосовой записи. Другие дни — во вкладке «Календарь».
              </Text>
            </Animated.View>
          ) : (
            <View className="mt-6">
              {topics.map((topic, index) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  index={index}
                  onPress={() => router.push(`/activity/${topic.id}`)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        <View
          className="border-t border-line bg-paper pt-3 pb-2"
          style={{ paddingHorizontal: SCREEN_HORIZONTAL_PADDING }}
        >
          <Pressable
            onPress={() => void onDayReport()}
            disabled={reportBusy || topics.length === 0}
            className={`items-center justify-center rounded-[18px] py-3.5 ${
              topics.length === 0 ? "bg-ink/35" : "bg-ink active:opacity-90"
            } ${reportBusy ? "opacity-60" : ""}`}
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.12,
              shadowRadius: 14,
              elevation: 4,
            }}
          >
            {reportBusy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-display text-sm lowercase tracking-tight text-white">
                отчёт за день
              </Text>
            )}
          </Pressable>
          <Text className="mt-1.5 text-center font-sans text-[10px] leading-snug text-muted">
            ИИ соберёт карточки за сегодня и напишет поддерживающий разбор.
          </Text>
        </View>
      </View>

      <Modal
        visible={reportModalOpen}
        animationType="slide"
        {...(Platform.OS === "ios" ? ({ presentationStyle: "pageSheet" } as const) : {})}
        onRequestClose={() => setReportModalOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-paper" edges={["top", "left", "right", "bottom"]}>
          <View className="flex-row items-center justify-between border-b border-line bg-paper px-4 py-3">
            <Text className="font-display-semibold text-lg text-ink">Отчёт за день</Text>
            <Pressable
              onPress={() => setReportModalOpen(false)}
              hitSlop={12}
              className="rounded-full border border-line bg-mist px-4 py-2"
            >
              <Text className="font-sans-semibold text-sm text-ink">Закрыть</Text>
            </Pressable>
          </View>
          <ScrollView
            className="flex-1 px-4 pt-4"
            contentContainerStyle={{ paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            <ReportMarkdownText text={reportText ?? ""} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
