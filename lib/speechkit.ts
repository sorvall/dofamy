import { Platform } from "react-native";
/** SDK 54+: классический API в подмодуле `legacy` */
import * as FileSystem from "expo-file-system/legacy";

import { loadWebRecordingAsWavBytes } from "./webAudioWav";

import {
  getYandexFolderId,
  getYandexIamToken,
  getYandexSpeechKitApiKey,
} from "./runtimeEnv";

const STT_SYNC_URL = "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize";

/** Секрет из .env: либо только ключ, либо уже с префиксом `Api-Key ` / `Bearer `. */
function buildApiKeyAuthorization(secret: string): string {
  const t = secret.trim().replace(/^["']|["']$/g, "");
  if (/^Api-Key\s+/i.test(t) || /^Bearer\s+/i.test(t)) {
    return t;
  }
  return `Api-Key ${t}`;
}

/**
 * IAM-токен (Bearer) имеет приоритет — удобно проверить, что folderId и роли верны,
 * если подозреваешь проблему именно с API-ключом / его scope.
 */
function resolveAuthorizationHeader(): string {
  const iam = getYandexIamToken();
  if (iam) {
    return /^Bearer\s+/i.test(iam) ? iam : `Bearer ${iam}`;
  }
  const key = getYandexSpeechKitApiKey();
  if (!key) {
    throw new Error(
      "Задай EXPO_PUBLIC_YANDEX_SPEECHKIT_API_KEY или EXPO_PUBLIC_YANDEX_IAM_TOKEN, и EXPO_PUBLIC_YANDEX_FOLDER_ID в .env (они попадают в приложение через app.config.js → expo.extra)."
    );
  }
  return buildApiKeyAuthorization(key);
}

function readUInt16LE(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8);
}

function readUInt32LE(buf: Uint8Array, offset: number): number {
  return (
    buf[offset]! |
    (buf[offset + 1]! << 8) |
    (buf[offset + 2]! << 16) |
    (buf[offset + 3]! << 24)
  );
}

function readFourCC(buf: Uint8Array, pos: number): string {
  return String.fromCharCode(
    buf[pos]!,
    buf[pos + 1]!,
    buf[pos + 2]!,
    buf[pos + 3]!
  );
}

/**
 * Ищет чанк `data` по смещениям, кратным 2 (RIFF выравнивание), если основной обход «проскочил» data
 * из‑за неверного chunkSize у предыдущего чанка или обрезанного файла.
 */
function findDataChunkScan(buffer: Uint8Array, start: number): Uint8Array | undefined {
  for (let pos = start; pos + 8 <= buffer.length; pos += 2) {
    if (
      buffer[pos] === 0x64 &&
      buffer[pos + 1] === 0x61 &&
      buffer[pos + 2] === 0x74 &&
      buffer[pos + 3] === 0x61
    ) {
      const chunkSize = readUInt32LE(buffer, pos + 4);
      const payloadStart = pos + 8;
      const payloadEnd = Math.min(payloadStart + chunkSize, buffer.length);
      if (payloadEnd > payloadStart) {
        return buffer.subarray(payloadStart, payloadEnd);
      }
    }
  }
  return undefined;
}

/** Извлекает сырой LPCM и параметры из WAV (RIFF). */
function parseWavPcm(buffer: Uint8Array): {
  pcm: Uint8Array;
  sampleRateHertz: number;
  bitsPerSample: number;
} {
  const riff = String.fromCharCode(buffer[0]!, buffer[1]!, buffer[2]!, buffer[3]!);
  const wave = String.fromCharCode(buffer[8]!, buffer[9]!, buffer[10]!, buffer[11]!);
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error(
      "Нужен WAV с LPCM (16 kHz, моно) для Yandex SpeechKit. Перезапишите голос после обновления приложения."
    );
  }

  let offset = 12;
  let sampleRateHertz = 16_000;
  let bitsPerSample = 16;
  let pcm: Uint8Array | undefined;

  while (offset + 8 <= buffer.length) {
    const id = readFourCC(buffer, offset);
    const chunkSize = readUInt32LE(buffer, offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = Math.min(payloadStart + chunkSize, buffer.length);
    const truncated = payloadStart + chunkSize > buffer.length;

    if (id === "fmt ") {
      if (payloadEnd - payloadStart >= 16) {
        const audioFormat = readUInt16LE(buffer, payloadStart);
        const numChannels = readUInt16LE(buffer, payloadStart + 2);
        sampleRateHertz = readUInt32LE(buffer, payloadStart + 4);
        bitsPerSample = readUInt16LE(buffer, payloadStart + 14);
        if (audioFormat !== 1) {
          throw new Error(`SpeechKit sync: WAV не в формате PCM (audioFormat=${audioFormat}).`);
        }
        if (numChannels !== 1) {
          throw new Error("SpeechKit sync: нужен монофонический WAV.");
        }
      }
    } else if (id === "data") {
      pcm = buffer.subarray(payloadStart, payloadEnd);
      break;
    }

    if (truncated) {
      break;
    }
    offset = payloadStart + chunkSize + (chunkSize % 2);
  }

  if (!pcm || pcm.length === 0) {
    pcm = findDataChunkScan(buffer, 12);
  }

  if (!pcm || pcm.length === 0) {
    throw new Error("В WAV не найден чанк data.");
  }
  if (bitsPerSample !== 16) {
    throw new Error(`SpeechKit sync: нужен 16-bit LPCM, получено ${bitsPerSample} bit.`);
  }

  const allowedRates = new Set([8000, 16_000, 48_000]);
  if (!allowedRates.has(sampleRateHertz)) {
    throw new Error(
      `Частота дискретизации ${sampleRateHertz} Hz не поддерживается sync API (нужно 8000, 16000 или 48000).`
    );
  }

  return { pcm, sampleRateHertz, bitsPerSample };
}

function base64ToUint8Array(base64: string): Uint8Array {
  const atobFn = globalThis.atob;
  if (!atobFn) {
    throw new Error("В среде нет atob для чтения аудио.");
  }
  const binaryString = atobFn(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Распознавание через Yandex SpeechKit (синхронное API v1).
 * Аудио: WAV, моно, 16-bit LPCM (см. настройки записи в `VoiceRecorder`).
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
  const folderId = getYandexFolderId();
  if (!folderId) {
    throw new Error(
      "Задайте в .env: EXPO_PUBLIC_YANDEX_FOLDER_ID (идентификатор каталога, обычно начинается с b1), затем перезапустите Metro."
    );
  }
  const authorization = resolveAuthorizationHeader();

  let fileBytes: Uint8Array;
  if (Platform.OS === "web") {
    fileBytes = await loadWebRecordingAsWavBytes(audioUri);
  } else {
    const info = await FileSystem.getInfoAsync(audioUri);
    if (!info.exists) {
      throw new Error("Файл записи не найден.");
    }
    const size = info.size ?? 0;
    if (size > 1024 * 1024) {
      throw new Error(
        "Файл больше 1 МБ — лимит синхронного SpeechKit. Сократите запись или используйте async STT."
      );
    }
    const base64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    fileBytes = base64ToUint8Array(base64);
  }

  const { pcm, sampleRateHertz } = parseWavPcm(fileBytes);

  const params = new URLSearchParams({
    folderId,
    lang: "ru-RU",
    format: "lpcm",
    sampleRateHertz: String(sampleRateHertz),
    topic: "general",
  });

  const url = `${STT_SYNC_URL}?${params.toString()}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authorization,
    },
    body: pcm as unknown as BodyInit,
  });

  const rawText = await response.text();
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        [
          "SpeechKit 401: авторизация не принята.",
          "Частые причины: (1) в .env попал не секрет API-ключа, а «идентификатор ключа» или другой текст;",
          "(2) ключ создан с ограничением по сервисам — при создании API-ключа включи доступ к Cloud API / SpeechKit (или без жёсткого ограничения для теста);",
          "(3) ключ не от Yandex Cloud (другой продукт) или от другого облака;",
          "(4) у сервисного аккаунта нет роли `ai.speechkit-stt.user` (или шире) на каталог с этим folderId;",
          "Проверка: на Mac выполни `yc iam create-token` и временно положи токен в EXPO_PUBLIC_YANDEX_IAM_TOKEN (в коде он идёт как Bearer) — если с токеном работает, а с Api-Key нет, пересоздай API-ключ с полным доступом.",
          "Ответ API: " + rawText,
        ].join(" ")
      );
    }
    throw new Error(`SpeechKit STT: ${response.status} ${rawText}`);
  }

  let text: string | undefined;
  try {
    const json: unknown = JSON.parse(rawText);
    if (typeof json === "string") {
      text = json;
    } else if (json && typeof json === "object") {
      const obj = json as {
        result?: string;
        error?: { message?: string; code?: number };
      };
      if (obj.error?.message) {
        throw new Error(obj.error.message);
      }
      text = typeof obj.result === "string" ? obj.result : undefined;
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      text = rawText.trim();
    } else {
      throw e;
    }
  }

  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error("SpeechKit вернул пустой текст.");
  }
  return trimmed;
}
