import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
  PanResponder,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTaskStore } from "@/store/taskStore";
import { Button } from "@/components/ui/Button";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { DateTimePickerCrossPlatform } from "@/components/ui/DateTimePickerCrossPlatform";
import { breakdownTask, extractDates } from "@/services/ai";
import type { Difficulty } from "@/types";

const ABSTRACT_KEYWORDS = ["essay", "research", "analyze", "write", "project", "presentation", "report"];

function detectAbstract(title: string): boolean {
  const lower = title.toLowerCase();
  return ABSTRACT_KEYWORDS.some((kw) => lower.includes(kw));
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDueDate(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (sameDay(date, now)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatExtractedDate(isoDate: string | null): string {
  if (!isoDate) return "No date found";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "No date found";
  return formatDueDate(d);
}

interface ExtractedTask {
  title: string;
  dueDate: string | null;
  subject: string | null;
}

export default function NewTaskScreen() {
  const insets = useSafeAreaInsets();
  const addTask = useTaskStore((s) => s.addTask);
  const addSubtasks = useTaskStore((s) => s.addSubtasks);
  const params = useLocalSearchParams<{ prefillStart?: string }>();

  // ── Core task fields ──────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [dueDate, setDueDate] = useState(() => {
    if (params.prefillStart) {
      const parsed = new Date(params.prefillStart);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0);
    return tomorrow;
  });

  // ── Date picker state ─────────────────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  // Android opens a dialog imperatively — we track which picker mode was requested
  const [androidPickerMode, setAndroidPickerMode] = useState<"date" | "time" | null>(null);

  // ── Start time (Type A calendar block) ───────────────────────────────
  const [hasStartTime, setHasStartTime] = useState(false);
  const [startTimeDate, setStartTimeDate] = useState<Date>(() => {
    // Default to 9am on the selected due date
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [androidStartTimePicker, setAndroidStartTimePicker] = useState(false);

  // ── Duration ─────────────────────────────────────────────────────────
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [durationOverridden, setDurationOverridden] = useState(false);

  // ── AI breakdown state ────────────────────────────────────────────────
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    starterAction: string;
    subtasks: { title: string; estimatedMinutes: number }[];
    fromFallback?: boolean;
    isFallback?: boolean;
  } | null>(null);

  // ── Extract modal state ───────────────────────────────────────────────
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractInput, setExtractInput] = useState("");
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractResults, setExtractResults] = useState<ExtractedTask[] | null>(null);
  const [extractFallback, setExtractFallback] = useState(false);
  const [extractError, setExtractError] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  // ── Extract modal swipe-to-dismiss ────────────────────────────────────
  const extractPan = useRef(new Animated.Value(0)).current;
  const extractPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) extractPan.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100) {
          Animated.timing(extractPan, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
            closeExtractModal();
            extractPan.setValue(0);
          });
        } else {
          Animated.spring(extractPan, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const isAbstract = detectAbstract(title);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleBreakdown = useCallback(async () => {
    setBreakdownLoading(true);
    setShowBreakdown(true);
    const result = await breakdownTask({
      title: title.trim(),
      subject: subject.trim() || null,
      dueDate: dueDate.toISOString(),
      difficulty,
    });
    setAiResult(result);
    // Auto-calculate duration from AI subtasks (unless user already overrode)
    if (!durationOverridden && result.subtasks.length > 0) {
      const totalMins = result.subtasks.reduce((sum, s) => sum + s.estimatedMinutes, 0);
      setDurationMinutes(totalMins);
    }
    setBreakdownLoading(false);
  }, [title, subject, dueDate, difficulty, durationOverridden]);

  const handleSave = useCallback(() => {
    if (!title.trim()) return;

    const starterAction =
      aiResult?.starterAction ||
      (isAbstract
        ? `Open a new doc and write the title: "${title.trim()}"`
        : `Look at what "${title.trim()}" needs and gather materials`);

    // Build startTime ISO string: combine due date's calendar date with the
    // chosen start hour/minute so the block lands on the correct day.
    let startTimeISO: string | undefined;
    if (hasStartTime) {
      const st = new Date(dueDate);
      st.setHours(startTimeDate.getHours(), startTimeDate.getMinutes(), 0, 0);
      startTimeISO = st.toISOString();
    }

    const taskId = addTask({
      title: title.trim(),
      subject: subject.trim() || null,
      description: description.trim() || null,
      dueDate: dueDate.toISOString(),
      startTime: startTimeISO,
      durationMinutes,
      isAbstract,
      difficulty,
      source: "manual",
      externalId: null,
      starterAction,
    });

    if (showBreakdown && !breakdownLoading && aiResult) {
      addSubtasks(
        taskId,
        aiResult.subtasks.map((s, i) => ({
          title: s.title,
          estimatedMinutes: s.estimatedMinutes,
          isComplete: false,
          order: i,
        }))
      );
    }

    router.back();
  }, [title, subject, description, dueDate, hasStartTime, startTimeDate, difficulty, isAbstract, durationMinutes, showBreakdown, breakdownLoading, aiResult, addTask, addSubtasks]);

  const openAndroidDate = () => {
    setAndroidPickerMode("date");
  };

  const openAndroidTime = () => {
    setAndroidPickerMode("time");
  };

  // Extract modal handlers
  const handleExtract = useCallback(async () => {
    if (!extractInput.trim()) return;
    setExtractLoading(true);
    setExtractResults(null);
    setExtractError(false);
    setExtractFallback(false);

    const result = await extractDates(extractInput.trim());
    setExtractLoading(false);

    if (!result.items || result.items.length === 0) {
      setExtractError(true);
      return;
    }

    setExtractResults(result.items);
    setExtractFallback(result.isFallback);
    // Check all items by default
    setCheckedItems(new Set(result.items.map((_, i) => i)));
  }, [extractInput]);

  const toggleChecked = (index: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddExtracted = useCallback(() => {
    if (!extractResults) return;
    const defaultStarterAction = (taskTitle: string) =>
      `Look at what "${taskTitle}" needs and gather materials`;

    for (const [i, item] of extractResults.entries()) {
      if (!checkedItems.has(i)) continue;
      const taskDue = item.dueDate
        ? new Date(item.dueDate)
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            d.setHours(23, 59, 0, 0);
            return d;
          })();
      addTask({
        title: item.title,
        subject: item.subject || null,
        description: null,
        dueDate: taskDue.toISOString(),
        startTime: undefined,
        durationMinutes: null,
        isAbstract: detectAbstract(item.title),
        difficulty: "medium",
        source: "ai_extracted",
        externalId: null,
        starterAction: defaultStarterAction(item.title),
      });
    }

    setShowExtractModal(false);
    router.push("/(tabs)/tasks");
  }, [extractResults, checkedItems, addTask]);

  const closeExtractModal = () => {
    setShowExtractModal(false);
    setExtractInput("");
    setExtractResults(null);
    setExtractLoading(false);
    setExtractError(false);
    setExtractFallback(false);
    setCheckedItems(new Set());
  };

  const checkedCount = checkedItems.size;

  const difficulties: { key: Difficulty; label: string; icon: string }[] = [
    { key: "low", label: "Easy", icon: "leaf-outline" },
    { key: "medium", label: "Medium", icon: "flame-outline" },
    { key: "high", label: "Hard", icon: "flash-outline" },
  ];

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface dark:bg-surface-dark"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3">
          <Pressable
            onPress={() => router.back()}
            className="min-w-[44px] min-h-[44px] items-center justify-center"
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} className="text-content dark:text-content-dark-primary" />
          </Pressable>
          <Text className="text-heading font-semibold text-content dark:text-content-dark-primary">
            New Task
          </Text>
          <View className="w-[44px]" />
        </View>

        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-8"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title input */}
          <View className="mb-4">
            <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1.5">
              What do you need to do?
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Write English essay on The Great Gatsby"
              placeholderTextColor="hsl(30, 6%, 60%)"
              className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3.5 text-body text-content dark:text-content-dark-primary"
              accessibilityLabel="Task title"
              autoFocus
            />
            {isAbstract && (
              <View className="flex-row items-center mt-2 bg-accent-light dark:bg-accent/10 rounded-lg px-3 py-2">
                <Ionicons name="sparkles-outline" size={16} className="text-accent dark:text-accent" />
                <Text className="text-small text-accent-dark dark:text-accent ml-1.5">
                  This one's big — let's break it down together
                </Text>
              </View>
            )}
          </View>

          {/* Subject */}
          <View className="mb-4">
            <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1.5">
              Subject (optional)
            </Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g., English 2H"
              placeholderTextColor="hsl(30, 6%, 60%)"
              className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3.5 text-body text-content dark:text-content-dark-primary"
              accessibilityLabel="Subject"
            />
          </View>

          {/* Describe your tasks — AI parser button */}
          <Pressable
            onPress={() => { extractPan.setValue(0); setShowExtractModal(true); }}
            className="flex-row items-center mb-4 bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-xl px-4 py-3 min-h-[44px]"
            accessibilityRole="button"
            accessibilityLabel="Describe your tasks — AI will find tasks and dates from your text"
          >
            <Ionicons
              name="document-text-outline"
              size={18}
              className="text-content-secondary dark:text-content-dark-secondary"
            />
            <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary ml-2">
              Describe your tasks
            </Text>
            <View className="flex-1" />
            <Ionicons
              name="sparkles-outline"
              size={14}
              className="text-accent dark:text-accent"
            />
          </Pressable>

          {/* Due date — real date picker */}
          <View className="mb-4">
            <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1.5">
              Due
            </Text>

            <View className="gap-2">
              {/* Date + time trigger row — wrapped in surface card on Android for dark-theme consistency */}
              <View
                className={
                  Platform.OS === "android"
                    ? "bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-2xl px-4 py-3 gap-2"
                    : "gap-2"
                }
              >
                {/* Date label button */}
                <Pressable
                  onPress={() => {
                    if (Platform.OS === "android") {
                      openAndroidDate();
                    } else {
                      setShowTimePicker(false);
                      setShowDatePicker((prev) => !prev);
                    }
                  }}
                  className="flex-row items-center bg-surface-card dark:bg-surface-dark-card border border-primary/40 dark:border-primary/30 rounded-xl px-4 py-3 min-h-[44px]"
                  accessibilityRole="button"
                  accessibilityLabel={`Due date: ${formatDueDate(dueDate)}. Tap to change.`}
                >
                  <Ionicons name="calendar-outline" size={18} className="text-primary dark:text-primary" />
                  <Text className="ml-2 text-body font-semibold text-primary dark:text-primary">
                    {formatDueDate(dueDate)}
                  </Text>
                  <View className="flex-1" />
                  <Ionicons
                    name={showDatePicker && Platform.OS !== "android" ? "chevron-up" : "chevron-down"}
                    size={16}
                    className="text-content-muted dark:text-content-dark-muted"
                  />
                </Pressable>

                {/* Set time link */}
                <Pressable
                  onPress={() => {
                    if (Platform.OS === "android") {
                      openAndroidTime();
                    } else {
                      setShowDatePicker(false);
                      setShowTimePicker((prev) => !prev);
                    }
                  }}
                  className="flex-row items-center px-1 min-h-[44px] self-start"
                  accessibilityRole="button"
                  accessibilityLabel={`Set time, currently ${formatTime(dueDate)}`}
                >
                  <Ionicons name="time-outline" size={14} className="text-content-secondary dark:text-content-dark-secondary" />
                  <Text className="text-small text-content-secondary dark:text-content-dark-secondary ml-1">
                    {formatTime(dueDate)}
                  </Text>
                  <Ionicons
                    name={showTimePicker && Platform.OS !== "android" ? "chevron-up" : "chevron-down"}
                    size={12}
                    className="text-content-muted dark:text-content-dark-muted ml-0.5"
                  />
                </Pressable>
              </View>

              {/* Inline date picker — cross-platform */}
              {showDatePicker && Platform.OS !== "android" && (
                <View className="rounded-2xl overflow-hidden bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark p-1">
                  <DateTimePickerCrossPlatform
                    value={dueDate}
                    mode="date"
                    display="inline"
                    onChange={(selected) => {
                      setDueDate((prev) => {
                        const next = new Date(selected);
                        next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                        return next;
                      });
                    }}
                    minimumDate={new Date()}
                    accessibilityLabel="Select due date"
                  />
                </View>
              )}

              {/* Inline time picker — cross-platform */}
              {showTimePicker && Platform.OS !== "android" && (
                <View className="rounded-2xl overflow-hidden bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark p-4">
                  <DateTimePickerCrossPlatform
                    value={dueDate}
                    mode="time"
                    display="spinner"
                    onChange={(selected) => {
                      setDueDate((prev) => {
                        const next = new Date(prev);
                        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                        return next;
                      });
                    }}
                    accessibilityLabel="Select due time"
                  />
                </View>
              )}

              {/* Android dialog pickers */}
              {Platform.OS === "android" && androidPickerMode === "date" && (
                <DateTimePickerCrossPlatform
                  value={dueDate}
                  mode="date"
                  display="default"
                  onChange={(selected) => {
                    setAndroidPickerMode(null);
                    setDueDate((prev) => {
                      const next = new Date(selected);
                      next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                      return next;
                    });
                  }}
                  minimumDate={new Date()}
                  accessibilityLabel="Select due date"
                />
              )}
              {Platform.OS === "android" && androidPickerMode === "time" && (
                <DateTimePickerCrossPlatform
                  value={dueDate}
                  mode="time"
                  display="default"
                  onChange={(selected) => {
                    setAndroidPickerMode(null);
                    setDueDate((prev) => {
                      const next = new Date(prev);
                      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                      return next;
                    });
                  }}
                  accessibilityLabel="Select due time"
                />
              )}
            </View>
          </View>

          {/* Start time — optional Type A calendar block */}
          <View className="mb-4">
            <View
              className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-2xl px-4 py-3 gap-2"
            >
              {/* Toggle row */}
              <Pressable
                onPress={() => {
                  const next = !hasStartTime;
                  setHasStartTime(next);
                  if (!next) setShowStartTimePicker(false);
                }}
                className="flex-row items-center min-h-[44px]"
                accessibilityRole="switch"
                accessibilityState={{ checked: hasStartTime }}
                accessibilityLabel="Add start time"
                accessibilityHint="Adds a specific start time, placing this task as a block on the calendar"
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  className="text-content-secondary dark:text-content-dark-secondary"
                />
                <Text className="flex-1 ml-2 text-caption font-medium text-content-secondary dark:text-content-dark-secondary">
                  Add start time
                  <Text className="text-content-muted dark:text-content-dark-muted font-normal"> (optional)</Text>
                </Text>
                <Switch
                  value={hasStartTime}
                  onValueChange={(val) => {
                    setHasStartTime(val);
                    if (!val) setShowStartTimePicker(false);
                  }}
                  accessibilityLabel="Add start time"
                />
              </Pressable>

              {/* Time picker — shown when toggled on */}
              {hasStartTime && (
                <>
                  {Platform.OS === "android" ? (
                    <Pressable
                      onPress={() => setAndroidStartTimePicker(true)}
                      className="flex-row items-center bg-surface dark:bg-surface-dark border border-primary/40 dark:border-primary/30 rounded-xl px-4 py-3 min-h-[44px]"
                      accessibilityRole="button"
                      accessibilityLabel={`Start time: ${formatTime(startTimeDate)}. Tap to change.`}
                    >
                      <Ionicons name="time-outline" size={18} className="text-primary dark:text-primary" />
                      <Text className="ml-2 text-body font-semibold text-primary dark:text-primary">
                        {formatTime(startTimeDate)}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => setShowStartTimePicker((p) => !p)}
                      className="flex-row items-center bg-surface dark:bg-surface-dark border border-primary/40 dark:border-primary/30 rounded-xl px-4 py-3 min-h-[44px]"
                      accessibilityRole="button"
                      accessibilityLabel={`Start time: ${formatTime(startTimeDate)}. Tap to change.`}
                    >
                      <Ionicons name="time-outline" size={18} className="text-primary dark:text-primary" />
                      <Text className="ml-2 text-body font-semibold text-primary dark:text-primary">
                        {formatTime(startTimeDate)}
                      </Text>
                      <View className="flex-1" />
                      <Ionicons
                        name={showStartTimePicker ? "chevron-up" : "chevron-down"}
                        size={16}
                        className="text-content-muted dark:text-content-dark-muted"
                      />
                    </Pressable>
                  )}

                  {/* Inline start time picker — cross-platform (iOS + web) */}
                  {showStartTimePicker && Platform.OS !== "android" && (
                    <View className="rounded-2xl overflow-hidden bg-surface dark:bg-surface-dark border border-border dark:border-border-dark p-4">
                      <DateTimePickerCrossPlatform
                        value={startTimeDate}
                        mode="time"
                        display="spinner"
                        onChange={(selected) => setStartTimeDate(selected)}
                        accessibilityLabel="Select start time"
                      />
                    </View>
                  )}

                  {/* Android dialog start time picker */}
                  {Platform.OS === "android" && androidStartTimePicker && (
                    <DateTimePickerCrossPlatform
                      value={startTimeDate}
                      mode="time"
                      display="default"
                      onChange={(selected) => {
                        setAndroidStartTimePicker(false);
                        setStartTimeDate(selected);
                      }}
                      accessibilityLabel="Select start time"
                    />
                  )}
                </>
              )}
            </View>
          </View>

          {/* Duration — How long? */}
          <View className="mb-4">
            <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1.5">
              How long?
            </Text>

            {/* AI-estimated duration banner */}
            {aiResult && !durationOverridden && durationMinutes !== null && (
              <View className="flex-row items-center bg-accent-light dark:bg-accent/10 rounded-lg px-3 py-2 mb-2">
                <Ionicons name="sparkles-outline" size={14} className="text-accent dark:text-accent" />
                <Text className="text-small text-accent-dark dark:text-accent ml-1.5 flex-1">
                  Estimated from steps: {durationMinutes}m
                </Text>
                <Pressable
                  onPress={() => {
                    setDurationOverridden(true);
                    setDurationMinutes(null);
                  }}
                  className="min-w-[44px] min-h-[36px] items-center justify-center"
                  accessibilityLabel="Override estimated duration"
                  accessibilityRole="button"
                >
                  <Text className="text-small font-semibold text-accent-dark dark:text-accent">Override</Text>
                </Pressable>
              </View>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
            >
              {([
                { value: 15, label: "15m" },
                { value: 30, label: "30m" },
                { value: 45, label: "45m" },
                { value: 60, label: "1h" },
                { value: 90, label: "1.5h" },
                { value: 120, label: "2h" },
                { value: 180, label: "3h" },
              ] as const).map((preset) => {
                const isSelected = durationMinutes === preset.value;
                return (
                  <Pressable
                    key={preset.value}
                    onPress={() => {
                      setDurationOverridden(true);
                      setDurationMinutes(isSelected ? null : preset.value);
                    }}
                    className={`rounded-full px-3 py-1.5 min-h-[36px] items-center justify-center ${
                      isSelected
                        ? "bg-primary dark:bg-primary"
                        : "bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark"
                    }`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Duration: ${preset.label}${isSelected ? ", selected" : ""}`}
                  >
                    <Text
                      className={`text-caption font-medium ${
                        isSelected
                          ? "text-white font-semibold"
                          : "text-content-secondary dark:text-content-dark-secondary"
                      }`}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text className="text-small text-content-muted dark:text-content-dark-muted mt-1.5">
              Optional — helps with scheduling
            </Text>
          </View>

          {/* Difficulty */}
          <View className="mb-4">
            <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1.5">
              How hard is this?
            </Text>
            <View className="flex-row gap-2">
              {difficulties.map((d) => {
                const isSelected = difficulty === d.key;
                return (
                  <Pressable
                    key={d.key}
                    onPress={() => setDifficulty(d.key)}
                    className={`flex-1 flex-row items-center justify-center px-3 py-2.5 rounded-lg border ${
                      isSelected
                        ? "border-primary bg-primary/10 dark:bg-primary/20"
                        : "border-border dark:border-border-dark bg-surface-card dark:bg-surface-dark-card"
                    }`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Difficulty: ${d.label}`}
                  >
                    <Ionicons
                      name={d.icon as never}
                      size={16}
                      className={isSelected ? "text-primary dark:text-primary" : "text-content-muted dark:text-content-dark-muted"}
                    />
                    <Text
                      className={`ml-1.5 text-caption font-medium ${
                        isSelected
                          ? "text-primary-dark dark:text-primary"
                          : "text-content-secondary dark:text-content-dark-secondary"
                      }`}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* AI Break it down */}
          {!showBreakdown && title.trim().length > 0 && (
            <Pressable
              onPress={handleBreakdown}
              className="flex-row items-center justify-center bg-accent-light dark:bg-accent/10 border border-accent/30 dark:border-accent/20 rounded-xl p-4 mb-4"
              accessibilityRole="button"
              accessibilityLabel="Break this task down with AI"
              accessibilityHint="AI will generate subtasks for this task"
            >
              <Ionicons name="sparkles" size={20} className="text-accent dark:text-accent" />
              <Text className="text-body font-semibold text-accent-dark dark:text-accent ml-2">
                Break it down
              </Text>
            </Pressable>
          )}

          {/* AI Breakdown result */}
          {showBreakdown && (
            <View className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-xl p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <Ionicons name="sparkles" size={16} className="text-accent dark:text-accent" />
                <Text className="text-caption font-semibold text-content dark:text-content-dark-primary ml-1.5">
                  Suggested steps
                </Text>
              </View>
              {breakdownLoading ? (
                <View className="gap-3">
                  <LoadingSkeleton width="100%" height={20} />
                  <LoadingSkeleton width="90%" height={20} />
                  <LoadingSkeleton width="95%" height={20} />
                  <LoadingSkeleton width="80%" height={20} />
                </View>
              ) : aiResult ? (
                <View className="gap-2">
                  {(aiResult.isFallback || aiResult.fromFallback) && (
                    <View className="flex-row items-center bg-warning-light dark:bg-warning/10 rounded-md px-2.5 py-1.5 mb-1">
                      <Ionicons name="flower-outline" size={14} className="text-warning-dark dark:text-warning" />
                      <Text className="text-small text-warning-dark dark:text-warning ml-1.5">
                        Showing general steps — AI is resting 🌱
                      </Text>
                    </View>
                  )}
                  {aiResult.subtasks.map((step, i) => (
                    <View key={i} className="flex-row items-center">
                      <Text className="text-caption text-primary dark:text-primary mr-2">{i + 1}.</Text>
                      <Text className="text-caption text-content dark:text-content-dark-primary flex-1">
                        {step.title} ({step.estimatedMinutes} min)
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}

          {/* Notes */}
          <View className="mb-6">
            <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1.5">
              Notes (optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Any details that might help..."
              placeholderTextColor="hsl(30, 6%, 60%)"
              multiline
              numberOfLines={3}
              className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3.5 text-body text-content dark:text-content-dark-primary min-h-[80px]"
              accessibilityLabel="Task notes"
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        {/* Save button */}
        <View className="px-5 pb-2" style={{ paddingBottom: insets.bottom + 8 }}>
          <Button
            title="Save task"
            variant="primary"
            onPress={handleSave}
            disabled={!title.trim()}
            accessibilityLabel="Save task"
          />
        </View>
      </View>

      {/* ── Extract tasks modal ──────────────────────────────────────────── */}
      <Modal
        visible={showExtractModal}
        animationType="slide"
        transparent
        onRequestClose={closeExtractModal}
        statusBarTranslucent
      >
        <View
          className="flex-1 justify-end bg-black/50"
          accessibilityViewIsModal
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <Animated.View
              style={{ transform: [{ translateY: extractPan }] }}
              {...extractPanResponder.panHandlers}
            >
            <View
              className="bg-surface dark:bg-surface-dark rounded-t-2xl px-5 pt-2"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              {/* Drag handle */}
              <View className="items-center pt-1 pb-2">
                <View className="w-10 h-1.5 rounded-full bg-content-muted/30 dark:bg-content-dark-muted/30" />
              </View>
              {/* Modal header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-heading font-semibold text-content dark:text-content-dark-primary">
                  Describe your tasks
                </Text>
                <Pressable
                  onPress={closeExtractModal}
                  className="min-w-[44px] min-h-[44px] items-center justify-center"
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={22} className="text-content dark:text-content-dark-primary" />
                </Pressable>
              </View>

              {/* Text input area */}
              {!extractResults && !extractLoading && !extractError && (
                <>
                  <TextInput
                    value={extractInput}
                    onChangeText={setExtractInput}
                    placeholder="Paste any text — assignments, notes, reminders — and AI will find the tasks and dates"
                    placeholderTextColor="hsl(30, 6%, 60%)"
                    multiline
                    numberOfLines={6}
                    className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-xl px-4 py-3.5 text-body text-content dark:text-content-dark-primary min-h-[120px] mb-4"
                    accessibilityLabel="Paste text to extract tasks from"
                    textAlignVertical="top"
                  />
                  <Button
                    title="Extract tasks"
                    variant="primary"
                    onPress={handleExtract}
                    disabled={!extractInput.trim()}
                    accessibilityLabel="Extract tasks from text"
                  />
                </>
              )}

              {/* Loading state */}
              {extractLoading && (
                <View className="gap-3 py-2 mb-4">
                  <LoadingSkeleton width="100%" height={48} borderRadius={12} />
                  <LoadingSkeleton width="85%" height={48} borderRadius={12} />
                  <LoadingSkeleton width="92%" height={48} borderRadius={12} />
                </View>
              )}

              {/* Error / empty state */}
              {extractError && !extractLoading && (
                <>
                  <View className="flex-row items-center bg-surface-card dark:bg-surface-dark-card rounded-xl px-4 py-3.5 mb-4">
                    <Ionicons name="leaf-outline" size={18} className="text-content-secondary dark:text-content-dark-secondary" />
                    <Text className="text-body text-content-secondary dark:text-content-dark-secondary ml-2 flex-1">
                      Couldn't find any tasks — you can add them one at a time 🌱
                    </Text>
                  </View>
                  <Button
                    title="Try again"
                    variant="secondary"
                    onPress={() => {
                      setExtractError(false);
                      setExtractResults(null);
                    }}
                    accessibilityLabel="Try again"
                  />
                </>
              )}

              {/* Results list */}
              {extractResults && !extractLoading && (
                <>
                  {extractFallback && (
                    <View className="flex-row items-center bg-warning-light dark:bg-warning/10 rounded-lg px-3 py-2.5 mb-3">
                      <Ionicons name="leaf-outline" size={16} className="text-warning-dark dark:text-warning" />
                      <Text className="text-small text-warning-dark dark:text-warning ml-2 flex-1">
                        These are rough guesses — double-check the dates 🌱
                      </Text>
                    </View>
                  )}

                  <ScrollView
                    style={{ maxHeight: 280 }}
                    showsVerticalScrollIndicator={false}
                    className="mb-4"
                  >
                    <View className="gap-2">
                      {extractResults.map((item, i) => {
                        const checked = checkedItems.has(i);
                        return (
                          <Pressable
                            key={i}
                            onPress={() => toggleChecked(i)}
                            className={`flex-row items-start px-3 py-3 rounded-xl border min-h-[52px] ${
                              checked
                                ? "border-primary bg-primary/5 dark:bg-primary/10"
                                : "border-border dark:border-border-dark bg-surface-card dark:bg-surface-dark-card"
                            }`}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked }}
                            accessibilityLabel={`${item.title}, due ${formatExtractedDate(item.dueDate)}${item.subject ? `, ${item.subject}` : ""}`}
                          >
                            {/* Checkbox */}
                            <View
                              className={`w-5 h-5 rounded border-2 items-center justify-center mr-3 mt-0.5 flex-shrink-0 ${
                                checked
                                  ? "border-primary bg-primary"
                                  : "border-border dark:border-border-dark"
                              }`}
                            >
                              {checked && (
                                <Ionicons name="checkmark" size={12} color="white" />
                              )}
                            </View>

                            {/* Content */}
                            <View className="flex-1">
                              <Text className="text-caption font-medium text-content dark:text-content-dark-primary">
                                {item.title}
                              </Text>
                              <View className="flex-row items-center mt-0.5 gap-3">
                                <View className="flex-row items-center">
                                  <Ionicons
                                    name="calendar-outline"
                                    size={12}
                                    className="text-content-secondary dark:text-content-dark-secondary"
                                  />
                                  <Text className="text-small text-content-secondary dark:text-content-dark-secondary ml-1">
                                    {formatExtractedDate(item.dueDate)}
                                  </Text>
                                </View>
                                {item.subject && (
                                  <Text className="text-small text-content-secondary dark:text-content-dark-secondary">
                                    {item.subject}
                                  </Text>
                                )}
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>

                  <Button
                    title={checkedCount === 0 ? "No tasks selected" : `Add ${checkedCount} task${checkedCount === 1 ? "" : "s"}`}
                    variant="primary"
                    onPress={handleAddExtracted}
                    disabled={checkedCount === 0}
                    accessibilityLabel={`Add ${checkedCount} selected task${checkedCount === 1 ? "" : "s"}`}
                  />
                </>
              )}
            </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
