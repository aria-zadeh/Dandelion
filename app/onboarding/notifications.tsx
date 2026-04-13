import React from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { requestNotificationPermissions } from "@/services/notifications";

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();

  const handleAllow = async () => {
    await requestNotificationPermissions();
    router.push("/onboarding/availability");
  };

  const handleSkip = () => {
    router.push("/onboarding/availability");
  };

  return (
    <View
      className="flex-1 bg-surface dark:bg-surface-dark justify-between px-6"
      style={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }}
    >
      <View className="items-center mt-12">
        <View className="w-24 h-24 rounded-full bg-accent-light dark:bg-accent/15 items-center justify-center mb-6">
          <Ionicons name="notifications-outline" size={48} className="text-accent dark:text-accent" />
        </View>
        <Text className="text-title font-bold text-content dark:text-content-dark-primary text-center mb-3">
          Gentle reminders
        </Text>
        <Text className="text-body text-content-secondary dark:text-content-dark-secondary text-center leading-6 max-w-[300px]">
          We'll only nudge you when it matters — max once per hour, never during quiet hours (11pm-8am).{"\n\n"}
          No notification spam. Ever.
        </Text>
      </View>

      {/* Promise cards */}
      <View className="gap-3 my-8">
        {[
          { icon: "volume-low-outline" as const, text: "Max 1 reminder per hour" },
          { icon: "moon-outline" as const, text: "Silent during quiet hours" },
          { icon: "heart-outline" as const, text: "Encouraging, not nagging" },
        ].map((item, i) => (
          <View key={i} className="flex-row items-center gap-3 bg-surface-card dark:bg-surface-dark-card rounded-lg p-3">
            <Ionicons name={item.icon} size={20} className="text-primary dark:text-primary" />
            <Text className="text-body text-content dark:text-content-dark-primary flex-1">
              {item.text}
            </Text>
          </View>
        ))}
      </View>

      <View className="gap-3">
        <Button
          title="Allow notifications"
          variant="primary"
          onPress={handleAllow}
          accessibilityLabel="Allow notifications and continue"
        />
        <Button
          title="Maybe later"
          variant="ghost"
          onPress={handleSkip}
          accessibilityLabel="Skip notifications and continue"
        />
      </View>
    </View>
  );
}
