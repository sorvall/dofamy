import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let permissionAsked = false;

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  if (permissionAsked) return false;
  permissionAsked = true;
  const req = await Notifications.requestPermissionsAsync();
  return Boolean(req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("timers", {
    name: "Таймеры задач",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function notifyTimerReached(title: string, body: string, playSound = true): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await ensurePermission();
  if (!granted) return;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: playSound,
    },
    trigger: null,
  });
}
