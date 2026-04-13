import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { useSettingsStore } from "@/store/settingsStore";
import { getCurrentUser, upsertSettings } from "@/services/supabase";

const timeSlots = [
  { label: "Morning", subtitle: "8am - 12pm", start: 8, end: 12, icon: "sunny-outline" as const },
  { label: "Afternoon", subtitle: "12pm - 4pm", start: 12, end: 16, icon: "partly-sunny-outline" as const },
  { label: "Late afternoon", subtitle: "4pm - 7pm", start: 16, end: 19, icon: "cloudy-outline" as const },
  { label: "Evening", subtitle: "7pm - 11pm", start: 19, end: 23, icon: "moon-outline" as const },
];

export default function EnergyScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(1); // Default: afternoon (Garrett's midday energy)
  const { setEnergyPeak, completeOnboarding, busyBlocks, availabilityNotes } = useSettingsStore();

  const handleFinish = () => {
    const slot = timeSlots[selected];
    setEnergyPeak(slot.start, slot.end);
    completeOnboarding();

    // Fire-and-forget: persist onboarding settings to Supabase.
    // Does not block navigation — local state is already updated above.
    (async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          await upsertSettings(
            {
              energyPeakStart: slot.start,
              energyPeakEnd: slot.end,
              busyBlocks,
              availabilityNotes,
              onboardingComplete: true,
            },
            user.id
          );
        }
      } catch (err) {
        console.warn("[Focal] upsertSettings on onboarding finish failed:", err);
      }
    })();

    router.replace("/(tabs)");
  };

  return (
    <View
      className="flex-1 bg-surface dark:bg-surface-dark"
      style={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }}
    >
      <ScrollView className="flex-1 px-6" contentContainerClassName="pb-8">
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-accent-light dark:bg-accent/15 items-center justify-center mb-6">
            <Ionicons name="flash-outline" size={48} className="text-primary dark:text-primary" />
          </View>
          <Text className="text-title font-bold text-content dark:text-content-dark-primary text-center mb-3">
            When do you focus best?
          </Text>
          <Text className="text-body text-content-secondary dark:text-content-dark-secondary text-center leading-6 max-w-[300px]">
            We'll send reminders during your peak energy time. You can change this anytime.
          </Text>
        </View>

        <View className="gap-3">
          {timeSlots.map((slot, i) => (
            <Pressable
              key={i}
              onPress={() => setSelected(i)}
              className={`flex-row items-center gap-4 rounded-xl p-4 border-2 ${
                selected === i
                  ? "border-primary bg-primary/5 dark:bg-primary/10"
                  : "border-border dark:border-border-dark bg-surface-card dark:bg-surface-dark-card"
              }`}
              accessibilityRole="radio"
              accessibilityState={{ selected: selected === i }}
              accessibilityLabel={`${slot.label}: ${slot.subtitle}`}
            >
              <View
                className={`w-12 h-12 rounded-full items-center justify-center ${
                  selected === i
                    ? "bg-primary/15 dark:bg-primary/25"
                    : "bg-surface-elevated dark:bg-surface-dark-elevated"
                }`}
              >
                <Ionicons
                  name={slot.icon}
                  size={24}
                  className={selected === i ? "text-primary dark:text-primary" : "text-content-muted dark:text-content-dark-muted"}
                />
              </View>
              <View className="flex-1">
                <Text
                  className={`text-body font-semibold ${
                    selected === i
                      ? "text-content dark:text-content-dark-primary"
                      : "text-content-secondary dark:text-content-dark-secondary"
                  }`}
                >
                  {slot.label}
                </Text>
                <Text className="text-caption text-content-muted dark:text-content-dark-muted">
                  {slot.subtitle}
                </Text>
              </View>
              {selected === i && (
                <Ionicons name="checkmark-circle" size={24} className="text-primary dark:text-primary" />
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View className="px-6">
        <Button
          title="All set — let's go!"
          variant="primary"
          onPress={handleFinish}
          accessibilityLabel="Complete setup and go to home screen"
        />
      </View>
    </View>
  );
}
