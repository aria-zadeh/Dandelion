import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserSettings, FocusAudio, BusyBlock, CalendarEvent } from "@/types";
import { generateId } from "@/types";

interface SettingsState extends UserSettings {
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  completeOnboarding: () => void;
  setEnergyPeak: (start: number, end: number) => void;
  toggleBusyBlock: (block: BusyBlock) => void;
  setAvailabilityNotes: (notes: string) => void;
  addCalendarEvent: (event: Omit<CalendarEvent, "id" | "createdAt">) => string;
  updateCalendarEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Defaults
      displayName: null,
      maxNotificationsPerHour: 1,
      focusAudio: "none" as FocusAudio,
      pomodoroEnabled: true,
      pomodoroWorkMinutes: 25,
      pomodoroBreakMinutes: 5,
      quietHoursStart: 23,
      quietHoursEnd: 8,
      onboardingComplete: false,
      energyPeakStart: 15, // 3pm default (Garrett's midday energy)
      energyPeakEnd: 17,   // 5pm
      busyBlocks: [],
      availabilityNotes: "",
      calendarEvents: [],
      autoAcceptProposedSchedule: false,
      themePreference: "system" as "light" | "dark" | "system",
      webPushSubscription: null,

      updateSetting: (key, value) => {
        set({ [key]: value } as Partial<SettingsState>);
      },

      completeOnboarding: () => {
        set({ onboardingComplete: true });
      },

      setEnergyPeak: (start, end) => {
        set({ energyPeakStart: start, energyPeakEnd: end });
      },

      toggleBusyBlock: (block) => {
        set((state) => {
          const exists = state.busyBlocks.some(
            (b) => b.day === block.day && b.period === block.period
          );
          return {
            busyBlocks: exists
              ? state.busyBlocks.filter(
                  (b) => !(b.day === block.day && b.period === block.period)
                )
              : [...state.busyBlocks, block],
          };
        });
      },

      setAvailabilityNotes: (notes) => {
        set({ availabilityNotes: notes });
      },

      addCalendarEvent: (eventData) => {
        const id = generateId();
        const event: CalendarEvent = {
          ...eventData,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          calendarEvents: [...state.calendarEvents, event],
        }));
        return id;
      },

      updateCalendarEvent: (id, updates) => {
        set((state) => ({
          calendarEvents: state.calendarEvents.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        }));
      },

      deleteCalendarEvent: (id) => {
        set((state) => ({
          calendarEvents: state.calendarEvents.filter((e) => e.id !== id),
        }));
      },
    }),
    {
      name: "dandelion-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
