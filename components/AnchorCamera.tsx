import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

const INK = "#1A1915";

/**
 * После onCameraReady нативная сессия ещё может не выставить photo output — на iOS это отдельный шаг.
 * Слишком короткая пауза даёт «Camera is not ready yet» из expo-camera (race JS callback vs AVCaptureSession).
 */
const STABILIZE_AFTER_READY_MS = Platform.OS === "ios" ? 900 : 280;

/** Если onCameraReady не пришёл (Android/ScrollView), всё равно показать затвор. */
const READY_FALLBACK_MS = 6500;

interface AnchorCameraProps {
  instruction: string;
  existingUri?: string;
  onCapture: (uri: string) => void;
  disabled?: boolean;
  /** Только одна CameraView на экран — иначе ломается превью на iOS. */
  sessionActive?: boolean;
  onActivateSession?: () => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        opacity: disabled ? 0.4 : pressed ? 0.92 : 1,
      })}
    >
      <LinearGradient
        colors={["#F5C842", "#C9A025"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryBtn}
      >
        <Text style={styles.primaryBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function isRetryableCameraError(msg: string): boolean {
  return /could not be captured|Image could not|not ready yet|Camera is not ready|OutputNotReady|unmounted during/i.test(
    msg
  );
}

/** Несколько попыток: нативный output иногда появляется позже колбэка onCameraReady. */
async function takePictureReliable(cam: CameraView | null): Promise<{ uri: string } | undefined> {
  if (!cam) return undefined;
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  await sleep(Platform.OS === "ios" ? 160 : 70);

  const maxAttempts = 10;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(160 + attempt * 35);
      try {
        await cam.resumePreview();
      } catch {
        /* */
      }
      await sleep(80);
    }
    try {
      const quality = attempt < 3 ? 0.92 : 1;
      const photo = await cam.takePictureAsync({ quality, shutterSound: true });
      if (photo?.uri) return { uri: photo.uri };
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (isRetryableCameraError(msg) && attempt < maxAttempts - 1) {
        continue;
      }
      throw e;
    }
  }
  if (lastErr) throw lastErr;
  return undefined;
}

export function AnchorCamera({
  instruction,
  existingUri,
  onCapture,
  disabled,
  sessionActive = true,
  onActivateSession,
}: AnchorCameraProps) {
  const { width: windowWidth } = useWindowDimensions();
  /** Новый mount при фокусе экрана / пересъёмке — иначе на iOS сессия иногда остаётся без preview/photoOutput. */
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const camRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [layoutOk, setLayoutOk] = useState(false);
  const [delayedReady, setDelayedReady] = useState(false);
  const [reshooting, setReshooting] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const stabilizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewHeight = Math.max(220, Math.round(windowWidth * 0.75));

  const showPreviewOnly = Boolean(existingUri) && !reshooting;
  const showLiveCamera = sessionActive || reshooting;

  const pickFromGalleryWeb = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const uri = URL.createObjectURL(file);
      onCapture(uri);
      setReshooting(false);
    };
    input.click();
  };

  const clearStabilizeTimer = useCallback(() => {
    if (stabilizeTimer.current) {
      clearTimeout(stabilizeTimer.current);
      stabilizeTimer.current = null;
    }
  }, []);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimer.current) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  }, []);

  const resetReadyForNewSession = useCallback(() => {
    setDelayedReady(false);
    setLayoutOk(false);
    setMountError(null);
    clearStabilizeTimer();
  }, [clearStabilizeTimer]);

  useEffect(() => {
    resetReadyForNewSession();
    setReshooting(false);
  }, [existingUri, resetReadyForNewSession]);

  useFocusEffect(
    useCallback(() => {
      setCameraSessionKey((k) => k + 1);
      resetReadyForNewSession();
      return () => {};
    }, [resetReadyForNewSession])
  );

  const onCameraReadyHandler = useCallback(() => {
    clearStabilizeTimer();
    setDelayedReady(false);
    stabilizeTimer.current = setTimeout(() => {
      setDelayedReady(true);
      stabilizeTimer.current = null;
    }, STABILIZE_AFTER_READY_MS);
  }, [clearStabilizeTimer]);

  useEffect(() => {
    if (showPreviewOnly) {
      clearStabilizeTimer();
      clearFallbackTimer();
      return;
    }
    clearFallbackTimer();
    fallbackTimer.current = setTimeout(() => {
      setDelayedReady((d) => (d ? d : true));
      fallbackTimer.current = null;
    }, READY_FALLBACK_MS);
    return () => {
      clearFallbackTimer();
      clearStabilizeTimer();
    };
  }, [showPreviewOnly, existingUri, reshooting, clearStabilizeTimer, clearFallbackTimer]);

  const shutterEnabled = layoutOk && delayedReady;

  const takePhoto = async () => {
    if (disabled || busy || !shutterEnabled) return;
    try {
      setBusy(true);
      const result = await takePictureReliable(camRef.current);
      if (result?.uri) {
        onCapture(result.uri);
        setReshooting(false);
      } else {
        Alert.alert(
          "Не удалось снять",
          "Попробуйте ещё раз через секунду, не закрывая экран."
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("takePhoto", e);
      Alert.alert("Ошибка камеры", msg || "Не удалось сделать снимок.");
    } finally {
      setBusy(false);
    }
  };

  if (!showLiveCamera && !showPreviewOnly) {
    return (
      <Animated.View
        entering={FadeIn}
        className="aspect-[4/3] w-full items-center justify-center rounded-card border border-dashed border-line bg-mist px-5"
      >
        <Text className="mb-4 text-center font-sans text-base leading-6 text-muted">{instruction}</Text>
        <PrimaryButton
          label={Platform.OS === "web" ? "Выбрать или снять фото" : "Открыть камеру"}
          onPress={() => {
            if (Platform.OS === "web") {
              pickFromGalleryWeb();
              return;
            }
            onActivateSession?.();
          }}
          disabled={disabled}
        />
        <Text className="mt-3 text-center font-sans text-xs text-muted">Необязательно — можно закончить задачу без фото</Text>
      </Animated.View>
    );
  }

  if (!permission) {
    return (
      <Animated.View entering={FadeIn} className="aspect-[4/3] w-full items-center justify-center rounded-card border border-line bg-mist">
        <Text className="text-base text-neutral-500">Камера…</Text>
      </Animated.View>
    );
  }

  if (!permission.granted) {
    return (
      <Animated.View
        entering={FadeIn}
        className="aspect-[4/3] w-full items-center justify-center rounded-card border border-line bg-mist px-5"
      >
        <Text className="mb-4 text-center text-lg font-medium text-ink">
          Нужен доступ к камере для якорного фото.
        </Text>
        <PrimaryButton label="Разрешить камеру" onPress={() => void requestPermission()} />
        {Platform.OS === "web" ? (
          <Pressable onPress={pickFromGalleryWeb} className="mt-3 py-2">
            <Text className="text-center font-sans text-sm text-muted">Или выбрать фото из галереи</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  }

  if (showPreviewOnly) {
    return (
      <Animated.View entering={FadeIn} className="w-full overflow-hidden rounded-card bg-black">
        <Image source={{ uri: existingUri }} className="aspect-[4/3] w-full" resizeMode="cover" />
        {!disabled ? (
          <Pressable
            onPress={() => {
              setReshooting(true);
              resetReadyForNewSession();
              setCameraSessionKey((k) => k + 1);
            }}
            disabled={busy}
            className="min-h-[52px] items-center justify-center bg-ink"
          >
            <Text className="text-base font-semibold text-white">Переснять</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  }

  return (
    <View className="w-full overflow-hidden rounded-card bg-black">
      <View
        collapsable={false}
        style={{
          width: "100%",
          height: previewHeight,
          overflow: Platform.OS === "android" ? "hidden" : undefined,
        }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setLayoutOk(width >= 80 && height >= 80);
        }}
      >
        <CameraView
          key={cameraSessionKey}
          ref={camRef}
          mode="picture"
          facing="back"
          flash="off"
          active
          style={StyleSheet.absoluteFill}
          onCameraReady={onCameraReadyHandler}
          onMountError={(ev) => {
            const m = ev.message ?? "Не удалось открыть камеру";
            setMountError(m);
            Alert.alert("Камера", m);
            setCameraSessionKey((k) => k + 1);
          }}
        />
      </View>
      <LinearGradient colors={["#1A1A1A", "#0D0D0D"]} style={styles.footer}>
        {mountError ? (
          <Text className="mb-3 text-center text-base text-red-300">{mountError}</Text>
        ) : null}
        <Text className="mb-3 text-center text-lg font-medium leading-6 text-white">
          {instruction}
        </Text>
        {reshooting ? (
          <Pressable
            onPress={() => setReshooting(false)}
            className="mb-3 min-h-[48px] items-center justify-center rounded-2xl border border-white/20 bg-white/10"
          >
            <Text className="text-base font-medium text-white">Отменить пересъёмку</Text>
          </Pressable>
        ) : null}
        {Platform.OS === "web" ? (
          <Pressable onPress={pickFromGalleryWeb} className="mb-3 min-h-[44px] items-center justify-center">
            <Text className="text-base font-medium text-white/80">Выбрать из галереи</Text>
          </Pressable>
        ) : null}
        <PrimaryButton
          label={!shutterEnabled ? "Камера готовится…" : busy ? "Снимаю…" : "Сделать фото"}
          onPress={() => void takePhoto()}
          disabled={disabled || busy || !shutterEnabled}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: INK,
  },
});
