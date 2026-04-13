/**
 * Reusable busy block grid — used in both onboarding/availability and settings/busy-times.
 * Renders a 7×3 grid (days × periods) with toggle cells for free/busy.
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DayKey, PeriodKey, BusyBlock } from "@/types";

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const PERIODS: { key: PeriodKey; label: string; hint: string }[] = [
  { key: "morning", label: "Morning", hint: "8am–12pm" },
  { key: "afternoon", label: "Afternoon", hint: "12–5pm" },
  { key: "evening", label: "Evening", hint: "5–9pm" },
];

interface BusyBlockGridProps {
  busyBlocks: BusyBlock[];
  onToggle: (block: BusyBlock) => void;
}

export function BusyBlockGrid({ busyBlocks, onToggle }: BusyBlockGridProps) {
  const isBusy = (day: DayKey, period: PeriodKey) =>
    busyBlocks.some((b) => b.day === day && b.period === period);

  return (
    <View>
      {/* Legend */}
      <View className="flex-row items-center justify-center gap-5 mb-4">
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 rounded bg-primary/20" />
          <Text className="text-small text-content-muted dark:text-content-dark-muted">Free</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 rounded bg-content-muted/30 dark:bg-content-dark-muted/40" />
          <Text className="text-small text-content-muted dark:text-content-dark-muted">Busy</Text>
        </View>
      </View>

      {/* Period header */}
      <View className="flex-row mb-2">
        <View className="w-12" />
        {PERIODS.map((p) => (
          <View key={p.key} className="flex-1 items-center">
            <Text className="text-small font-semibold text-content-secondary dark:text-content-dark-secondary">
              {p.label}
            </Text>
            <Text className="text-small text-content-muted dark:text-content-dark-muted">
              {p.hint}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid: rows = days, columns = periods */}
      <View className="gap-2">
        {DAYS.map((day) => (
          <View key={day.key} className="flex-row items-center gap-2">
            <Text className="w-10 text-caption font-medium text-content-secondary dark:text-content-dark-secondary">
              {day.label}
            </Text>
            {PERIODS.map((period) => {
              const busy = isBusy(day.key, period.key);
              return (
                <Pressable
                  key={period.key}
                  onPress={() => onToggle({ day: day.key, period: period.key })}
                  className={`flex-1 h-11 rounded-lg border items-center justify-center ${
                    busy
                      ? "bg-content-muted/25 dark:bg-content-dark-muted/30 border-content-muted/40 dark:border-content-dark-muted/40"
                      : "bg-primary/15 dark:bg-primary/20 border-primary/30 dark:border-primary/30"
                  }`}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: busy }}
                  accessibilityLabel={`${day.label} ${period.label}, ${busy ? "busy" : "free"}`}
                >
                  {busy && (
                    <Ionicons
                      name="close"
                      size={16}
                      className="text-content-secondary dark:text-content-dark-secondary"
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
