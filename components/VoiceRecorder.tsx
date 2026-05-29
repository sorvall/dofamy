import { MaterialIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import { pickWebRecordingMimeType } from "../lib/webAudioWav";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export type VoiceRecorderMode = "toggle" | "hold";

interface VoiceRecorderProps {
  mode: VoiceRecorderMode;
  onRecordingComplete: (uri: string) => void;
  disabled?: boolean;
  /** Подпись на кнопке (режим toggle, variant default) */
  idleLabel?: string;
  /** Подпись при записи */
  recordingLabel?: string;
  /** default — широкая кнопка; fab — жёлтый квадрат со скруглением (план на день) */
  variant?: "default" | "fab";
  /** Текст под круглой кнопкой (variant fab, пока не идёт запись) */
  fabCaption?: string;
}

/**
 * WAV, моно, 16-bit LPCM — требование синхронного Yandex SpeechKit v1 (format=lpcm).
 * Частота 16 kHz (поддерживается API: 8000 / 16000 / 48000).
 */
const recordingOptions: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: ".wav",
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16_000,
    numberOfChannels: 1,
    bitRate: 256_000,
  },
  ios: {
    extension: ".wav",
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16_000,
    numberOfChannels: 1,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    bitRate: 256_000,
  },
  web: {
    mimeType: pickWebRecordingMimeType(),
    bitsPerSecond: 128_000,
  },
};

function normalizeMetering(metering?: number): number {
  if (metering === undefined || Number.isNaN(metering)) return 0.15;
  const clamped = Math.max(-60, Math.min(0, metering));
  return (clamped + 60) / 60;
}

const INK = "#1A1915";
const METER_TRACK = "#E8E5DC";
const FAB_YELLOW = "#F5C842";
/** Квадратная кнопка плана (скруглённые углы), крупнее круга из макета */
const FAB_SIZE = 102;
const FAB_CORNER = 22;
const FAB_ICON_MIC = 36;
const FAB_ICON_STOP = 30;

function isWebMicAvailable(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return true;
  return window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function";
}

function recordingStartErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      return "Микрофон работает только по HTTPS. Откройте https://dofamy.ru (не http://IP:8082).";
    }
    if (/No media devices|NotAllowed|Permission|NotFound|mimetype|mimeType|not supported/i.test(msg)) {
      return "Нет доступа к микрофону. Разрешите микрофон в браузере. На iPhone нужен Safari и HTTPS.";
    }
  }
  return msg || "Не удалось начать запись";
}

export function VoiceRecorder({
  mode,
  onRecordingComplete,
  disabled,
  idleLabel = "Записать план",
  recordingLabel = "Идёт запись…",
  variant = "default",
  fabCaption,
}: VoiceRecorderProps) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [level, setLevel] = useState(0.2);
  const [busy, setBusy] = useState(false);
  const [webMicHint, setWebMicHint] = useState<string | null>(null);
  const levelSV = useSharedValue(0.12);
  const scale = useSharedValue(1);

  useEffect(() => {
    levelSV.value = withTiming(0.08 + level * 0.92, { duration: 70 });
  }, [level, levelSV]);

  /** На web expo-av не отдаёт metering — живая полоска по rAF (без второго доступа к микрофону). */
  useEffect(() => {
    if (!isRecording || Platform.OS !== "web") return;
    let raf = 0;
    const tick = (now: number) => {
      const t = now / 1000;
      const v =
        0.16 +
        0.38 * Math.abs(Math.sin(t * 9.5)) +
        0.22 * Math.abs(Math.sin(t * 4.1 + 1.2)) +
        Math.random() * 0.14;
      setLevel(Math.min(0.98, v));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isRecording]);

  useEffect(() => {
    if (Platform.OS === "web" && !isWebMicAvailable()) {
      setWebMicHint(
        "Запись голоса — по https://dofamy.ru. Настройте DNS и Caddy (см. Caddyfile.urbanscore в репозитории)."
      );
    }
    return () => {
      void recordingRef.current?.stopAndUnloadAsync();
    };
  }, []);

  const onStatusUpdate = useCallback((status: { isRecording: boolean; metering?: number }) => {
    if (!status.isRecording) return;
    if (Platform.OS === "web") return;
    setLevel(normalizeMetering(status.metering));
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || busy) return;
    if (Platform.OS === "web" && !isWebMicAvailable()) {
      Alert.alert("Нужен HTTPS", recordingStartErrorMessage(new Error("insecure")));
      return;
    }
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Микрофон", "Разрешите доступ к микрофону в настройках браузера.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        recordingOptions,
        onStatusUpdate,
        100
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setLevel(0.25);
      setWebMicHint(null);
    } catch (e) {
      console.warn("startRecording", e);
      const message = recordingStartErrorMessage(e);
      setWebMicHint(message);
      Alert.alert("Не удалось записать", message);
      setIsRecording(false);
    }
  }, [disabled, busy, onStatusUpdate]);

  const stopAndFinish = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    setBusy(true);
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setLevel(0.2);
      if (uri) {
        await onRecordingComplete(uri);
      }
    } catch (e) {
      console.warn("stopAndFinish", e);
    } finally {
      setBusy(false);
    }
  }, [onRecordingComplete]);

  const onTogglePress = useCallback(async () => {
    if (mode !== "toggle") return;
    if (isRecording) {
      await stopAndFinish();
    } else {
      await startRecording();
    }
  }, [mode, isRecording, startRecording, stopAndFinish]);

  const onHoldIn = useCallback(async () => {
    if (mode !== "hold" || disabled || busy) return;
    await startRecording();
  }, [mode, disabled, busy, startRecording]);

  const onHoldOut = useCallback(async () => {
    if (mode !== "hold" || !isRecording) return;
    await stopAndFinish();
  }, [mode, isRecording, stopAndFinish]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0.04, levelSV.value) }],
  }));

  const btnWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressIn = () => {
    scale.value = withSpring(0.97, { damping: 16, stiffness: 220 });
  };
  const pressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 200 });
  };

  const disabledVisual = disabled || busy;
  const showMeter = variant !== "fab" || isRecording;

  const fabShapeStyle = useMemo(
    () => ({
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_CORNER,
      backgroundColor: isRecording ? INK : FAB_YELLOW,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isRecording ? 0.28 : 0.16,
      shadowRadius: isRecording ? 18 : 12,
      elevation: isRecording ? 12 : 8,
    }),
    [isRecording]
  );

  return (
    <View className={variant === "fab" ? "w-full items-center" : "w-full"}>
      {showMeter ? (
        <View
          className={`mb-3 h-3 overflow-hidden rounded-full ${variant === "fab" ? "w-full max-w-[340px]" : "w-full"}`}
          style={{ backgroundColor: METER_TRACK }}
        >
          <Animated.View
            style={[
              fillStyle,
              {
                width: "100%",
                height: 12,
                transformOrigin: "left center",
              },
            ]}
          >
            <LinearGradient
              colors={["#F5C842", "#C9A025"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ height: 12, borderRadius: 999 }}
            />
          </Animated.View>
        </View>
      ) : null}

      {mode === "toggle" ? (
        <Animated.View style={btnWrapStyle}>
          <Pressable
            onPress={onTogglePress}
            onPressIn={pressIn}
            onPressOut={pressOut}
            disabled={disabledVisual}
            style={{ opacity: disabledVisual ? 0.45 : 1 }}
            accessibilityLabel={
              variant === "fab"
                ? isRecording
                  ? "Остановить запись плана"
                  : "Записать план на день"
                : undefined
            }
            accessibilityRole="button"
          >
            {variant === "fab" ? (
              <View style={fabShapeStyle}>
                {busy ? (
                  <ActivityIndicator color={INK} />
                ) : isRecording ? (
                  <MaterialIcons name="stop" size={FAB_ICON_STOP} color={FAB_YELLOW} />
                ) : (
                  <MaterialIcons name="mic" size={FAB_ICON_MIC} color={INK} />
                )}
              </View>
            ) : (
              <LinearGradient
                colors={["#F5C842", "#C9A025"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  minHeight: 56,
                  borderRadius: 18,
                  paddingHorizontal: 24,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {busy ? (
                  <ActivityIndicator color={INK} />
                ) : (
                  <Text className="font-sans-semibold text-base text-ink">
                    {isRecording ? "Остановить и отправить" : idleLabel}
                  </Text>
                )}
              </LinearGradient>
            )}
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View style={btnWrapStyle}>
          <Pressable
            onPressIn={() => {
              pressIn();
              void onHoldIn();
            }}
            onPressOut={() => {
              pressOut();
              void onHoldOut();
            }}
            disabled={disabledVisual}
            style={{ opacity: disabledVisual ? 0.45 : 1 }}
          >
            <LinearGradient
              colors={["#F5C842", "#C9A025"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                minHeight: 56,
                borderRadius: 18,
                paddingHorizontal: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {busy && !isRecording ? (
                <ActivityIndicator color={INK} />
              ) : (
                <Text className="font-sans-semibold text-base text-ink">
                  {isRecording ? recordingLabel : "Зажми и говори"}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}

      {variant === "fab" && mode === "toggle" && fabCaption && !isRecording ? (
        <Text className="mt-4 max-w-[300px] px-2 text-center font-sans text-xs leading-5 text-muted">
          {fabCaption}
        </Text>
      ) : null}

      {webMicHint ? (
        <Text className="mt-3 max-w-[320px] px-2 text-center font-sans text-xs leading-5 text-amber-ink">
          {webMicHint}
        </Text>
      ) : null}

      {isRecording && mode === "toggle" ? (
        <Text
          className={`mt-3 text-center font-sans text-sm text-muted ${variant === "fab" ? "max-w-[300px]" : ""}`}
        >
          {recordingLabel}
        </Text>
      ) : null}
    </View>
  );
}
