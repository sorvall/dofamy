import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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

import { DayPickerCalendar } from "../../components/DayPickerCalendar";
import { SCREEN_HORIZONTAL_PADDING } from "../../components/ScreenHeader";
import { ReportMarkdownText } from "../../components/ReportMarkdownText";
import { TopicCard } from "../../components/TopicCard";
import { VoiceRecorder } from "../../components/VoiceRecorder";
import { buildDayReportTasksJson, fetchDayClosingReflection } from "../../lib/dayReport";
import { extractTopicsFromTranscript } from "../../lib/deepseek";
import { datePillRu, dateTitleRu, futureDayLabelRu, isFutureKey, isTodayKey, todayDateKey } from "../../lib/dateKey";
import { transcribeAudio } from "../../lib/speechkit";
import { userAlert } from "../../lib/userAlert";
import { useSessionStore } from "../../stores/sessionStore";
import { enumerateDateKeys, fetchPeriodReflection } from "../../lib/periodReport";
import type { SavedPeriodReport } from "../../stores/sessionStore";

type CalendarInnerTab = "days" | "reports";
type RangeField = "start" | "end";

function reportDateLabel(startDate: string, endDate: string): string {
  if (startDate === endDate) return startDate;
  return `${startDate} — ${endDate}`;
}

export default function CalendarScreen() {
  const router = useRouter();
  const [innerTab, setInnerTab] = useState<CalendarInnerTab>("days");
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey);
  const topics = useSessionStore((s) => s.getTopicsByDateKey(selectedDateKey));
  const sortedDateKeys = useSessionStore((s) => s.getSortedDateKeys());
  const activeDateKeys = useSessionStore((s) => s.getActiveDateKeys());
  const streakDays = useSessionStore((s) => s.getCurrentStreakDays());
  const periodReports = useSessionStore((s) => s.periodReports);
  const getTopicsByDateKey = useSessionStore((s) => s.getTopicsByDateKey);
  const appendTopics = useSessionStore((s) => s.appendTopicsFromClaude);
  const savePeriodReport = useSessionStore((s) => s.savePeriodReport);
  const [planBusy, setPlanBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState("Отчёт за день");
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [rangeField, setRangeField] = useState<RangeField>("start");
  const [rangeStartDate, setRangeStartDate] = useState(todayDateKey());
  const [rangeEndDate, setRangeEndDate] = useState(todayDateKey());
  const [periodBusy, setPeriodBusy] = useState(false);
  const isToday = isTodayKey(selectedDateKey);
  const isFuture = isFutureKey(selectedDateKey);

  const planCaption = useMemo(() => {
    const future = futureDayLabelRu(selectedDateKey);
    if (future) return `Запишите план на ${future}`;
    if (isToday) return "Запишите план на сегодня";
    return `Запишите план на ${datePillRu(selectedDateKey)}`;
  }, [isToday, selectedDateKey]);

  const onVoicePlanDone = useCallback(
    async (uri: string) => {
      setPlanBusy(true);
      try {
        const text = await transcribeAudio(uri);
        const parsed = await extractTopicsFromTranscript(
          text,
          topics.map((t) => ({ title: t.title }))
        );
        if (parsed.length === 0) {
          userAlert(
            "Задачи не найдены",
            `Расшифровка: «${text.slice(0, 120)}${text.length > 120 ? "…" : ""}»\n\nНазовите хотя бы одну цель или дело на этот день.`
          );
          return;
        }
        appendTopics(parsed, selectedDateKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
        userAlert("Не получилось обработать запись", msg);
      } finally {
        setPlanBusy(false);
      }
    },
    [appendTopics, selectedDateKey, topics]
  );

  const onDayReport = useCallback(async () => {
    if (topics.length === 0) {
      Alert.alert("Нет карточек", "На этот день нет задач — нечего отправлять в отчёт.");
      return;
    }
    setReportBusy(true);
    setReportText(null);
    try {
      const tasks = buildDayReportTasksJson(topics);
      const text = await fetchDayClosingReflection(tasks, selectedDateKey);
      setReportTitle("Отчёт за день");
      setReportText(text);
      setReportModalOpen(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
      Alert.alert("Не удалось получить отчёт", msg);
    } finally {
      setReportBusy(false);
    }
  }, [topics, selectedDateKey]);

  const onSelectRangeDate = useCallback(
    (dateKey: string) => {
      if (rangeField === "start") {
        setRangeStartDate(dateKey);
      } else {
        setRangeEndDate(dateKey);
      }
    },
    [rangeField]
  );

  const selectedRangeDate = rangeField === "start" ? rangeStartDate : rangeEndDate;

  const onExportPeriodReport = useCallback(async () => {
    const dateKeys = enumerateDateKeys(rangeStartDate, rangeEndDate);
    if (dateKeys.length < 3 || dateKeys.length > 30) {
      Alert.alert("Неверный период", "Выбери диапазон от 3 до 30 дней.");
      return;
    }

    const tasksWithDate = dateKeys.flatMap((dk) =>
      buildDayReportTasksJson(getTopicsByDateKey(dk)).map((t) => ({ ...t, dateKey: dk }))
    );
    if (tasksWithDate.length === 0) {
      Alert.alert("Нет данных", "За выбранный период нет карточек.");
      return;
    }

    const totalCompleted = tasksWithDate.filter((t) => t.completed).length;
    setPeriodBusy(true);
    try {
      const { text } = await fetchPeriodReflection({
        startDate: dateKeys[0] ?? rangeStartDate,
        endDate: dateKeys[dateKeys.length - 1] ?? rangeEndDate,
        daysCount: dateKeys.length,
        totalCompleted,
        streak: streakDays,
        tasks: tasksWithDate,
      });

      savePeriodReport({
        startDate: dateKeys[0] ?? rangeStartDate,
        endDate: dateKeys[dateKeys.length - 1] ?? rangeEndDate,
        daysCount: dateKeys.length,
        totalCompleted,
        streak: streakDays,
        text,
      });
      setRangeModalOpen(false);
      setReportTitle("Отчёт за период");
      setReportText(text);
      setReportModalOpen(true);
      setInnerTab("reports");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
      Alert.alert("Не удалось выгрузить отчёт", msg);
    } finally {
      setPeriodBusy(false);
    }
  }, [getTopicsByDateKey, rangeEndDate, rangeStartDate, savePeriodReport, streakDays]);

  const onOpenSavedReport = useCallback((row: SavedPeriodReport) => {
    setReportTitle(`Отчёт за ${reportDateLabel(row.startDate, row.endDate)}`);
    setReportText(row.text);
    setReportModalOpen(true);
  }, []);

  const reportCards = useMemo(
    () =>
      periodReports.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => onOpenSavedReport(row)}
          className="mb-3 rounded-card border border-line bg-white p-4 active:opacity-90"
        >
          <Text className="font-display text-sm text-ink">{reportDateLabel(row.startDate, row.endDate)}</Text>
          <Text className="mt-1 font-sans text-xs text-muted">
            {row.daysCount} дн. · выполнено {row.totalCompleted} · серия {row.streak}
          </Text>
          <Text className="mt-2 font-sans text-sm leading-6 text-ink" numberOfLines={3}>
            {row.text}
          </Text>
        </Pressable>
      )),
    [onOpenSavedReport, periodReports]
  );

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 36, paddingHorizontal: SCREEN_HORIZONTAL_PADDING }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mt-1 text-center font-display-semibold text-2xl text-ink">Календарь</Text>
        <Text className="mt-1 text-center font-sans text-sm text-muted">
          {isToday ? "Сегодня" : dateTitleRu(selectedDateKey)}
        </Text>
        <View className="mt-2 items-center">
          <View className="rounded-full border border-line bg-teal-soft px-3 py-1">
            <Text className="font-sans-semibold text-xs text-success-dark">
              серия: {streakDays} {streakDays === 1 ? "день" : streakDays < 5 ? "дня" : "дней"}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row rounded-full border border-line bg-white p-1">
          <Pressable
            onPress={() => setInnerTab("days")}
            className={`flex-1 items-center rounded-full py-2 ${innerTab === "days" ? "bg-accent" : ""}`}
          >
            <Text className={`font-sans-semibold text-xs ${innerTab === "days" ? "text-ink" : "text-muted"}`}>
              Календарь
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setInnerTab("reports")}
            className={`flex-1 items-center rounded-full py-2 ${innerTab === "reports" ? "bg-accent" : ""}`}
          >
            <Text className={`font-sans-semibold text-xs ${innerTab === "reports" ? "text-ink" : "text-muted"}`}>
              Отчёты
            </Text>
          </Pressable>
        </View>

        {innerTab === "days" ? (
          <>
            <View className="mt-6">
              <DayPickerCalendar
                selectedDateKey={selectedDateKey}
                markedDateKeys={sortedDateKeys}
                activeDateKeys={activeDateKeys}
                onSelectDateKey={setSelectedDateKey}
              />
            </View>

            <View className="mt-6 pb-2">
              {planBusy ? (
                <Animated.View
                  entering={FadeIn.duration(280)}
                  className="min-h-[120px] items-center justify-center rounded-card border border-line bg-white p-6"
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
                  fabCaption={planCaption}
                  disabled={planBusy}
                  onRecordingComplete={onVoicePlanDone}
                  idleLabel="Записать план"
                  recordingLabel="Говори планы вслух…"
                />
              )}
            </View>

            {topics.length === 0 ? (
              <Animated.View
                entering={FadeIn.delay(80)}
                className="mt-4 rounded-card border border-dashed border-line bg-white/90 p-6"
              >
                <Text className="text-center font-sans text-sm leading-6 text-muted">
                  {isFuture
                    ? "На этот день пока нет карточек. Нажми на микрофон выше и запиши план голосом."
                    : "На этот день нет карточек. Запиши план голосом с помощью кнопки выше."}
                </Text>
              </Animated.View>
            ) : (
              <View className="mt-8">
                <Text className="mb-3 font-display-semibold text-lg text-ink">Задачи</Text>
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

            <View className="mt-6">
              <Pressable
                onPress={() => setRangeModalOpen(true)}
                className="items-center justify-center rounded-[18px] border border-line bg-white py-3.5 active:opacity-90"
              >
                <Text className="font-display text-sm lowercase text-ink">выгрузить отчёт</Text>
              </Pressable>
              <Text className="mt-1.5 text-center font-sans text-[10px] leading-snug text-muted">
                Выбери период 3–30 дней и получи общий разбор паттернов.
              </Text>
            </View>

            <View className="mt-8">
              <Pressable
                onPress={() => void onDayReport()}
                disabled={reportBusy || isFuture || topics.length === 0}
                className={`items-center justify-center rounded-[18px] bg-ink py-4 ${
                  reportBusy || isFuture || topics.length === 0 ? "opacity-40" : "active:opacity-90"
                }`}
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
                {isFuture
                  ? "Отчёт доступен только за прошедшие дни с карточками."
                  : "ИИ разберёт карточки выбранного дня и напишет поддерживающий разбор."}
              </Text>
            </View>
          </>
        ) : (
          <View className="mt-6">
            {periodReports.length === 0 ? (
              <View className="rounded-card border border-dashed border-line bg-white/90 p-6">
                <Text className="text-center font-sans text-sm leading-6 text-muted">
                  Здесь будут сохранённые отчёты по периодам. Нажми «Выгрузить отчёт» во вкладке «Календарь».
                </Text>
              </View>
            ) : (
              reportCards
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={rangeModalOpen}
        animationType="slide"
        {...(Platform.OS === "ios" ? ({ presentationStyle: "pageSheet" } as const) : {})}
        onRequestClose={() => setRangeModalOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-paper" edges={["top", "left", "right", "bottom"]}>
          <View className="flex-row items-center justify-between border-b border-line bg-paper px-4 py-3">
            <Text className="font-display-semibold text-lg text-ink">Период отчёта</Text>
            <Pressable
              onPress={() => setRangeModalOpen(false)}
              hitSlop={12}
              className="rounded-full border border-line bg-mist px-4 py-2"
            >
              <Text className="font-sans-semibold text-sm text-ink">Закрыть</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
            <View className="mb-3 flex-row rounded-full border border-line bg-white p-1">
              <Pressable
                onPress={() => setRangeField("start")}
                className={`flex-1 items-center rounded-full py-2 ${rangeField === "start" ? "bg-accent" : ""}`}
              >
                <Text className={`font-sans-semibold text-xs ${rangeField === "start" ? "text-ink" : "text-muted"}`}>
                  Дата начала
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setRangeField("end")}
                className={`flex-1 items-center rounded-full py-2 ${rangeField === "end" ? "bg-accent" : ""}`}
              >
                <Text className={`font-sans-semibold text-xs ${rangeField === "end" ? "text-ink" : "text-muted"}`}>
                  Дата конца
                </Text>
              </Pressable>
            </View>

            <Text className="mb-2 text-center font-sans text-xs text-muted">
              Выбрано: {reportDateLabel(rangeStartDate, rangeEndDate)}
            </Text>
            <DayPickerCalendar
              selectedDateKey={selectedRangeDate}
              markedDateKeys={sortedDateKeys}
              activeDateKeys={activeDateKeys}
              onSelectDateKey={onSelectRangeDate}
            />

            <Pressable
              onPress={() => void onExportPeriodReport()}
              disabled={periodBusy}
              className={`mt-5 items-center justify-center rounded-[18px] bg-ink py-4 ${periodBusy ? "opacity-60" : "active:opacity-90"}`}
            >
              {periodBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-display text-sm lowercase tracking-tight text-white">сформировать отчёт</Text>
              )}
            </Pressable>
            <Text className="mt-2 text-center font-sans text-xs leading-5 text-muted">
              Для анализа нужен диапазон от 3 до 30 дней.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={reportModalOpen}
        animationType="slide"
        {...(Platform.OS === "ios" ? ({ presentationStyle: "pageSheet" } as const) : {})}
        onRequestClose={() => setReportModalOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-paper" edges={["top", "left", "right", "bottom"]}>
          <View className="flex-row items-center justify-between border-b border-line bg-paper px-4 py-3">
            <Text className="font-display-semibold text-lg text-ink">{reportTitle}</Text>
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
