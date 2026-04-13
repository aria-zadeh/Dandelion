import React, { useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import { useColorScheme } from "nativewind";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Calendar as RNCalendar } from "react-native-calendars";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTaskStore } from "@/store/taskStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { DayKey, PeriodKey } from "@/types";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

// Layout constants — time grid math lives here so it's easy to tune.
const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR; // 16
const GRID_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 960
const TIME_LABEL_WIDTH = 40;
const ALL_DAY_ROW_MIN_HEIGHT = 28;
const MIN_BLOCK_HEIGHT = 30;
const SNAP_INCREMENT = HOUR_HEIGHT / 4; // 15px per 15 minutes
const VISIBLE_DAYS = 3;

type ViewMode = "week" | "month";

interface TimedBlock {
  id: string;
  taskId: string; // for navigation to task detail
  day: number; // 0 = Monday … 6 = Sunday
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  title: string;
  /** true when this is a standalone Type A timed task (has startTime, no subtasks) */
  isTypeA?: boolean;
  /** true when this is an algorithm-proposed block (dashed border, pending confirm) */
  isProposed?: boolean;
  /** true when this is a CalendarEvent (one-off busy event) */
  isCalendarEvent?: boolean;
  /** Present when this block is part of an AI-broken-down task */
  parentId?: string;
  parentTitle?: string;
  subtaskIndex?: number;
  isComplete?: boolean;
  /** Number of subtasks when this block represents a collapsed parent */
  subtaskCount?: number;
}

interface AllDayBlock {
  id: string;
  taskId: string; // for navigation to task detail
  day: number;
  title: string;
}

interface BusyBlock {
  id: string;
  day: number;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
}

// --- Helpers ---

/**
 * Returns the Monday that starts the displayed week.
 * Convention: Mon–Sun. If today is Sunday (end of ISO week), we show the
 * UPCOMING week (next Mon–Sun) so that tasks due "tomorrow" (Monday) are
 * always visible — which matches the default due date in task/new.tsx.
 */
function getMondayOfCurrentWeek(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sunday, 1 = Monday … 6 = Saturday
  // Sunday → advance to next Monday (+1); otherwise go back to this Monday
  const diff = dow === 0 ? 1 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(hour: number, minute: number): string {
  const suffix = hour >= 12 ? "pm" : "am";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute === 0 ? "" : `:${minute.toString().padStart(2, "0")}`;
  return `${h}${m}${suffix}`;
}

function topForTime(hour: number, minute: number): number {
  return (hour - START_HOUR) * HOUR_HEIGHT + (minute / 60) * HOUR_HEIGHT;
}

function heightForDuration(minutes: number): number {
  return Math.max((minutes / 60) * HOUR_HEIGHT, MIN_BLOCK_HEIGHT);
}

/**
 * Returns the day index (0–6, Monday=0) within a week starting at weekStart,
 * or -1 if the date falls outside that week.
 */
function getDayIndex(date: Date, weekStart: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const ws = new Date(weekStart);
  ws.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - ws.getTime()) / (24 * 60 * 60 * 1000));
  return diff >= 0 && diff < 7 ? diff : -1;
}

/** Snap a pixel offset to nearest 15-minute increment */
function snapToGrid(pixelY: number): number {
  return Math.round(pixelY / SNAP_INCREMENT) * SNAP_INCREMENT;
}

/** Clamp timed block top to stay within grid bounds */
function clampTop(top: number, blockHeight: number): number {
  const maxTop = GRID_HEIGHT - blockHeight;
  return Math.max(0, Math.min(top, maxTop));
}

/** Convert pixel Y (relative to grid top) to hour + minute */
function pixelToTime(pixelY: number): { hour: number; minute: number } {
  const snapped = snapToGrid(pixelY);
  const totalMinutesFromStart = (snapped / HOUR_HEIGHT) * 60;
  const hour = Math.floor(totalMinutesFromStart / 60) + START_HOUR;
  const minute = Math.round(totalMinutesFromStart % 60);
  // Clamp hour to valid range
  const clampedHour = Math.max(START_HOUR, Math.min(END_HOUR - 1, hour));
  const clampedMinute = clampedHour === END_HOUR - 1 ? 0 : minute;
  return { hour: clampedHour, minute: clampedMinute };
}

/** Build an ISO startTime string from a date + hour + minute */
function buildStartTimeISO(dueDateISO: string, hour: number, minute: number): string {
  const d = new Date(dueDateISO);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Build an ISO dueDate string for day column index within the current week */
function buildDueDateISO(weekStart: Date, dayIndex: number): string {
  const d = addDays(weekStart, dayIndex);
  d.setHours(12, 0, 0, 0); // noon — keeps date-only parsing stable
  return d.toISOString();
}

/**
 * Assign non-overlapping column positions to timed blocks (Google Calendar style).
 * Returns a Map from block.id → { col, totalCols } for layout math.
 */
function computeColumnLayout(
  blocks: TimedBlock[]
): Map<string, { col: number; totalCols: number }> {
  const layout = new Map<string, { col: number; totalCols: number }>();
  if (blocks.length === 0) return layout;

  const getStart = (b: TimedBlock) => b.startHour * 60 + b.startMinute;
  const getEnd = (b: TimedBlock) => getStart(b) + b.durationMinutes;

  // Group subtasks by parentId into "span blocks" so an entire task group
  // occupies one column instead of each subtask fighting for its own.
  // Standalone blocks (Type A, calendar events, ungrouped) are their own span.
  interface SpanBlock { key: string; start: number; end: number; blockIds: string[] }
  const spanMap = new Map<string, SpanBlock>();
  for (const b of blocks) {
    const groupKey = b.parentId ?? b.id; // subtasks share parentId, others use own id
    const existing = spanMap.get(groupKey);
    const s = getStart(b);
    const e = getEnd(b);
    if (existing) {
      existing.start = Math.min(existing.start, s);
      existing.end = Math.max(existing.end, e);
      existing.blockIds.push(b.id);
    } else {
      spanMap.set(groupKey, { key: groupKey, start: s, end: e, blockIds: [b.id] });
    }
  }
  const spans = [...spanMap.values()].sort((a, b) => a.start - b.start);

  // Greedy column assignment on span blocks
  const colEnds: number[] = [];
  const spanAssigned: { span: SpanBlock; col: number }[] = [];

  for (const span of spans) {
    let col = colEnds.findIndex((end) => end <= span.start);
    if (col === -1) col = colEnds.length;
    colEnds[col] = span.end;
    spanAssigned.push({ span, col });
  }

  // BFS connected components on spans for transitive overlap resolution
  const n = spans.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (spans[j].start < spans[i].end && spans[j].end > spans[i].start) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  const visited = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const component: number[] = [i];
    visited[i] = 1;
    let head = 0;
    while (head < component.length) {
      for (const nb of adj[component[head]]) {
        if (!visited[nb]) {
          visited[nb] = 1;
          component.push(nb);
        }
      }
      head++;
    }
    let maxCol = 0;
    for (const idx of component) {
      maxCol = Math.max(maxCol, spanAssigned[idx].col);
    }
    const totalCols = maxCol + 1;
    // Assign every individual block in this span the same col/totalCols
    for (const idx of component) {
      const { span, col } = spanAssigned[idx];
      for (const blockId of span.blockIds) {
        layout.set(blockId, { col, totalCols });
      }
    }
  }

  return layout;
}

// --- Component ---

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [mode, setMode] = useState<ViewMode>("week");

  const screenWidth = Dimensions.get("window").width;
  const dayColumnWidth = (screenWidth - 40 - TIME_LABEL_WIDTH) / VISIBLE_DAYS;

  const weekStart = useMemo(() => getMondayOfCurrentWeek(), []);
  const today = useMemo(() => new Date(), []);

  // Raw selectors — NO inline derivation to avoid infinite render loops
  const tasks = useTaskStore((s) => s.tasks);
  const updateTask = useTaskStore((s) => s.updateTask);
  const busyBlocks = useSettingsStore((s) => s.busyBlocks);
  const calendarEvents = useSettingsStore((s) => s.calendarEvents);
  const addCalendarEvent = useSettingsStore((s) => s.addCalendarEvent);
  const energyPeakStart = useSettingsStore((s) => s.energyPeakStart);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return {
          index: i,
          date,
          label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
          dateNum: date.getDate(),
          isToday: sameDay(date, today),
        };
      }),
    [weekStart, today]
  );

  const todayIndex = useMemo(() => {
    const idx = days.findIndex((d) => d.isToday);
    return idx >= 0 ? idx : 0;
  }, [days]);

  const [visibleStartIndex, setVisibleStartIndex] = useState(0);

  // Set initial visible start to today's index on mount
  React.useEffect(() => {
    setVisibleStartIndex(todayIndex);
  }, [todayIndex]);

  const visibleDays = useMemo(
    () => days.slice(visibleStartIndex, visibleStartIndex + VISIBLE_DAYS),
    [days, visibleStartIndex]
  );

  const handlePrevDays = useCallback(() => {
    setVisibleStartIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextDays = useCallback(() => {
    setVisibleStartIndex((prev) => Math.min(7 - VISIBLE_DAYS, prev + 1));
  }, []);

  // Derive timed and all-day blocks from real task data.
  // Priority:
  //   startTime + no subtasks  → Type A (standalone timed block)
  //   startTime + subtasks     → Type C anchored at startTime
  //   no startTime + no subtasks → Type B (all-day pill)
  //   no startTime + subtasks  → Type C at energy peak
  const { timedBlocks, allDayBlocks } = useMemo(() => {
    const timed: TimedBlock[] = [];
    const allDay: AllDayBlock[] = [];

    for (const task of tasks) {
      if (task.status === "complete") continue;

      const taskDate = new Date(task.dueDate);
      const dayIndex = getDayIndex(taskDate, weekStart);
      if (dayIndex < 0 || dayIndex > 6) continue;

      const hasSubtasks = task.subtasks.length > 0;

      // Determine the effective anchor: startTime (confirmed) or proposedTime (proposed)
      const effectiveTime = task.startTime ?? (task.proposedTime && task.scheduleStatus === "proposed" ? task.proposedTime : undefined);
      const isProposed = !task.startTime && !!task.proposedTime && task.scheduleStatus === "proposed";

      if (effectiveTime) {
        // Parse effectiveTime to get hour/minute anchor
        const st = new Date(effectiveTime);
        const anchorHour = st.getHours();
        const anchorMinute = st.getMinutes();

        // Also resolve dayIndex from proposed time — it may differ from the dueDate
        const effectiveDayIndex = isProposed ? getDayIndex(st, weekStart) : dayIndex;
        if (effectiveDayIndex < 0 || effectiveDayIndex > 6) continue;

        if (!hasSubtasks) {
          // Type A — standalone timed block (or proposed)
          const defaultDurationMinutes = task.durationMinutes ?? 60;
          timed.push({
            id: task.id,
            taskId: task.id,
            day: isProposed ? effectiveDayIndex : dayIndex,
            startHour: anchorHour,
            startMinute: anchorMinute,
            durationMinutes: defaultDurationMinutes,
            title: task.title,
            isTypeA: true,
            isProposed,
            isComplete: false, // complete tasks are skipped above
          });
        } else {
          // Type C -> single parent block spanning total subtask duration
          const totalDuration = task.subtasks.reduce((sum, s) => sum + (s.estimatedMinutes || 15), 0);
          const subtaskDay = isProposed ? effectiveDayIndex : dayIndex;
          timed.push({
            id: task.id,
            taskId: task.id,
            day: subtaskDay,
            startHour: anchorHour,
            startMinute: anchorMinute,
            durationMinutes: totalDuration,
            title: task.title,
            isTypeA: true,
            isProposed,
            isComplete: false,
            subtaskCount: task.subtasks.length,
          });
        }
      } else if (!hasSubtasks) {
        // Type B — no startTime, no subtasks → all-day pill
        allDay.push({
          id: task.id,
          taskId: task.id,
          day: dayIndex,
          title: task.title,
        });
      } else {
        // Type C — no startTime, has subtasks -> single block at energy peak
        const peakStart = energyPeakStart ?? 15;
        const totalDuration = task.subtasks.reduce((sum, s) => sum + (s.estimatedMinutes || 15), 0);
        timed.push({
          id: task.id,
          taskId: task.id,
          day: dayIndex,
          startHour: peakStart,
          startMinute: 0,
          durationMinutes: totalDuration,
          title: task.title,
          isTypeA: true,
          isComplete: false,
          subtaskCount: task.subtasks.length,
        });
      }
    }

    // Convert CalendarEvent entries into timed blocks (gray event blocks)
    for (const event of calendarEvents) {
      const evDate = new Date(event.date + "T00:00:00");
      const evDayIndex = getDayIndex(evDate, weekStart);
      if (evDayIndex < 0 || evDayIndex > 6) continue;

      const [sh, sm] = event.startTime.split(":").map(Number);
      const [eh, em] = event.endTime.split(":").map(Number);
      const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
      if (durationMinutes <= 0) continue;

      timed.push({
        id: `cal-event-${event.id}`,
        taskId: event.id, // not a real task — handled in press
        day: evDayIndex,
        startHour: sh,
        startMinute: sm,
        durationMinutes,
        title: event.title,
        isCalendarEvent: true,
      });
    }

    return { timedBlocks: timed, allDayBlocks: allDay };
  }, [tasks, weekStart, energyPeakStart, calendarEvents]);

  // Transform settings busy blocks into calendar-renderable BusyBlock[]
  const busyBlocksData = useMemo(() => {
    const DAY_MAP: Record<DayKey, number> = {
      mon: 0,
      tue: 1,
      wed: 2,
      thu: 3,
      fri: 4,
      sat: 5,
      sun: 6,
    };
    const PERIOD_MAP: Record<PeriodKey, { startHour: number; durationMinutes: number }> = {
      morning: { startHour: 8, durationMinutes: 240 },   // 8am–12pm
      afternoon: { startHour: 12, durationMinutes: 300 }, // 12pm–5pm
      evening: { startHour: 17, durationMinutes: 240 },   // 5pm–9pm
    };

    return busyBlocks.map((b, i): BusyBlock => ({
      id: `busy-${i}`,
      day: DAY_MAP[b.day],
      startHour: PERIOD_MAP[b.period].startHour,
      startMinute: 0,
      durationMinutes: PERIOD_MAP[b.period].durationMinutes,
    }));
  }, [busyBlocks]);

  // Group timed blocks by day for simpler rendering.
  const blocksByDay = useMemo(() => {
    const byDay: Record<number, TimedBlock[]> = {};
    for (let i = 0; i < 7; i++) byDay[i] = [];
    for (const b of timedBlocks) byDay[b.day].push(b);
    // Sort each day by start time
    for (const key of Object.keys(byDay)) {
      byDay[Number(key)].sort((a, b) => {
        const aMin = a.startHour * 60 + a.startMinute;
        const bMin = b.startHour * 60 + b.startMinute;
        return aMin - bMin;
      });
    }
    return byDay;
  }, [timedBlocks]);

  const allDayByDay = useMemo(() => {
    const byDay: Record<number, AllDayBlock[]> = {};
    for (let i = 0; i < 7; i++) byDay[i] = [];
    for (const b of allDayBlocks) byDay[b.day].push(b);
    return byDay;
  }, [allDayBlocks]);

  const busyByDay = useMemo(() => {
    const byDay: Record<number, BusyBlock[]> = {};
    for (let i = 0; i < 7; i++) byDay[i] = [];
    for (const b of busyBlocksData) byDay[b.day].push(b);
    return byDay;
  }, [busyBlocksData]);

  const hasAnyEvents = timedBlocks.length > 0 || allDayBlocks.length > 0;

  // Slot action menu state
  const [showSlotMenu, setShowSlotMenu] = useState(false);
  const [menuSlotDate, setMenuSlotDate] = useState<Date | null>(null);
  const [menuSlotHour, setMenuSlotHour] = useState<number>(9);
  // Busy event inline form state
  const [showBusyForm, setShowBusyForm] = useState(false);
  const [busyTitle, setBusyTitle] = useState("");
  const [busyEndHour, setBusyEndHour] = useState<number>(10);

  // Tapping a timed block navigates directly to the task detail screen.
  // Calendar event blocks are not navigable.
  const handleBlockPress = useCallback((block: TimedBlock) => {
    if (block.isCalendarEvent) return;
    router.push(`/task/${block.taskId}`);
  }, []);

  const handleLongPressSlot = useCallback(
    (dayIndex: number, hour: number) => {
      const date = addDays(weekStart, dayIndex);
      date.setHours(hour, 0, 0, 0);
      setMenuSlotDate(date);
      setMenuSlotHour(hour);
      setBusyEndHour(Math.min(hour + 1, END_HOUR));
      setShowBusyForm(false);
      setBusyTitle("");
      setShowSlotMenu(true);
    },
    [weekStart]
  );

  const handleSlotAddTask = useCallback(() => {
    if (!menuSlotDate) return;
    setShowSlotMenu(false);
    router.push({
      pathname: "/task/new",
      params: { prefillStart: menuSlotDate.toISOString() },
    });
  }, [menuSlotDate]);

  const handleSlotMarkBusy = useCallback(() => {
    if (!menuSlotDate) return;
    const dateStr = menuSlotDate.toISOString().slice(0, 10);
    const startTimeStr = `${menuSlotHour.toString().padStart(2, "0")}:00`;
    const endTimeStr = `${busyEndHour.toString().padStart(2, "0")}:00`;
    addCalendarEvent({
      title: busyTitle.trim() || "Busy",
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
    });
    setShowSlotMenu(false);
    setShowBusyForm(false);
    setBusyTitle("");
  }, [menuSlotDate, menuSlotHour, busyEndHour, busyTitle, addCalendarEvent]);

  // Persist a dragged timed block's new position
  const handleTimedBlockDrop = useCallback(
    (block: TimedBlock, newPixelY: number) => {
      // Only Type A standalone blocks own a startTime — subtask blocks share their
      // parent's startTime and dragging one would move all siblings.
      if (!block.isTypeA) return;
      const { hour, minute } = pixelToTime(newPixelY);
      // Find the parent task to get the dueDate for building the ISO string
      const parentTask = tasks.find((t) => t.id === block.taskId);
      if (!parentTask) return;
      const newStartTime = buildStartTimeISO(parentTask.dueDate, hour, minute);
      updateTask(block.taskId, { startTime: newStartTime });
    },
    [tasks, updateTask]
  );

  // Persist a dragged all-day block's new day column
  const handleAllDayBlockDrop = useCallback(
    (block: AllDayBlock, newDayIndex: number) => {
      const clampedDay = Math.max(0, Math.min(6, newDayIndex));
      const newDueDate = buildDueDateISO(weekStart, clampedDay);
      updateTask(block.taskId, { dueDate: newDueDate });
    },
    [weekStart, updateTask]
  );

  // Dot-marking for the month view from real task data
  const markedDates = useMemo(() => {
    const marks: Record<string, { marked: boolean; dotColor: string }> = {};
    const dotColor = isDark ? "hsl(35, 85%, 60%)" : "hsl(35, 85%, 45%)";
    for (const task of tasks) {
      if (task.status === "complete") continue;
      const dateKey = new Date(task.dueDate).toISOString().slice(0, 10);
      marks[dateKey] = { marked: true, dotColor };
    }
    return marks;
  }, [tasks, isDark]);

  return (
    <GestureHandlerRootView style={styles.flex1}>
      <View
        className="flex-1 bg-surface dark:bg-surface-dark"
        style={{ paddingTop: insets.top }}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-3">
          <Text className="text-title font-bold text-content dark:text-content-dark-primary">
            Calendar
          </Text>
        </View>

        {/* Week / Month pill switcher */}
        <View className="px-5 pb-3">
          <View className="flex-row self-start bg-surface-card dark:bg-surface-dark-card rounded-full p-1 border border-border dark:border-border-dark">
            {(["week", "month"] as ViewMode[]).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  className={`px-5 py-2 rounded-full ${
                    active ? "bg-primary" : ""
                  }`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${m === "week" ? "Week" : "Month"} view`}
                >
                  <Text
                    className={`text-caption font-semibold ${
                      active
                        ? "text-primary-foreground"
                        : "text-content-secondary dark:text-content-dark-secondary"
                    }`}
                  >
                    {m === "week" ? "Week" : "Month"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {mode === "week" && (
          <View className="px-5 pb-2">
            <View className="flex-row items-center">
              <Pressable
                onPress={handlePrevDays}
                disabled={visibleStartIndex === 0}
                className="min-w-[44px] min-h-[44px] items-center justify-center"
                accessibilityLabel="Show earlier days"
                accessibilityRole="button"
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={visibleStartIndex === 0 ? "hsl(30, 8%, 70%)" : "hsl(30, 8%, 45%)"}
                />
              </Pressable>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-1"
                contentContainerStyle={{ gap: 4, justifyContent: "center", flexGrow: 1 }}
              >
                {days.map((day) => {
                  const isVisible =
                    day.index >= visibleStartIndex &&
                    day.index < visibleStartIndex + VISIBLE_DAYS;
                  return (
                    <Pressable
                      key={day.index}
                      onPress={() =>
                        setVisibleStartIndex(
                          Math.max(0, Math.min(7 - VISIBLE_DAYS, day.index))
                        )
                      }
                      className={`px-2.5 py-1.5 rounded-full min-h-[36px] items-center justify-center ${
                        isVisible
                          ? day.isToday
                            ? "bg-primary"
                            : "bg-surface-elevated dark:bg-surface-dark-elevated"
                          : ""
                      }`}
                      accessibilityRole="button"
                      accessibilityLabel={`Jump to ${day.label} ${day.dateNum}`}
                    >
                      <Text
                        className={`text-small font-medium ${
                          isVisible
                            ? day.isToday
                              ? "text-primary-foreground"
                              : "text-content dark:text-content-dark-primary"
                            : "text-content-muted dark:text-content-dark-muted"
                        }`}
                      >
                        {day.label} {day.dateNum}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                onPress={handleNextDays}
                disabled={visibleStartIndex >= 7 - VISIBLE_DAYS}
                className="min-w-[44px] min-h-[44px] items-center justify-center"
                accessibilityLabel="Show later days"
                accessibilityRole="button"
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={
                    visibleStartIndex >= 7 - VISIBLE_DAYS
                      ? "hsl(30, 8%, 70%)"
                      : "hsl(30, 8%, 45%)"
                  }
                />
              </Pressable>
            </View>
          </View>
        )}

        {mode === "week" ? (
          hasAnyEvents ? (
            <WeekView
              days={visibleDays}
              dayColumnWidth={dayColumnWidth}
              blocksByDay={blocksByDay}
              allDayByDay={allDayByDay}
              busyByDay={busyByDay}
              onBlockPress={handleBlockPress}
              onAllDayPress={(pill) => router.push(`/task/${pill.taskId}`)}
              onLongPressSlot={handleLongPressSlot}
              onTimedBlockDrop={handleTimedBlockDrop}
              onAllDayBlockDrop={handleAllDayBlockDrop}
            />
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Nothing scheduled"
              subtitle="No tasks scheduled yet — add one and we'll find the best time 🌼"
            />
          )
        ) : (
          <MonthViewSection
            markedDates={markedDates}
            isDark={isDark}
            onDayPress={() => setMode("week")}
          />
        )}
        {/* Slot action menu modal */}
        <Modal
          visible={showSlotMenu}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSlotMenu(false)}
        >
          <Pressable
            className="flex-1"
            onPress={() => setShowSlotMenu(false)}
            accessibilityLabel="Close menu"
          />
          <View className="bg-surface dark:bg-surface-dark rounded-t-3xl px-6 pt-6" style={{ paddingBottom: insets.bottom + 24 }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-heading font-bold text-content dark:text-content-dark-primary">
                {menuSlotDate
                  ? `${menuSlotDate.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })} at ${formatTime(menuSlotHour, 0)}`
                  : ""}
              </Text>
              <Pressable
                onPress={() => setShowSlotMenu(false)}
                className="min-w-[44px] min-h-[44px] items-center justify-center"
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={24} className="text-content-secondary dark:text-content-dark-secondary" />
              </Pressable>
            </View>

            {!showBusyForm ? (
              <View className="gap-3">
                <Pressable
                  onPress={handleSlotAddTask}
                  className="flex-row items-center bg-primary/10 dark:bg-primary/15 border border-primary/30 dark:border-primary/20 rounded-2xl px-4 py-4 min-h-[52px] active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel="Add a task at this time"
                >
                  <Ionicons name="add-circle-outline" size={22} className="text-primary dark:text-primary" />
                  <Text className="ml-3 text-body font-semibold text-content dark:text-content-dark-primary">
                    Add task
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowBusyForm(true)}
                  className="flex-row items-center bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-2xl px-4 py-4 min-h-[52px] active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel="Mark this time as busy"
                >
                  <Ionicons name="remove-circle-outline" size={22} className="text-content-secondary dark:text-content-dark-secondary" />
                  <Text className="ml-3 text-body font-semibold text-content dark:text-content-dark-primary">
                    Mark as busy
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-3">
                <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary">
                  Title (optional)
                </Text>
                <TextInput
                  value={busyTitle}
                  onChangeText={setBusyTitle}
                  placeholder="e.g. Soccer practice"
                  placeholderTextColor="hsl(30, 6%, 60%)"
                  className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3 text-body text-content dark:text-content-dark-primary"
                  accessibilityLabel="Busy event title"
                />

                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1">
                      Start
                    </Text>
                    <View className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3">
                      <Text className="text-body text-content dark:text-content-dark-primary">
                        {formatTime(menuSlotHour, 0)}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-1">
                    <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1">
                      End
                    </Text>
                    {Platform.OS === "web" ? (
                      <View className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3 min-h-[44px] justify-center">
                        <select
                          value={busyEndHour}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            setBusyEndHour(Number(e.target.value))
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "inherit",
                            fontSize: 16,
                            fontFamily: "inherit",
                            width: "100%",
                            outline: "none",
                          }}
                          aria-label="End hour"
                        >
                          {Array.from({ length: END_HOUR - menuSlotHour }, (_, i) => {
                            const h = menuSlotHour + 1 + i;
                            return (
                              <option key={h} value={h}>
                                {formatTime(h, 0)}
                              </option>
                            );
                          })}
                        </select>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => {
                          const next = busyEndHour + 1;
                          setBusyEndHour(next > END_HOUR ? menuSlotHour + 1 : next);
                        }}
                        className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3 min-h-[44px] justify-center"
                        accessibilityLabel={`End time: ${formatTime(busyEndHour, 0)}. Tap to cycle.`}
                        accessibilityRole="button"
                      >
                        <Text className="text-body text-content dark:text-content-dark-primary">
                          {formatTime(busyEndHour, 0)}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                <View className="flex-row gap-3 mt-2">
                  <Pressable
                    onPress={() => setShowBusyForm(false)}
                    className="flex-1 min-h-[52px] items-center justify-center rounded-lg bg-surface-elevated dark:bg-surface-dark-elevated active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                  >
                    <Text className="text-body font-semibold text-content dark:text-content-dark-primary">
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSlotMarkBusy}
                    className="flex-1 min-h-[52px] items-center justify-center rounded-lg bg-primary active:bg-primary-dark"
                    accessibilityRole="button"
                    accessibilityLabel="Save busy time"
                  >
                    <Text className="text-body font-semibold text-primary-foreground">
                      Save
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

// --- Week View ---

interface WeekViewProps {
  days: {
    index: number;
    date: Date;
    label: string;
    dateNum: number;
    isToday: boolean;
  }[];
  dayColumnWidth: number;
  blocksByDay: Record<number, TimedBlock[]>;
  allDayByDay: Record<number, AllDayBlock[]>;
  busyByDay: Record<number, BusyBlock[]>;
  onBlockPress: (b: TimedBlock) => void;
  onAllDayPress: (pill: AllDayBlock) => void;
  onLongPressSlot: (dayIndex: number, hour: number) => void;
  onTimedBlockDrop: (block: TimedBlock, newPixelY: number) => void;
  onAllDayBlockDrop: (block: AllDayBlock, newDayIndex: number) => void;
}

function WeekView({
  days,
  dayColumnWidth,
  blocksByDay,
  allDayByDay,
  busyByDay,
  onBlockPress,
  onAllDayPress,
  onLongPressSlot,
  onTimedBlockDrop,
  onAllDayBlockDrop,
}: WeekViewProps) {
  // Compute all-day row height based on max pills in any column
  const maxAllDay = Math.max(
    0,
    ...days.map((d) => allDayByDay[d.index]?.length ?? 0)
  );
  const allDayRowHeight =
    maxAllDay === 0 ? ALL_DAY_ROW_MIN_HEIGHT : maxAllDay * 32 + 8;

  return (
    <ScrollView
      className="flex-1"
      stickyHeaderIndices={[0]}
      showsVerticalScrollIndicator={false}
    >
      {/* Sticky header: day labels + all-day row */}
      <View className="bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
        {/* Day header row */}
        <View className="flex-row px-5 pt-1 pb-2">
          <View style={{ width: TIME_LABEL_WIDTH }} />
          {days.map((day) => (
            <View
              key={day.index}
              style={{ width: dayColumnWidth }}
              className="items-center"
            >
              <Text className="text-small font-medium text-content-muted dark:text-content-dark-muted">
                {day.label}
              </Text>
              <View
                className={`w-7 h-7 rounded-full items-center justify-center mt-0.5 ${
                  day.isToday ? "bg-primary" : ""
                }`}
              >
                <Text
                  className={`text-caption font-semibold ${
                    day.isToday
                      ? "text-primary-foreground"
                      : "text-content dark:text-content-dark-primary"
                  }`}
                >
                  {day.dateNum}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* All-day row */}
        <View
          className="flex-row px-5 pb-2"
          style={{ height: allDayRowHeight }}
        >
          <View
            style={{ width: TIME_LABEL_WIDTH }}
            className="justify-center"
          >
            <Text className="text-[10px] text-content-muted dark:text-content-dark-muted">
              all-day
            </Text>
          </View>
          {days.map((day) => (
            <View
              key={day.index}
              style={{ width: dayColumnWidth }}
              className="px-0.5 gap-0.5"
            >
              {(allDayByDay[day.index] ?? []).map((pill) => (
                <DraggableAllDayPill
                  key={pill.id}
                  pill={pill}
                  dayColumnWidth={dayColumnWidth}
                  totalDays={days.length}
                  onPress={() => onAllDayPress(pill)}
                  onDrop={(newDayIndex) => onAllDayBlockDrop(pill, newDayIndex)}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Time grid */}
      <View className="flex-row px-5 pt-2">
        {/* Time labels column */}
        <View style={{ width: TIME_LABEL_WIDTH, height: GRID_HEIGHT }}>
          {Array.from({ length: TOTAL_HOURS }, (_, i) => {
            const hour = START_HOUR + i;
            return (
              <View
                key={hour}
                style={{
                  position: "absolute",
                  top: i * HOUR_HEIGHT - 6,
                  right: 6,
                }}
              >
                <Text className="text-[10px] text-content-muted dark:text-content-dark-muted">
                  {formatTime(hour, 0)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Day columns */}
        {days.map((day) => (
          <DayColumn
            key={day.index}
            day={day}
            width={dayColumnWidth}
            timedBlocks={blocksByDay[day.index] ?? []}
            busyBlocks={busyByDay[day.index] ?? []}
            onBlockPress={onBlockPress}
            onLongPressSlot={onLongPressSlot}
            onTimedBlockDrop={onTimedBlockDrop}
          />
        ))}
      </View>

      {/* Bottom spacer so last hour isn't clipped */}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// --- Draggable All-Day Pill ---

interface DraggableAllDayPillProps {
  pill: AllDayBlock;
  dayColumnWidth: number;
  totalDays: number;
  onPress: () => void;
  onDrop: (newDayIndex: number) => void;
}

function DraggableAllDayPill({
  pill,
  dayColumnWidth,
  totalDays,
  onPress,
  onDrop,
}: DraggableAllDayPillProps) {
  const isDragging = useSharedValue(false);
  const translateX = useSharedValue(0);
  const offsetXAtStart = useSharedValue(0);

  const triggerHapticPickup = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const triggerHapticDrop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const commitDrop = useCallback(
    (totalX: number) => {
      const targetDayDelta = Math.floor(totalX / dayColumnWidth);
      const newDayIndex = pill.day + targetDayDelta;
      onDrop(newDayIndex);
      triggerHapticDrop();
    },
    [pill.day, dayColumnWidth, onDrop, triggerHapticDrop]
  );

  const longPress = Gesture.LongPress().minDuration(500).onStart(() => {
    "worklet";
    isDragging.value = true;
    offsetXAtStart.value = translateX.value;
    runOnJS(triggerHapticPickup)();
  });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      "worklet";
      if (!isDragging.value) return;
      translateX.value = offsetXAtStart.value + e.translationX;
    })
    .onEnd((e) => {
      "worklet";
      if (!isDragging.value) {
        // Was a tap — handled by tap gesture
        return;
      }
      isDragging.value = false;
      const totalX = offsetXAtStart.value + e.translationX;
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      runOnJS(commitDrop)(totalX);
    });

  const tap = Gesture.Tap().onEnd(() => {
    "worklet";
    if (!isDragging.value) {
      runOnJS(onPress)();
    }
  });

  // Gesture.Sequence is not available in this version of gesture-handler.
  // Use Simultaneous(longPress, pan) — the pan is gated by isDragging shared
  // value so it only moves the block after long press fires.
  const composed = Gesture.Simultaneous(longPress, pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: isDragging.value ? 0.8 : 1,
    zIndex: isDragging.value ? 100 : 1,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Reanimated.View style={animatedStyle}>
        <View
          className="bg-accent/20 dark:bg-accent/25 border border-accent/30 rounded px-1.5 py-1.5"
          accessibilityRole="button"
          accessibilityLabel={`${pill.title}, all day task. Long press to drag to a different day.`}
        >
          <Text
            numberOfLines={1}
            className="text-[12px] text-accent-dark dark:text-accent font-medium"
          >
            {pill.title}
          </Text>
        </View>
      </Reanimated.View>
    </GestureDetector>
  );
}

// --- Day Column ---

interface DayColumnProps {
  day: { index: number; isToday: boolean };
  width: number;
  timedBlocks: TimedBlock[];
  busyBlocks: BusyBlock[];
  onBlockPress: (b: TimedBlock) => void;
  onLongPressSlot: (dayIndex: number, hour: number) => void;
  onTimedBlockDrop: (block: TimedBlock, newPixelY: number) => void;
}

function DayColumn({
  day,
  width,
  timedBlocks,
  busyBlocks,
  onBlockPress,
  onLongPressSlot,
  onTimedBlockDrop,
}: DayColumnProps) {
  // Group timed blocks by parent so we can render the parent label once,
  // above the first subtask in each group.
  const groupLabelFor = (block: TimedBlock, index: number): string | null => {
    if (!block.parentId) return null;
    const prev = timedBlocks[index - 1];
    if (prev && prev.parentId === block.parentId) return null;
    return block.parentTitle ?? null;
  };

  // Compute non-overlapping column positions for side-by-side rendering.
  const columnLayout = useMemo(() => computeColumnLayout(timedBlocks), [timedBlocks]);

  return (
    <View
      style={{ width, height: GRID_HEIGHT }}
      className={`border-l border-border/60 dark:border-border-dark/60 ${
        day.isToday ? "bg-primary/[0.025] dark:bg-primary/[0.04]" : ""
      }`}
    >
      {/* Hour grid lines + long-press targets for empty slot creation */}
      {Array.from({ length: TOTAL_HOURS }, (_, i) => {
        const hour = START_HOUR + i;
        return (
          <Pressable
            key={hour}
            onLongPress={() => onLongPressSlot(day.index, hour)}
            style={{
              position: "absolute",
              top: i * HOUR_HEIGHT,
              left: 0,
              right: 0,
              height: HOUR_HEIGHT,
            }}
            className="border-t border-border/40 dark:border-border-dark/40"
            accessibilityLabel={`Add task at ${formatTime(hour, 0)}`}
            accessibilityHint="Long press to create a task at this time"
          />
        );
      })}

      {/* Busy blocks — behind task blocks */}
      {busyBlocks.map((b) => {
        const top = topForTime(b.startHour, b.startMinute);
        const height = heightForDuration(b.durationMinutes);
        return (
          <View
            key={b.id}
            style={{
              position: "absolute",
              top,
              left: 1,
              right: 1,
              height,
              zIndex: 1,
            }}
            className="bg-content-muted/15 dark:bg-content-dark-muted/20 rounded-sm border-l-2 border-content-muted/30 dark:border-content-dark-muted/40"
          >
            <Text
              numberOfLines={1}
              className="text-[9px] text-content-muted dark:text-content-dark-muted px-1 pt-0.5"
            >
              Busy
            </Text>
          </View>
        );
      })}

      {/* Timed task blocks — draggable */}
      {timedBlocks.map((b, idx) => {
        const top = topForTime(b.startHour, b.startMinute);
        const height = heightForDuration(b.durationMinutes);
        const isSubtask = !!b.parentId;
        const isTypeA = !!b.isTypeA;
        const alt = (b.subtaskIndex ?? 0) % 2 === 0;
        const label = groupLabelFor(b, idx);
        const colInfo = columnLayout.get(b.id) ?? { col: 0, totalCols: 1 };
        const colWidth = (width - 2) / colInfo.totalCols;
        const blockLeft = Math.round(1 + colInfo.col * colWidth);
        const blockRight = Math.round(width - (1 + (colInfo.col + 1) * colWidth)) + (colInfo.totalCols > 1 ? 1 : 0);
        return (
          <React.Fragment key={b.id}>
            {label && (
              <View
                style={{
                  position: "absolute",
                  top: Math.max(top - 12, 0),
                  left: blockLeft,
                  right: blockRight,
                  zIndex: 3,
                }}
              >
                <Text
                  numberOfLines={1}
                  className="text-[9px] font-semibold text-accent-dark dark:text-accent"
                >
                  {b.parentTitle}
                </Text>
              </View>
            )}
            <DraggableTimedBlock
              block={b}
              top={top}
              height={height}
              isTypeA={isTypeA}
              isSubtask={isSubtask}
              alt={alt}
              blockLeft={blockLeft}
              blockRight={blockRight}
              onPress={() => onBlockPress(b)}
              onDrop={(newPixelY) => onTimedBlockDrop(b, newPixelY)}
            />
          </React.Fragment>
        );
      })}
    </View>
  );
}

// --- Draggable Timed Block ---

interface DraggableTimedBlockProps {
  block: TimedBlock;
  top: number;
  height: number;
  isTypeA: boolean;
  isSubtask: boolean;
  alt: boolean;
  blockLeft: number;
  blockRight: number;
  onPress: () => void;
  onDrop: (newPixelY: number) => void;
}

function DraggableTimedBlock({
  block,
  top,
  height,
  isTypeA,
  isSubtask,
  alt,
  blockLeft,
  blockRight,
  onPress,
  onDrop,
}: DraggableTimedBlockProps) {
  const isDragging = useSharedValue(false);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const offsetYAtStart = useSharedValue(0);

  const triggerHapticPickup = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const triggerHapticDrop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const commitDrop = useCallback(
    (rawTranslateY: number) => {
      const snappedOffset = snapToGrid(rawTranslateY);
      const newPixelY = clampTop(top + snappedOffset, height);
      onDrop(newPixelY);
      triggerHapticDrop();
    },
    [top, height, onDrop, triggerHapticDrop]
  );

  const longPress = Gesture.LongPress().minDuration(500).onStart(() => {
    "worklet";
    isDragging.value = true;
    offsetYAtStart.value = translateY.value;
    scale.value = withSpring(1.04, { damping: 15, stiffness: 300 });
    runOnJS(triggerHapticPickup)();
  });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      "worklet";
      if (!isDragging.value) return;
      const raw = offsetYAtStart.value + e.translationY;
      const snapped = snapToGrid(raw);
      const clamped = clampTop(top + snapped, height) - top;
      translateY.value = clamped;
    })
    .onEnd((e) => {
      "worklet";
      if (!isDragging.value) return;
      isDragging.value = false;
      const finalTranslate = translateY.value;
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      translateY.value = withTiming(0, { duration: 200 });
      runOnJS(commitDrop)(finalTranslate);
    });

  const tap = Gesture.Tap().onEnd(() => {
    "worklet";
    if (!isDragging.value) {
      runOnJS(onPress)();
    }
  });

  // Gesture.Sequence is not available in this version of gesture-handler.
  // Use Simultaneous(longPress, pan) — the pan is gated by isDragging shared
  // value so it only moves the block after long press fires.
  const composed = Gesture.Simultaneous(longPress, pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: isDragging.value ? 0.8 : block.isComplete ? 0.5 : 1,
    zIndex: isDragging.value ? 50 : 2,
    shadowOpacity: isDragging.value ? 0.25 : 0,
    shadowRadius: isDragging.value ? 8 : 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: isDragging.value ? 8 : 0,
  }));

  const isProposed = !!block.isProposed;
  const isCalendarEvent = !!block.isCalendarEvent;

  const blockColorClass = isCalendarEvent
    ? "bg-content-muted/15 dark:bg-content-dark-muted/20 border-l-2 border-content-muted/30 dark:border-content-dark-muted/40"
    : isProposed
    ? "bg-primary/10 dark:bg-primary/15 border border-dashed border-primary/50 dark:border-primary/40"
    : isTypeA
    ? "bg-warning/30 dark:bg-warning/35 border-l-[3px] border-warning"
    : isSubtask
    ? alt
      ? "bg-primary/25 dark:bg-primary/30 border-l-[3px] border-accent"
      : "bg-primary/40 dark:bg-primary/45 border-l-[3px] border-accent"
    : "bg-primary/35 dark:bg-primary/40 border-l-[3px] border-accent";

  const textColorClass = isCalendarEvent
    ? "text-content-muted dark:text-content-dark-muted"
    : isProposed
    ? "text-primary dark:text-primary"
    : isTypeA
    ? "text-warning-dark dark:text-warning"
    : "text-content dark:text-content-dark-primary";

  return (
    <GestureDetector gesture={composed}>
      <Reanimated.View
        style={[
          styles.timedBlockBase,
          { top, height, left: blockLeft, right: blockRight },
          animatedStyle,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${block.title}, ${formatTime(
          block.startHour,
          block.startMinute
        )}, ${block.durationMinutes} minutes${
          block.isComplete ? ", completed" : ""
        }. Long press to drag and reschedule.`}
      >
        <View
          className={`flex-1 rounded-md px-1 py-0.5 ${blockColorClass}`}
        >
          {isProposed && (
            <Text
              numberOfLines={1}
              className="text-[8px] font-semibold text-primary/70 dark:text-primary/60 uppercase"
            >
              Suggested
            </Text>
          )}
          <Text
            numberOfLines={isProposed ? 1 : 2}
            className={`text-[10px] font-medium ${textColorClass}`}
            style={
              block.isComplete ? { textDecorationLine: "line-through" } : undefined
            }
          >
            {block.title}
          </Text>
          {block.subtaskCount && block.subtaskCount > 0 && (
            <Text
              numberOfLines={1}
              className={`text-[8px] ${textColorClass} opacity-70`}
            >
              {block.subtaskCount} steps
            </Text>
          )}
        </View>
      </Reanimated.View>
    </GestureDetector>
  );
}

// --- Month View ---

interface MonthViewSectionProps {
  markedDates: Record<string, { marked: boolean; dotColor: string }>;
  isDark: boolean;
  onDayPress: (dateString: string) => void;
}

function MonthViewSection({
  markedDates,
  isDark,
  onDayPress,
}: MonthViewSectionProps) {
  // Theme react-native-calendars with our warm palette.
  const theme = useMemo(
    () => ({
      backgroundColor: "transparent",
      calendarBackground: "transparent",
      textSectionTitleColor: isDark ? "hsl(30, 10%, 65%)" : "hsl(30, 8%, 45%)",
      dayTextColor: isDark ? "hsl(35, 20%, 95%)" : "hsl(30, 10%, 15%)",
      todayTextColor: isDark ? "hsl(35, 85%, 60%)" : "hsl(35, 85%, 45%)",
      monthTextColor: isDark ? "hsl(35, 20%, 95%)" : "hsl(30, 10%, 15%)",
      selectedDayBackgroundColor: isDark
        ? "hsl(35, 85%, 60%)"
        : "hsl(35, 85%, 55%)",
      selectedDayTextColor: "hsl(30, 10%, 10%)",
      arrowColor: isDark ? "hsl(35, 85%, 60%)" : "hsl(35, 85%, 45%)",
      textDisabledColor: isDark ? "hsl(30, 8%, 30%)" : "hsl(30, 6%, 80%)",
      dotColor: isDark ? "hsl(35, 85%, 60%)" : "hsl(35, 85%, 45%)",
      textDayFontWeight: "500" as const,
      textMonthFontWeight: "600" as const,
      textDayFontSize: 14,
      textMonthFontSize: 16,
    }),
    [isDark]
  );

  return (
    <View className="flex-1 px-3">
      <RNCalendar
        theme={theme}
        markedDates={markedDates}
        onDayPress={(day) => onDayPress(day.dateString)}
        enableSwipeMonths
      />
    </View>
  );
}

// --- StyleSheet (for things that can't be expressed in NativeWind) ---
const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  timedBlockBase: {
    position: "absolute",
    shadowColor: "#000",
  },
});
