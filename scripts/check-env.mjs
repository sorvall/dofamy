#!/usr/bin/env node
/**
 * Проверка: из корня проекта читается .env и печатаются маски (без полных секретов).
 * Запуск: node scripts/check-env.mjs
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });

const key = process.env.EXPO_PUBLIC_YANDEX_SPEECHKIT_API_KEY?.trim();
const folder = process.env.EXPO_PUBLIC_YANDEX_FOLDER_ID?.trim();
const ds = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY?.trim();

function mask(s, n = 6) {
  if (!s) return "(нет)";
  return `${s.slice(0, n)}… len=${s.length}`;
}

console.log("dotenv path:", path.join(root, ".env"));
console.log("EXPO_PUBLIC_YANDEX_SPEECHKIT_API_KEY:", mask(key, 4));
console.log("EXPO_PUBLIC_YANDEX_FOLDER_ID:", mask(folder, 8));
console.log("EXPO_PUBLIC_DEEPSEEK_API_KEY:", mask(ds, 7));

if (key?.startsWith("your_")) {
  console.warn("⚠ Ключ похож на заглушку your_yandex… — подставь реальный секрет из консоли.");
}
