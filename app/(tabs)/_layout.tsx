import { Tabs } from "expo-router";
import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? "hsl(35, 85%, 60%)" : "hsl(35, 85%, 45%)",
        tabBarInactiveTintColor: isDark ? "hsl(30, 8%, 45%)" : "hsl(30, 8%, 55%)",
        tabBarStyle: {
          backgroundColor: isDark ? "hsl(25, 15%, 10%)" : "hsl(40, 33%, 98%)",
          borderTopColor: isDark ? "hsl(25, 10%, 20%)" : "hsl(30, 15%, 90%)",
          paddingBottom: 4,
          height: 85,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: "Home tab",
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: "Tasks tab",
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: "Calendar tab",
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: "Focus",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="timer-outline" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: "Focus tab",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: "Profile and settings tab",
        }}
      />
    </Tabs>
    <View
      style={{
        alignItems: "center",
        paddingVertical: 4,
        backgroundColor: isDark ? "hsl(25, 15%, 10%)" : "hsl(40, 33%, 98%)",
        borderTopWidth: 0,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          color: isDark ? "rgba(200,185,165,0.35)" : "rgba(100,80,50,0.35)",
          textAlign: "center",
        }}
      >
        Created for MIT CRE[AT]E Task 2025-2026 • Team 495
      </Text>
    </View>
    </View>
  );
}
