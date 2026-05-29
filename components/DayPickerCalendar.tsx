import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { formatDateKey, parseDateKey, todayDateKey } from "../lib/dateKey";

const INK = "#1A1915";
const WEEK = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function monthMatrix(year: number, monthIndex: number): (number | null)[] {
  const first = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const monOffset = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < monOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

function monthTitleRu(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

interface DayPickerCalendarProps {
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
  /** Дни, где есть хотя бы одна карточка */
  markedDateKeys: readonly string[];
  /** Дни, где есть хотя бы одна завершённая карточка */
  activeDateKeys?: readonly string[];
}

export function DayPickerCalendar({
  selectedDateKey,
  onSelectDateKey,
  markedDateKeys,
  activeDateKeys = [],
}: DayPickerCalendarProps) {
  const marked = useMemo(() => new Set(markedDateKeys), [markedDateKeys]);
  const active = useMemo(() => new Set(activeDateKeys), [activeDateKeys]);
  const initial = useMemo(() => {
    const parsed = parseDateKey(selectedDateKey);
    if (parsed) {
      return { y: parsed.y, m: parsed.m - 1 };
    }
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  }, [selectedDateKey]);

  const [cursorY, setCursorY] = useState<number>(() => initial.y);
  const [cursorM, setCursorM] = useState<number>(() => initial.m);

  useEffect(() => {
    const parsed = parseDateKey(selectedDateKey);
    if (parsed) {
      setCursorY(parsed.y);
      setCursorM(parsed.m - 1);
    }
  }, [selectedDateKey]);

  const grid = useMemo(() => monthMatrix(cursorY, cursorM), [cursorY, cursorM]);
  const todayK = todayDateKey();

  const prevMonth = useCallback(() => {
    setCursorM((m) => {
      if (m === 0) {
        setCursorY((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCursorM((m) => {
      if (m === 11) {
        setCursorY((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const goToday = useCallback(() => {
    const t = new Date();
    setCursorY(t.getFullYear());
    setCursorM(t.getMonth());
    onSelectDateKey(todayDateKey());
  }, [onSelectDateKey]);

  return (
    <View className="rounded-card border border-line bg-white px-3 pb-4 pt-2">
      <View className="mb-3 flex-row items-center justify-between px-1">
        <Pressable
          onPress={prevMonth}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-mist"
          accessibilityLabel="Предыдущий месяц"
        >
          <Ionicons name="chevron-back" size={22} color={INK} />
        </Pressable>
        <Text className="flex-1 text-center font-sans-semibold text-base capitalize text-ink" numberOfLines={1}>
          {monthTitleRu(cursorY, cursorM)}
        </Text>
        <Pressable
          onPress={nextMonth}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-mist"
          accessibilityLabel="Следующий месяц"
        >
          <Ionicons name="chevron-forward" size={22} color={INK} />
        </Pressable>
      </View>

      <Pressable
        onPress={goToday}
        className="mb-3 self-center rounded-full bg-mist px-4 py-2 active:opacity-80"
      >
        <Text className="font-sans-semibold text-sm text-ink">Сегодня</Text>
      </Pressable>

      <View className="flex-row">
        {WEEK.map((d) => (
          <View key={d} className="w-[14.28%] items-center py-1">
            <Text className="font-sans-semibold text-[10px] uppercase text-muted">{d}</Text>
          </View>
        ))}
      </View>

      <View className="mt-1 flex-row flex-wrap">
        {grid.map((day, i) => {
          if (day === null) {
            return <View key={`e-${i}`} className="w-[14.28%] aspect-square p-0.5" />;
          }
          const dk = formatDateKey(new Date(cursorY, cursorM, day));
          const isSel = dk === selectedDateKey;
          const isToday = dk === todayK;
          const hasMark = marked.has(dk);
          const isActiveDay = active.has(dk);
          return (
            <View key={dk} className="relative w-[14.28%] aspect-square p-0.5">
              <Pressable
                onPress={() => onSelectDateKey(dk)}
                className={`flex-1 items-center justify-center rounded-xl ${
                  isSel
                    ? "bg-accent"
                    : isToday
                      ? "border border-accent-dark/50"
                      : "active:bg-mist"
                }`}
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`${day} ${monthTitleRu(cursorY, cursorM)}`}
              >
                <Text className="font-sans-semibold text-base text-ink" style={{ opacity: isSel ? 1 : 0.9 }}>
                  {day}
                </Text>
                {hasMark ? (
                  <View
                    className="absolute bottom-1.5 h-1 w-1 rounded-full"
                    style={{ backgroundColor: isSel ? INK : isActiveDay ? "#1D9E75" : "#C4C2BB" }}
                  />
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
