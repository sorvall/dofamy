import "react-native-reanimated";

import {
  GolosText_400Regular,
  GolosText_500Medium,
  GolosText_600SemiBold,
} from "@expo-google-fonts/golos-text";
import { Unbounded_500Medium, Unbounded_600SemiBold } from "@expo-google-fonts/unbounded";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import "../global.css";

SplashScreen.preventAutoHideAsync();
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const FA_PAPER = "#F5F3EE";
const FA_INK = "#1A1915";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    GolosText_400Regular,
    GolosText_500Medium,
    GolosText_600SemiBold,
    Unbounded_500Medium,
    Unbounded_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(FA_PAPER);
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: FA_PAPER }}>
      <StatusBar style="dark" backgroundColor={FA_PAPER} translucent={false} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: FA_PAPER },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="activity/[id]"
          options={{
            headerShown: true,
            title: "Активность",
            headerTintColor: FA_INK,
            headerBackTitle: "Назад",
            headerTitleStyle: {
              fontFamily: "Unbounded_500Medium",
              fontWeight: "500",
              fontSize: 15,
              color: FA_INK,
            },
            headerStyle: { backgroundColor: FA_PAPER },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: FA_PAPER },
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
