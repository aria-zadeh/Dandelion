import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { useSettingsStore } from "@/store/settingsStore";

export default function NameScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");

  const handleContinue = () => {
    if (name.trim()) {
      useSettingsStore.getState().updateSetting("displayName", name.trim());
    }
    router.push("/onboarding/notifications");
  };

  const handleSkip = () => {
    router.push("/onboarding/notifications");
  };

  return (
    <View
      className="flex-1 bg-surface dark:bg-surface-dark justify-between px-6"
      style={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }}
    >
      <View className="items-center mt-12">
        <View className="w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-500/15 items-center justify-center mb-6">
          <Ionicons name="person-outline" size={48} className="text-amber-500 dark:text-amber-400" />
        </View>
        <Text className="text-title font-bold text-content dark:text-content-dark-primary text-center mb-3">
          What should we call you?
        </Text>
        <Text className="text-body text-content-secondary dark:text-content-dark-secondary text-center leading-6 max-w-[300px]">
          We'll use this to personalize your experience.
        </Text>
      </View>

      <View className="my-8">
        <TextInput
          className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-xl px-4 py-3.5 text-body text-content dark:text-content-dark-primary"
          placeholder="Your first name"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleContinue}
          accessibilityLabel="Enter your first name"
        />
      </View>

      <View className="gap-3">
        <Button
          title="Continue"
          variant="primary"
          onPress={handleContinue}
          accessibilityLabel="Save name and continue"
        />
        <Button
          title="Skip"
          variant="ghost"
          onPress={handleSkip}
          accessibilityLabel="Skip name entry and continue"
        />
      </View>
    </View>
  );
}
