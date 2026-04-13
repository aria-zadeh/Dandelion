import "../global.css";
import React, { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import * as Notifications from "expo-notifications";
import { useSettingsStore } from "@/store/settingsStore";
import { useTaskStore } from "@/store/taskStore";
import {
  getCurrentUser,
  onAuthStateChange,
  syncTasksFromSupabase,
  syncSettingsFromSupabase,
} from "@/services/supabase";
import {
  requestNotificationPermissions,
  scheduleTaskReminders,
  checkAndFireWebReminders,
} from "@/services/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSchedulingStore } from "@/store/schedulingStore";
import type { User } from "@supabase/supabase-js";
import type { UserSettings } from "@/types";

// Show alerts + play sound; never badge (less stressful for Garrett)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  // Selectors kept atomic (no inline .map/.filter) to avoid infinite render loops
  // with Zustand v5 + React 19's useSyncExternalStore.
  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const addTaskDirect = useTaskStore((s) => s.addTask);
  const setLastSyncedAt = useTaskStore((s) => s.setLastSyncedAt);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  // Raw-select individual settings fields to build a stable UserSettings object.
  // Avoids creating a new object reference on every render (Zustand v5 discipline).
  const displayName = useSettingsStore((s) => s.displayName);
  const maxNotificationsPerHour = useSettingsStore((s) => s.maxNotificationsPerHour);
  const focusAudio = useSettingsStore((s) => s.focusAudio);
  const pomodoroEnabled = useSettingsStore((s) => s.pomodoroEnabled);
  const pomodoroWorkMinutes = useSettingsStore((s) => s.pomodoroWorkMinutes);
  const pomodoroBreakMinutes = useSettingsStore((s) => s.pomodoroBreakMinutes);
  const quietHoursStart = useSettingsStore((s) => s.quietHoursStart);
  const quietHoursEnd = useSettingsStore((s) => s.quietHoursEnd);
  const onboardingCompleteRaw = useSettingsStore((s) => s.onboardingComplete);
  const energyPeakStart = useSettingsStore((s) => s.energyPeakStart);
  const energyPeakEnd = useSettingsStore((s) => s.energyPeakEnd);
  const busyBlocks = useSettingsStore((s) => s.busyBlocks);
  const availabilityNotes = useSettingsStore((s) => s.availabilityNotes);
  const calendarEvents = useSettingsStore((s) => s.calendarEvents);
  const autoAcceptProposedSchedule = useSettingsStore((s) => s.autoAcceptProposedSchedule);
  const themePreference = useSettingsStore((s) => s.themePreference);

  // Stable UserSettings object — only rebuilds when a field actually changes
  const settings = useMemo<UserSettings>(
    () => ({
      displayName,
      maxNotificationsPerHour,
      focusAudio,
      pomodoroEnabled,
      pomodoroWorkMinutes,
      pomodoroBreakMinutes,
      quietHoursStart,
      quietHoursEnd,
      onboardingComplete: onboardingCompleteRaw,
      energyPeakStart,
      energyPeakEnd,
      busyBlocks,
      availabilityNotes,
      calendarEvents,
      autoAcceptProposedSchedule,
      themePreference,
    }),
    [
      displayName,
      maxNotificationsPerHour,
      focusAudio,
      pomodoroEnabled,
      pomodoroWorkMinutes,
      pomodoroBreakMinutes,
      quietHoursStart,
      quietHoursEnd,
      onboardingCompleteRaw,
      energyPeakStart,
      energyPeakEnd,
      busyBlocks,
      availabilityNotes,
      calendarEvents,
      autoAcceptProposedSchedule,
      themePreference,
    ]
  );

  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [devMode, setDevMode] = useState(false);

  // Zustand hydration + auth session check
  useEffect(() => {
    // Small delay to let Zustand hydrate from AsyncStorage
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Notification permissions — request once on mount, silently accept denial
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Reschedule notifications whenever tasks or settings change
  useEffect(() => {
    scheduleTaskReminders(tasks, settings);
  }, [tasks, settings]);

  // Web-only: register service worker + inject PWA manifest link
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker registration failed — non-fatal
      });
    }

    // Inject manifest link tag if not present
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/manifest.json";
      document.head.appendChild(link);
    }
  }, []);

  // Web-only: poll for notification triggers every 60 seconds
  useEffect(() => {
    if (Platform.OS !== "web") return;

    // Initial check
    checkAndFireWebReminders(tasks, settings);

    const interval = setInterval(() => {
      checkAndFireWebReminders(tasks, settings);
    }, 60_000);

    return () => clearInterval(interval);
  }, [tasks, settings]);

  useEffect(() => {
    let cancelled = false;

    // Check current session on mount
    getCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setAuthUser(user);
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthUser(null);
          setAuthLoading(false);
        }
      });

    // Subscribe to subsequent auth state changes (sign-in via magic link, sign-out)
    const unsubscribe = onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setAuthUser(session?.user ?? null);
        setAuthLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Poll for guest mode flag set by auth screen's "Guest Mode" button
  useEffect(() => {
    if (devMode) return;
    const check = setInterval(() => {
      if ((globalThis as Record<string, unknown>).__FOCAL_GUEST_MODE__) {
        setDevMode(true);
      }
    }, 200);
    return () => clearInterval(check);
  }, [devMode]);

  // On web, conditional Stack.Screen doesn't trigger a URL redirect — use router.replace
  // to imperatively navigate so the browser URL stays in sync with auth state.
  useEffect(() => {
    if (authLoading || !ready) return;
    if (devMode) return; // dev mode handles its own routing
    if (authUser === null) {
      router.replace("/auth");
    } else if (!onboardingCompleteRaw) {
      router.replace("/onboarding/welcome");
    }
  }, [authLoading, ready, authUser, onboardingCompleteRaw, router, devMode]);

  // Background sync — runs once when auth resolves. Non-blocking: app is
  // immediately usable with local data from AsyncStorage.
  useEffect(() => {
    if (!authUser) return;

    (async () => {
      try {
        // --- Tasks sync ---
        const { tasks: remoteTasks } = await syncTasksFromSupabase(authUser.id);

        // Build a lookup of current local tasks by id for O(1) access.
        // We read `tasks` from the closure (snapshot at effect invocation).
        const localById: Record<string, (typeof tasks)[number]> = {};
        for (const t of tasks) localById[t.id] = t;

        for (const remote of remoteTasks) {
          const local = localById[remote.id];
          if (!local) {
            // Task exists in Supabase but not locally — add it.
            // addTask generates its own id, so we use updateTask-style set via
            // the store's internal set. We instead call addTask then immediately
            // correct the id by patching with updateTask. Simpler: use zustand's
            // setState directly isn't exposed, so we upsert via the existing
            // actions: add (gets a new id), then delete the dupe. To avoid this
            // complexity, we call updateTask on the generated id… Not ideal.
            // Better approach: use addTask which returns an id, then overwrite
            // all fields to match remote. The id mismatch is handled below.
            const newId = addTaskDirect({
              title: remote.title,
              subject: remote.subject,
              description: remote.description,
              dueDate: remote.dueDate,
              startTime: remote.startTime,
              isAbstract: remote.isAbstract,
              difficulty: remote.difficulty,
              source: remote.source,
              externalId: remote.externalId,
              starterAction: remote.starterAction,
            });
            // addTask assigns a new generated id; we need the remote id.
            // Overwrite with remote data including the correct id.
            updateTask(newId, {
              ...remote,
              // updatedAt already set on remote — keep it
            });
          } else {
            // Task exists locally — Supabase wins if its updatedAt is newer.
            if (remote.updatedAt > local.updatedAt) {
              updateTask(remote.id, { ...remote });
            }
          }
        }
      } catch (taskErr) {
        console.warn("[Focal] Background task sync failed:", taskErr);
      }

      try {
        // --- Settings sync ---
        const remoteSettings = await syncSettingsFromSupabase(authUser.id);
        if (remoteSettings) {
          // Apply each settings key individually via updateSetting.
          (Object.keys(remoteSettings) as (keyof typeof remoteSettings)[]).forEach((key) => {
            const value = remoteSettings[key];
            if (value !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic key iteration
              updateSetting(key as any, value as any);
            }
          });
        }
      } catch (settingsErr) {
        console.warn("[Focal] Background settings sync failed:", settingsErr);
      }

      setLastSyncedAt(new Date().toISOString());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run only when authUser identity changes
  }, [authUser]);

  // Daily recalculation — re-propose schedules for unscheduled tasks
  // Throttled to run at most once per hour via AsyncStorage timestamp
  useEffect(() => {
    if (!ready || (authUser === null && !devMode)) return;

    (async () => {
      try {
        const THROTTLE_KEY = "focal-last-reschedule";
        const THROTTLE_MS = 60 * 60 * 1000; // 1 hour
        const lastRun = await AsyncStorage.getItem(THROTTLE_KEY);
        if (lastRun && Date.now() - Number(lastRun) < THROTTLE_MS) return;

        const allTasks = useTaskStore.getState().tasks;
        const settingsState = useSettingsStore.getState();
        const schedulingState = useSchedulingStore.getState();
        const now = new Date();

        for (const task of allTasks) {
          if (task.status === "complete") continue;
          if (task.scheduleStatus !== "unscheduled") continue;
          if (new Date(task.dueDate) <= now) continue;

          useTaskStore.getState().proposeSchedule(task.id, {
            calendarEvents: settingsState.calendarEvents,
            busyBlocks: settingsState.busyBlocks,
            quietHoursStart: settingsState.quietHoursStart,
            quietHoursEnd: settingsState.quietHoursEnd,
            energyPeakStart: settingsState.energyPeakStart,
            energyPeakEnd: settingsState.energyPeakEnd,
            signals: schedulingState.signals,
          });
        }

        await AsyncStorage.setItem(THROTTLE_KEY, String(Date.now()));
      } catch {
        // Best-effort — never block app startup
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once after hydration + auth
  }, [ready, authUser, devMode]);

  // Force app-wide color scheme based on user's theme preference.
  // NativeWind's setColorScheme adds/removes the `dark` class on <html> for web.
  useEffect(() => {
    setColorScheme(themePreference === "system" ? "system" : themePreference);
  }, [themePreference, setColorScheme]);

  // Wait for both Zustand hydration and initial auth check
  if (authLoading || !ready) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {/* No session → show auth screen (unless dev mode) */}
        {authUser === null && !devMode ? (
          <Stack.Screen name="auth" />
        ) : !onboardingCompleteRaw ? (
          /* Session exists but onboarding not done → onboarding flow */
          <Stack.Screen name="onboarding" />
        ) : (
          /* Fully authenticated + onboarded → main app */
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="task/new"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="task/[id]"
              options={{ animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="focus/session"
              options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="settings/busy-times"
              options={{ animation: "slide_from_right" }}
            />
          </>
        )}
      </Stack>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </>
  );
}
