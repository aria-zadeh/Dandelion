import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTaskStore } from "@/store/taskStore";
import { useSchedulingStore } from "@/store/schedulingStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useInsightsStore } from "@/store/insightsStore";
import { findBestSlot } from "@/services/scheduler";
import { StarterActionCard } from "@/components/ui/StarterActionCard";
import { TaskCard } from "@/components/ui/TaskCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FAB } from "@/components/ui/FAB";
import { AddEventModal } from "@/components/ui/AddEventModal";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatScheduledTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function BestTimeChip({ bestTime }: { bestTime: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="flex-row items-center bg-primary/8 dark:bg-primary/15 rounded-full px-3 py-1.5 self-start mt-2 mb-4"
      style={animatedStyle}
    >
      <Ionicons name="flash-outline" size={14} className="text-primary dark:text-primary" />
      <Text className="text-small font-medium text-primary-dark dark:text-primary ml-1">
        Your best time: {bestTime}
      </Text>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tasks = useTaskStore((s) => s.tasks);
  const getUrgentTasks = useTaskStore((s) => s.getUrgentTasks);
  const setTaskStatus = useTaskStore((s) => s.setTaskStatus);
  const updateTask = useTaskStore((s) => s.updateTask);
  const proposeSchedule = useTaskStore((s) => s.proposeSchedule);
  const addSignal = useSchedulingStore((s) => s.addSignal);
  const signals = useSchedulingStore((s) => s.signals);
  const busyBlocks = useSettingsStore((s) => s.busyBlocks);
  const calendarEvents = useSettingsStore((s) => s.calendarEvents);
  const addCalendarEvent = useSettingsStore((s) => s.addCalendarEvent);
  const quietHoursStart = useSettingsStore((s) => s.quietHoursStart);
  const quietHoursEnd = useSettingsStore((s) => s.quietHoursEnd);
  const energyPeakStart = useSettingsStore((s) => s.energyPeakStart);
  const energyPeakEnd = useSettingsStore((s) => s.energyPeakEnd);
  const getBestTimeToday = useInsightsStore((s) => s.getBestTimeToday);

  const urgentTasks = getUrgentTasks();
  const incompleteTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "complete")
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [tasks]
  );
  const topTask = incompleteTasks[0];
  const upNext = incompleteTasks.slice(1, 4);
  const bestTime = getBestTimeToday();
  const [toast, setToast] = useState<{ visible: boolean; taskId: string; taskTitle: string } | null>(null);
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // Derive tasks needing post-schedule review
  const reviewTasks = useMemo(() => {
    const now = Date.now();
    const fourHoursAgo = now - 4 * 60 * 60 * 1000;
    return tasks.filter((t) => {
      if (t.status === "complete") return false;
      if (t.scheduleStatus !== "confirmed") return false;
      if (!t.startTime) return false;
      const st = new Date(t.startTime).getTime();
      return st < now && st > fourHoursAgo;
    });
  }, [tasks]);

  const handleReviewYes = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.startTime) return;
      const st = new Date(task.startTime);
      addSignal({
        taskId,
        dayOfWeek: st.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        hourOfDay: st.getHours(),
        outcome: "completed",
        actualDurationMinutes: task.durationMinutes ?? null,
      });
      updateTask(taskId, { scheduleStatus: "completed_on_time" });
    },
    [tasks, addSignal, updateTask]
  );

  const handleReviewNo = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.startTime) return;
      const st = new Date(task.startTime);
      addSignal({
        taskId,
        dayOfWeek: st.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        hourOfDay: st.getHours(),
        outcome: "skipped",
        actualDurationMinutes: null,
      });
      // Clear time and re-propose
      updateTask(taskId, {
        startTime: undefined,
        proposedTime: undefined,
        scheduleStatus: "rescheduled",
      });
      // Re-propose via the store action
      proposeSchedule(taskId, {
        calendarEvents,
        busyBlocks,
        quietHoursStart,
        quietHoursEnd,
        energyPeakStart,
        energyPeakEnd,
        signals,
      });
    },
    [
      tasks, addSignal, updateTask, proposeSchedule,
      calendarEvents, busyBlocks, quietHoursStart,
      quietHoursEnd, energyPeakStart, energyPeakEnd, signals,
    ]
  );

  const handleReviewPartial = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.startTime) return;
      const st = new Date(task.startTime);
      addSignal({
        taskId,
        dayOfWeek: st.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        hourOfDay: st.getHours(),
        outcome: "partial",
        actualDurationMinutes: task.durationMinutes ?? null,
      });
      updateTask(taskId, { scheduleStatus: "completed_on_time" });
    },
    [tasks, addSignal, updateTask]
  );

  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-24"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="pt-4 pb-2">
          <Text className="text-title font-bold text-content dark:text-content-dark-primary">
            {getGreeting()}
          </Text>
          <Text className="text-caption text-content-secondary dark:text-content-dark-secondary mt-1">
            {formatToday()}
          </Text>
        </View>

        {/* Productivity window chip — subtle pulse animation */}
        <BestTimeChip bestTime={bestTime} />

        {/* Urgent strip */}
        {urgentTasks.length > 0 && (
          <View className="mb-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="warning-outline" size={16} className="text-danger dark:text-danger" />
              <Text className="text-caption font-semibold text-danger dark:text-danger ml-1">
                Due soon
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              {urgentTasks.map((task) => (
                <View key={task.id} className="mx-1 w-[260px]">
                  <TaskCard
                    title={task.title}
                    dueDate={task.dueDate}
                    difficulty={task.difficulty}
                    subtaskCount={task.subtasks.length}
                    completedSubtasks={task.subtasks.filter((s) => s.isComplete).length}
                    subject={task.subject}
                    onPress={() => router.push(`/task/${task.id}`)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Post-schedule review prompts */}
        {reviewTasks.length > 0 && (
          <View className="mb-4 gap-3">
            {reviewTasks.map((task) => (
              <View
                key={task.id}
                className="bg-accent-light dark:bg-accent/10 border border-accent/30 dark:border-accent/20 rounded-xl p-4"
                accessibilityLabel={`Review: Did you work on ${task.title} at ${formatScheduledTime(task.startTime!)}`}
              >
                <View className="flex-row items-center mb-2">
                  <View className="w-7 h-7 rounded-full bg-primary/15 dark:bg-primary/25 items-center justify-center mr-2">
                    <Ionicons name="time-outline" size={16} className="text-primary dark:text-primary" />
                  </View>
                  <Text className="text-small text-content-secondary dark:text-content-dark-secondary flex-1">
                    Scheduled at {formatScheduledTime(task.startTime!)}
                  </Text>
                </View>
                <Text className="text-body font-semibold text-content dark:text-content-dark-primary mb-3">
                  Did you work on &ldquo;{task.title}&rdquo;?
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => handleReviewYes(task.id)}
                    className="flex-1 min-h-[44px] items-center justify-center bg-success/15 dark:bg-success/20 border border-success/30 rounded-lg active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel={`Yes, I worked on ${task.title}`}
                  >
                    <Text className="text-caption font-semibold text-success dark:text-success">
                      Yes
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleReviewNo(task.id)}
                    className="flex-1 min-h-[44px] items-center justify-center bg-danger/10 dark:bg-danger/15 border border-danger/20 rounded-lg active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel={`No, I did not work on ${task.title}`}
                  >
                    <Text className="text-caption font-semibold text-danger dark:text-danger">
                      No
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleReviewPartial(task.id)}
                    className="flex-1 min-h-[44px] items-center justify-center bg-warning/10 dark:bg-warning/15 border border-warning/20 rounded-lg active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel={`Partially worked on ${task.title}`}
                  >
                    <Text className="text-caption font-semibold text-warning-dark dark:text-warning">
                      Partially
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Today's Focus — the ONE thing */}
        {topTask ? (
          <View className="mb-6">
            <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mb-3">
              Start here
            </Text>
            <TaskCard
              title={topTask.title}
              dueDate={topTask.dueDate}
              difficulty={topTask.difficulty}
              subtaskCount={topTask.subtasks.length}
              completedSubtasks={topTask.subtasks.filter((s) => s.isComplete).length}
              subject={topTask.subject}
              isComplete={topTask.status === "complete"}
              onToggleComplete={() => {
                const newStatus = topTask.status === "complete" ? "not_started" : "complete";
                setTaskStatus(topTask.id, newStatus);
                if (topTask.status !== "complete") {
                  setToast({ visible: true, taskId: topTask.id, taskTitle: topTask.title });
                  setTimeout(() => setToast(null), 5000);
                }
              }}
              onPress={() => router.push(`/task/${topTask.id}`)}
            />
            <View className="mt-3">
              <StarterActionCard
                action={
                  topTask.starterAction ||
                  `Open "${topTask.title}" and look at what's needed`
                }
                taskTitle={topTask.title}
                onComplete={() => {
                  setTaskStatus(topTask.id, "in_progress");
                  router.push(`/task/${topTask.id}`);
                }}
                onSkip={() => router.push(`/task/${topTask.id}`)}
              />
            </View>
          </View>
        ) : (
          <EmptyState
            title="You're all caught up 🌼"
            subtitle="Add a task when you're ready"
            icon="flower-outline"
            actionLabel="Add your first task"
            onAction={() => router.push("/task/new")}
          />
        )}

        {/* Up Next */}
        {upNext.length > 0 && (
          <View>
            <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mb-3">
              Up next
            </Text>
            <View className="gap-3">
              {upNext.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  dueDate={task.dueDate}
                  difficulty={task.difficulty}
                  subtaskCount={task.subtasks.length}
                  completedSubtasks={task.subtasks.filter((s) => s.isComplete).length}
                  subject={task.subject}
                  isComplete={task.status === "complete"}
                  onToggleComplete={() => {
                    const newStatus = task.status === "complete" ? "not_started" : "complete";
                    setTaskStatus(task.id, newStatus);
                    if (task.status !== "complete") {
                      setToast({ visible: true, taskId: task.id, taskTitle: task.title });
                      setTimeout(() => setToast(null), 5000);
                    }
                  }}
                  onPress={() => router.push(`/task/${task.id}`)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Add busy time shortcut */}
        <Pressable
          onPress={() => setShowAddEventModal(true)}
          className="flex-row items-center py-3 mt-4"
          accessibilityRole="button"
          accessibilityLabel="Add a busy time to your calendar"
        >
          <Ionicons name="calendar-outline" size={20} className="text-content-secondary dark:text-content-dark-secondary" />
          <Text className="text-body text-content-secondary dark:text-content-dark-secondary ml-2">
            Add a busy time
          </Text>
        </Pressable>
      </ScrollView>

      <FAB onPress={() => router.push("/task/new")} />

      <AddEventModal
        visible={showAddEventModal}
        onClose={() => setShowAddEventModal(false)}
        onAdd={(event) => addCalendarEvent(event)}
      />

      {/* Completion toast */}
      {toast?.visible && (
        <View
          className="absolute bottom-24 left-5 right-5 bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-xl px-4 py-3 flex-row items-center justify-between"
          style={{ elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 }}
          accessibilityLiveRegion="polite"
        >
          <Text className="text-body text-content dark:text-content-dark-primary flex-1" numberOfLines={1}>
            Task completed!
          </Text>
          <Pressable
            onPress={() => {
              setTaskStatus(toast.taskId, "not_started");
              setToast(null);
            }}
            className="ml-3 px-3 py-1.5 min-h-[36px] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Undo task completion"
          >
            <Text className="text-caption font-bold text-primary dark:text-primary">
              Undo
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
