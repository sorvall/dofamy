import Constants from "expo-constants";

type DofamyExtra = {
  yandexSpeechKitApiKey?: string;
  yandexFolderId?: string;
  deepSeekApiKey?: string;
  yandexIamToken?: string;
};

function getExtra(): DofamyExtra {
  const raw = Constants.expoConfig?.extra;
  if (raw && typeof raw === "object") {
    return raw as DofamyExtra;
  }
  return {};
}

/** Значения из `app.config.js` → `expo.extra` (плюс fallback на process.env для веб/тестов). */
export function getYandexSpeechKitApiKey(): string | undefined {
  const v = getExtra().yandexSpeechKitApiKey ?? process.env["EXPO_PUBLIC_YANDEX_SPEECHKIT_API_KEY"];
  return v?.trim();
}

export function getYandexFolderId(): string | undefined {
  const v = getExtra().yandexFolderId ?? process.env["EXPO_PUBLIC_YANDEX_FOLDER_ID"];
  return v?.trim().replace(/^["']|["']$/g, "");
}

export function getYandexIamToken(): string | undefined {
  const v = getExtra().yandexIamToken ?? process.env["EXPO_PUBLIC_YANDEX_IAM_TOKEN"];
  return v?.trim().replace(/^["']|["']$/g, "");
}

export function getDeepSeekApiKey(): string | undefined {
  const v = getExtra().deepSeekApiKey ?? process.env["EXPO_PUBLIC_DEEPSEEK_API_KEY"];
  return v?.trim();
}
