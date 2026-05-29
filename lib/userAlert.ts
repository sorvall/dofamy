import { Alert, Platform } from "react-native";

/** На web `Alert.alert` часто не показывает диалог — дублируем через `window.alert`. */
export function userAlert(title: string, message?: string): void {
  const body = message ? `${title}\n\n${message}` : title;
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(body);
    return;
  }
  if (message) {
    Alert.alert(title, message);
  } else {
    Alert.alert(title);
  }
}
