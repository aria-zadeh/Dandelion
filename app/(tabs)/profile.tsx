import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Switch, Pressable, Modal } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useInsightsStore } from "@/store/insightsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { AUDIO_PICKER_OPTIONS } from "@/utils/audioConfig";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getCurrentUser, signOut } from "@/services/supabase";

function HourChart({ data }: { data: Record<number, number> }) {
  const max = Math.max(...Object.values(data), 1);
  // Show 8am-11pm range
  const hours = Array.from({ length: 16 }, (_, i) => i + 8);

  return (
    <View className="flex-row items-end justify-between h-24 mt-2">
      {hours.map((h) => {
        const val = data[h] || 0;
        const height = max > 0 ? (val / max) * 80 : 0;
        const isActive = val > 0;
        return (
          <View key={h} className="items-center flex-1">
            <View
              className={`w-2.5 rounded-full ${isActive ? "bg-primary" : "bg-surface-elevated dark:bg-surface-dark-elevated"}`}
              style={{ height: Math.max(height, 4) }}
            />
            {h % 4 === 0 && (
              <Text className="text-[10px] text-content-muted dark:text-content-dark-muted mt-1">
                {h > 12 ? `${h - 12}p` : h === 12 ? "12p" : `${h}a`}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { getCompletionsByHour, getCurrentStreak, getWeeklyCompletionCount, getBestTimeToday } =
    useInsightsStore();
  const settings = useSettingsStore();

  const byHour = getCompletionsByHour();
  const streak = getCurrentStreak();
  const weeklyCount = getWeeklyCompletionCount();
  const bestTime = getBestTimeToday();

  const [showMaxNotifPicker, setShowMaxNotifPicker] = useState(false);
  const [showQuietHoursPicker, setShowQuietHoursPicker] = useState(false);
  const [showAudioPicker, setShowAudioPicker] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  useEffect(() => {
    getCurrentUser()
      .then((u) => setUserEmail(u?.email ?? null))
      .catch(() => {});
  }, []);

  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="pt-4 pb-4">
          <Text className="text-title font-bold text-content dark:text-content-dark-primary">
            Profile
          </Text>
        </View>

        {/* --- INSIGHTS SECTION --- */}
        <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mb-3">
          Insights
        </Text>

        {/* Stats row */}
        <View className="flex-row gap-3 mb-4">
          <Card variant="flat" className="flex-1">
            <Text className="text-display font-bold text-primary dark:text-primary">
              {streak}
            </Text>
            <Text className="text-small text-content-secondary dark:text-content-dark-secondary mt-1">
              day streak
            </Text>
          </Card>
          <Card variant="flat" className="flex-1">
            <Text className="text-display font-bold text-success dark:text-success">
              {weeklyCount}
            </Text>
            <Text className="text-small text-content-secondary dark:text-content-dark-secondary mt-1">
              this week
            </Text>
          </Card>
        </View>

        {/* Best time chip */}
        <View className="flex-row items-center bg-primary/8 dark:bg-primary/15 rounded-lg px-4 py-3 mb-4">
          <Ionicons name="flash-outline" size={18} className="text-primary dark:text-primary" />
          <Text className="text-body font-medium text-content dark:text-content-dark-primary ml-2">
            Your best time today: {bestTime}
          </Text>
        </View>

        {/* Productivity chart */}
        <Card variant="default" className="mb-6">
          <Text className="text-caption font-semibold text-content dark:text-content-dark-primary mb-1">
            Activity by hour (last 7 days)
          </Text>
          <HourChart data={byHour} />
        </Card>

        {/* --- SETTINGS SECTION --- */}
        <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mb-3">
          Settings
        </Text>

        {/* Appearance */}
        <Card variant="default" className="mb-3">
          <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary mb-3 uppercase tracking-wide">
            Appearance
          </Text>
          <View className="flex-row items-center gap-2">
            {(["light", "dark", "system"] as const).map((option) => {
              const isSelected = settings.themePreference === option;
              const icons = { light: "sunny-outline", dark: "moon-outline", system: "phone-portrait-outline" } as const;
              const labels = { light: "Light", dark: "Dark", system: "System" };
              return (
                <Pressable
                  key={option}
                  onPress={() => settings.updateSetting("themePreference", option)}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-lg min-h-[44px] ${
                    isSelected
                      ? "bg-primary"
                      : "bg-surface-elevated dark:bg-surface-dark-elevated"
                  }`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${labels[option]} theme${isSelected ? ", selected" : ""}`}
                >
                  <Ionicons
                    name={icons[option]}
                    size={16}
                    color={isSelected ? "hsl(30, 10%, 10%)" : undefined}
                    className={isSelected ? "" : "text-content-secondary dark:text-content-dark-secondary"}
                  />
                  <Text
                    className={`text-caption font-semibold ${
                      isSelected
                        ? "text-primary-foreground"
                        : "text-content-secondary dark:text-content-dark-secondary"
                    }`}
                  >
                    {labels[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Focus settings */}
        <Card variant="default" className="mb-3">
          <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary mb-3 uppercase tracking-wide">
            Focus
          </Text>
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center flex-1">
              <Ionicons name="timer-outline" size={20} className="text-content-secondary dark:text-content-dark-secondary" />
              <Text className="text-body text-content dark:text-content-dark-primary ml-3">
                Pomodoro timer
              </Text>
            </View>
            <Switch
              value={settings.pomodoroEnabled}
              onValueChange={(val) => settings.updateSetting("pomodoroEnabled", val)}
              trackColor={{ false: "hsl(30, 15%, 85%)", true: "hsl(35, 85%, 55%)" }}
              accessibilityLabel="Toggle pomodoro timer"
            />
          </View>
          <SettingRow
            icon="musical-notes-outline"
            label="Focus audio"
            value={settings.focusAudio === "none" ? "Off" : settings.focusAudio.replace("_", " ")}
            onPress={() => setShowAudioPicker(true)}
          />
        </Card>

        {/* Notification settings */}
        <Card variant="default" className="mb-3">
          <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary mb-3 uppercase tracking-wide">
            Notifications
          </Text>
          <SettingRow
            icon="notifications-outline"
            label="Max per hour"
            value={`${settings.maxNotificationsPerHour}`}
            onPress={() => setShowMaxNotifPicker(true)}
          />
          <SettingRow
            icon="moon-outline"
            label="Quiet hours"
            value={`${settings.quietHoursStart > 12 ? settings.quietHoursStart - 12 : settings.quietHoursStart}pm - ${settings.quietHoursEnd}am`}
            onPress={() => setShowQuietHoursPicker(true)}
          />
        </Card>

        {/* Scheduling */}
        <Card variant="default" className="mb-3">
          <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary mb-3 uppercase tracking-wide">
            Scheduling
          </Text>
          <SettingRow
            icon="calendar-outline"
            label="Busy Times"
            value=""
            onPress={() => router.push("/settings/busy-times")}
          />
        </Card>

        {/* Account */}
        {userEmail && (
          <Card variant="default" className="mb-3">
            <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary mb-3 uppercase tracking-wide">
              Account
            </Text>
            <View className="flex-row items-center py-3 border-b border-border/30 dark:border-border-dark/30">
              <Ionicons name="mail-outline" size={20} className="text-content-secondary dark:text-content-dark-secondary" />
              <Text className="text-body text-content dark:text-content-dark-primary ml-3">
                {userEmail}
              </Text>
            </View>
            <Pressable
              onPress={() => signOut()}
              className="flex-row items-center py-3 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Ionicons name="log-out-outline" size={20} className="text-danger dark:text-danger" />
              <Text className="text-body text-danger dark:text-danger ml-3 font-medium">
                Sign out
              </Text>
            </Pressable>
          </Card>
        )}
        {/* Max Notifications Picker Modal */}
        <Modal visible={showMaxNotifPicker} transparent animationType="fade" onRequestClose={() => setShowMaxNotifPicker(false)}>
          <Pressable className="flex-1 bg-black/40 justify-center items-center" onPress={() => setShowMaxNotifPicker(false)}>
            <Pressable className="bg-surface-card dark:bg-surface-dark-card rounded-2xl p-6 mx-8 w-[85%] max-w-[340px]" onPress={(e) => e.stopPropagation()}>
              <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mb-4">Max notifications per hour</Text>
              <View className="flex-row flex-wrap gap-2">
                {[1, 2, 3, 5, 10].map((val) => {
                  const isSelected = settings.maxNotificationsPerHour === val;
                  return (
                    <Pressable
                      key={val}
                      onPress={() => { settings.updateSetting("maxNotificationsPerHour", val); setShowMaxNotifPicker(false); }}
                      className={`px-5 py-3 rounded-xl min-w-[56px] items-center ${isSelected ? "bg-primary" : "bg-surface-elevated dark:bg-surface-dark-elevated"}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${val} per hour${isSelected ? ", selected" : ""}`}
                    >
                      <Text className={`text-body font-semibold ${isSelected ? "text-primary-foreground" : "text-content dark:text-content-dark-primary"}`}>{val}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Quiet Hours Picker Modal */}
        <Modal visible={showQuietHoursPicker} transparent animationType="fade" onRequestClose={() => setShowQuietHoursPicker(false)}>
          <Pressable className="flex-1 bg-black/40 justify-center items-center" onPress={() => setShowQuietHoursPicker(false)}>
            <Pressable className="bg-surface-card dark:bg-surface-dark-card rounded-2xl p-6 mx-8 w-[85%] max-w-[340px]" onPress={(e) => e.stopPropagation()}>
              <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mb-4">Quiet hours</Text>
              <Text className="text-caption text-content-secondary dark:text-content-dark-secondary mb-3">No notifications during these hours</Text>
              <View className="mb-4">
                <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary mb-2">Starts at</Text>
                <View className="flex-row flex-wrap gap-2">
                  {[20, 21, 22, 23, 0].map((h) => {
                    const isSelected = settings.quietHoursStart === h;
                    const label = h === 0 ? "12am" : h > 12 ? `${h - 12}pm` : `${h}am`;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => settings.updateSetting("quietHoursStart", h)}
                        className={`px-4 py-2.5 rounded-xl ${isSelected ? "bg-primary" : "bg-surface-elevated dark:bg-surface-dark-elevated"}`}
                        accessibilityRole="button"
                      >
                        <Text className={`text-caption font-semibold ${isSelected ? "text-primary-foreground" : "text-content dark:text-content-dark-primary"}`}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View className="mb-4">
                <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary mb-2">Ends at</Text>
                <View className="flex-row flex-wrap gap-2">
                  {[5, 6, 7, 8, 9].map((h) => {
                    const isSelected = settings.quietHoursEnd === h;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => settings.updateSetting("quietHoursEnd", h)}
                        className={`px-4 py-2.5 rounded-xl ${isSelected ? "bg-primary" : "bg-surface-elevated dark:bg-surface-dark-elevated"}`}
                        accessibilityRole="button"
                      >
                        <Text className={`text-caption font-semibold ${isSelected ? "text-primary-foreground" : "text-content dark:text-content-dark-primary"}`}>{h}am</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Pressable onPress={() => setShowQuietHoursPicker(false)} className="bg-primary rounded-xl py-3 items-center mt-2" accessibilityRole="button">
                <Text className="text-body font-semibold text-primary-foreground">Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Focus Audio Picker Modal */}
        <Modal visible={showAudioPicker} transparent animationType="fade" onRequestClose={() => setShowAudioPicker(false)}>
          <Pressable className="flex-1 bg-black/40 justify-center items-center" onPress={() => setShowAudioPicker(false)}>
            <Pressable className="bg-surface-card dark:bg-surface-dark-card rounded-2xl p-6 mx-8 w-[85%] max-w-[340px]" onPress={(e) => e.stopPropagation()}>
              <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mb-4">Focus audio</Text>
              {AUDIO_PICKER_OPTIONS.map(({ type, label, icon }) => {
                const isSelected = settings.focusAudio === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => { settings.updateSetting("focusAudio", type); setShowAudioPicker(false); }}
                    className={`flex-row items-center px-4 py-3.5 rounded-xl mb-2 ${isSelected ? "bg-primary" : "bg-surface-elevated dark:bg-surface-dark-elevated"}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}${isSelected ? ", selected" : ""}`}
                  >
                    <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={isSelected ? "hsl(30, 10%, 10%)" : undefined} className={isSelected ? "" : "text-content-secondary dark:text-content-dark-secondary"} />
                    <Text className={`text-body font-medium ml-3 ${isSelected ? "text-primary-foreground" : "text-content dark:text-content-dark-primary"}`}>{label}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="hsl(30, 10%, 10%)" style={{ marginLeft: "auto" }} />}
                  </Pressable>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between py-3 border-b border-border/30 dark:border-border-dark/30"
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <View className="flex-row items-center flex-1">
        <Ionicons name={icon} size={20} className="text-content-secondary dark:text-content-dark-secondary" />
        <Text className="text-body text-content dark:text-content-dark-primary ml-3">
          {label}
        </Text>
      </View>
      <View className="flex-row items-center">
        <Text className="text-caption text-content-muted dark:text-content-dark-muted mr-1">
          {value}
        </Text>
        <Ionicons name="chevron-forward" size={16} className="text-content-muted dark:text-content-dark-muted" />
      </View>
    </Pressable>
  );
}
