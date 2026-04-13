import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BusyBlockGrid } from "@/components/ui/BusyBlockGrid";
import { AddEventModal } from "@/components/ui/AddEventModal";
import { useSettingsStore } from "@/store/settingsStore";
import type { CalendarEvent } from "@/types";

function formatEventTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, "0")}${ampm}`;
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function BusyTimesScreen() {
  const insets = useSafeAreaInsets();
  const busyBlocks = useSettingsStore((s) => s.busyBlocks);
  const toggleBusyBlock = useSettingsStore((s) => s.toggleBusyBlock);
  const calendarEvents = useSettingsStore((s) => s.calendarEvents);
  const addCalendarEvent = useSettingsStore((s) => s.addCalendarEvent);
  const deleteCalendarEvent = useSettingsStore((s) => s.deleteCalendarEvent);

  const [showAddModal, setShowAddModal] = useState(false);

  // Filter out past events, sort by date
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    return calendarEvents
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [calendarEvents]);

  return (
    <View
      className="flex-1 bg-surface dark:bg-surface-dark"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 border-b border-border dark:border-border-dark">
        <Pressable
          onPress={() => router.back()}
          className="min-w-[44px] min-h-[44px] items-center justify-center mr-3"
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} className="text-content dark:text-content-dark-primary" />
        </Pressable>
        <Text className="text-heading font-bold text-content dark:text-content-dark-primary flex-1">
          Busy Times
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8 pt-5">
        {/* Weekly grid section */}
        <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary uppercase tracking-wide mb-3">
          Weekly Schedule
        </Text>
        <View className="bg-surface-card dark:bg-surface-dark-card rounded-2xl p-4 mb-6 border border-border dark:border-border-dark">
          <BusyBlockGrid busyBlocks={busyBlocks} onToggle={toggleBusyBlock} />
        </View>

        {/* One-off events section */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary uppercase tracking-wide">
            One-Off Events
          </Text>
          <Pressable
            onPress={() => setShowAddModal(true)}
            className="min-w-[44px] min-h-[44px] items-center justify-center"
            accessibilityLabel="Add a one-off event"
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={24} className="text-primary dark:text-primary" />
          </Pressable>
        </View>

        {upcomingEvents.length === 0 ? (
          <View className="bg-surface-card dark:bg-surface-dark-card rounded-2xl p-5 border border-border dark:border-border-dark items-center">
            <Text className="text-body text-content-muted dark:text-content-dark-muted text-center">
              No upcoming events. Tap + to add times you're busy.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {upcomingEvents.map((event) => (
              <View
                key={event.id}
                className="bg-surface-card dark:bg-surface-dark-card rounded-xl px-4 py-3 border border-border dark:border-border-dark flex-row items-center"
              >
                <View className="flex-1">
                  <Text className="text-body font-medium text-content dark:text-content-dark-primary">
                    {event.title}
                  </Text>
                  <Text className="text-small text-content-secondary dark:text-content-dark-secondary mt-0.5">
                    {formatEventDate(event.date)} · {formatEventTime(event.startTime)}–{formatEventTime(event.endTime)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => deleteCalendarEvent(event.id)}
                  className="min-w-[44px] min-h-[44px] items-center justify-center"
                  accessibilityLabel={`Delete ${event.title}`}
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={20} className="text-danger dark:text-danger" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <AddEventModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={(event) => addCalendarEvent(event)}
      />
    </View>
  );
}
