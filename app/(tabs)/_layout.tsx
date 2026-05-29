import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const INK = "#1A1915";
const MUTED = "#C4C2BB";
const YELLOW = "#F5C842";
const LINE = "#E8E5DC";

function tabLabel(text: string) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <Text
      style={{
        fontSize: 10,
        letterSpacing: 0.2,
        marginBottom: Platform.OS === "ios" ? 2 : 4,
        marginTop: 2,
        color,
        fontFamily: focused ? "Unbounded_600SemiBold" : "Unbounded_500Medium",
      }}
    >
      {text}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: "#F5F3EE" },
        headerTintColor: INK,
        headerTitleStyle: {
          fontFamily: "Unbounded_500Medium",
          fontSize: 15,
          fontWeight: "500",
          letterSpacing: -0.3,
          color: INK,
        },
        headerShadowVisible: false,
        tabBarActiveTintColor: INK,
        tabBarInactiveTintColor: MUTED,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: LINE,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 90 : 72,
          paddingTop: 12,
          paddingBottom: Platform.OS === "ios" ? 20 : 10,
          overflow: "visible",
        },
        tabBarItemStyle: {
          overflow: "visible",
          paddingTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Сегодня",
          tabBarLabel: tabLabel("Сегодня"),
          tabBarIcon: ({ color, focused }) => (
            <TabPill focused={focused}>
              <Ionicons name={focused ? "sunny" : "sunny-outline"} size={focused ? 24 : 20} color={color} />
            </TabPill>
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Календарь",
          tabBarLabel: tabLabel("Календарь"),
          tabBarIcon: ({ color, focused }) => (
            <TabPill focused={focused}>
              <Ionicons name={focused ? "calendar" : "calendar-outline"} size={focused ? 24 : 20} color={color} />
            </TabPill>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "История",
          tabBarLabel: tabLabel("История"),
          tabBarIcon: ({ color, focused }) => (
            <TabPill focused={focused}>
              <Ionicons name={focused ? "layers" : "layers-outline"} size={focused ? 24 : 20} color={color} />
            </TabPill>
          ),
        }}
      />
    </Tabs>
  );
}

function TabPill({ focused, children }: { focused: boolean; children: ReactNode }) {
  return (
    <View style={[styles.pillWrap, focused && styles.pillWrapFloat]}>
      <View style={[styles.pill, focused && styles.pillActive]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  pillWrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  /** «Парящая» таблетка чуть выступает над верхом таббара */
  pillWrapFloat: {
    marginTop: -10,
  },
  pill: {
    width: 46,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  pillActive: {
    backgroundColor: YELLOW,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
