const path = require("path");

// Явная загрузка .env в Node (Metro / expo config) — не зависит от инлайна Babel.
require("dotenv").config({ path: path.join(__dirname, ".env") });

const appJson = require("./app.json");

module.exports = {
  ...appJson.expo,
  extra: {
    ...(typeof appJson.expo.extra === "object" && appJson.expo.extra !== null
      ? appJson.expo.extra
      : {}),
    yandexSpeechKitApiKey: process.env.EXPO_PUBLIC_YANDEX_SPEECHKIT_API_KEY,
    yandexFolderId: process.env.EXPO_PUBLIC_YANDEX_FOLDER_ID,
    deepSeekApiKey: process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY,
    yandexIamToken: process.env.EXPO_PUBLIC_YANDEX_IAM_TOKEN,
  },
};
