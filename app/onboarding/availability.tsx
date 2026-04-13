import React from "react";
import { View, Text, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { BusyBlockGrid } from "@/components/ui/BusyBlockGrid";
import { useSettingsStore } from "@/store/settingsStore";

export default function AvailabilityScreen() {
  const insets = useSafeAreaInsets();
  const busyBlocks = useSettingsStore((s) => s.busyBlocks);
  const toggleBusyBlock = useSettingsStore((s) => s.toggleBusyBlock);
  const availabilityNotes = useSettingsStore((s) => s.availabilityNotes);
  const setAvailabilityNotes = useSettingsStore((s) => s.setAvailabilityNotes);

  const handleContinue = () => {
    router.push("/onboarding/energy");
  };

  const handleSkip = () => {
    // Skip saves empty busyBlocks (default) and advances
    router.push("/onboarding/energy");
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface dark:bg-surface-dark"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        className="flex-1"
        style={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }}
      >
        {/* Skip button — top right */}
        <View className="absolute right-5 z-10" style={{ top: insets.top + 12 }}>
          <Pressable
            onPress={handleSkip}
            className="min-w-[44px] min-h-[44px] items-center justify-center"
            accessibilityLabel="Skip availability setup"
            accessibilityRole="button"
          >
            <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary">
              Skip
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-6"
          contentContainerClassName="pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-8">
            <View className="w-24 h-24 rounded-full bg-accent-light dark:bg-accent/15 items-center justify-center mb-6">
              <Ionicons name="calendar-outline" size={48} className="text-primary dark:text-primary" />
            </View>
            <Text className="text-title font-bold text-content dark:text-content-dark-primary text-center mb-3">
              When are you usually busy?
            </Text>
            <Text className="text-body text-content-secondary dark:text-content-dark-secondary text-center leading-6 max-w-[300px]">
              We'll avoid sending reminders at these times
            </Text>
          </View>

          <View className="mb-6">
            <BusyBlockGrid busyBlocks={busyBlocks} onToggle={toggleBusyBlock} />
          </View>

          {/* Free-text notes */}
          <View className="mb-2">
            <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1.5">
              Anything else?
            </Text>
            <TextInput
              value={availabilityNotes}
              onChangeText={setAvailabilityNotes}
              placeholder="e.g. swim practice Tues 4–6"
              placeholderTextColor="hsl(30, 6%, 60%)"
              className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3.5 text-body text-content dark:text-content-dark-primary"
              accessibilityLabel="Additional availability notes"
              multiline
            />
          </View>
        </ScrollView>

        <View className="px-6">
          <Button
            title="Looks good"
            variant="primary"
            onPress={handleContinue}
            accessibilityLabel="Continue to energy peak setup"
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
