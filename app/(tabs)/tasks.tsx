import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTaskStore } from "@/store/taskStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useSchedulingStore } from "@/store/schedulingStore";
import { TaskCard } from "@/components/ui/TaskCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FAB } from "@/components/ui/FAB";

type FilterTab = "all" | "overdue" | "today" | "thisWeek" | "later";

const tabs: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "thisWeek", label: "This Week" },
  { key: "later", label: "Later" },
];

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const tasks = useTaskStore((s) => s.tasks);
  const setTaskStatus = useTaskStore((s) => s.setTaskStatus);
  const updateTask = useTaskStore((s) => s.updateTask);
  const proposeSchedule = useTaskStore((s) => s.proposeSchedule);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; taskId: string; taskTitle: string } | null>(null);

  const { groups, completedTasks } = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const overdue: typeof tasks = [];
    const today: typeof tasks = [];
    const thisWeek: typeof tasks = [];
    const later: typeof tasks = [];
    const completed: typeof tasks = [];

    for (const task of tasks) {
      if (task.status === "complete") {
        completed.push(task);
        continue;
      }
      const due = new Date(task.dueDate);
      if (due < now) overdue.push(task);
      else if (due <= todayEnd) today.push(task);
      else if (due <= weekEnd) thisWeek.push(task);
      else later.push(task);
    }

    const byDate = (a: (typeof tasks)[number], b: (typeof tasks)[number]) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

    const all = [...overdue, ...today, ...thisWeek, ...later].sort(byDate);

    return {
      groups: {
        all,
        overdue: [...overdue].sort(byDate),
        today: [...today].sort(byDate),
        thisWeek: [...thisWeek].sort(byDate),
        later: [...later].sort(byDate),
      },
      completedTasks: [...completed].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    };
  }, [tasks]);

  const currentTasks = groups[activeTab];
  const overdueCount = useMemo(
    () => groups.overdue.length,
    [groups.overdue]
  );

  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-title font-bold text-content dark:text-content-dark-primary">
          Tasks
        </Text>
      </View>

      {/* Segment control */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-5 mb-3"
        contentContainerClassName="gap-2"
        style={{ flexGrow: 0 }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = groups[tab.key].length;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full flex-row items-center ${
                isActive
                  ? "bg-primary"
                  : "bg-surface-elevated dark:bg-surface-dark-elevated"
              }`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label}: ${count} tasks`}
            >
              <Text
                className={`text-caption font-semibold ${
                  isActive
                    ? "text-primary-foreground"
                    : "text-content-secondary dark:text-content-dark-secondary"
                }`}
              >
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  className={`ml-1.5 min-w-[20px] h-5 rounded-full items-center justify-center px-1 ${
                    isActive
                      ? "bg-primary-foreground/20"
                      : tab.key === "overdue" && overdueCount > 0
                        ? "bg-danger/15"
                        : "bg-surface-card dark:bg-surface-dark-card"
                  }`}
                >
                  <Text
                    className={`text-small font-bold ${
                      isActive
                        ? "text-primary-foreground"
                        : tab.key === "overdue" && overdueCount > 0
                          ? "text-danger"
                          : "text-content-muted dark:text-content-dark-muted"
                    }`}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Task list */}
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-24 gap-3"
        showsVerticalScrollIndicator={false}
      >
        {currentTasks.length === 0 ? (
          <EmptyState
            title={
              activeTab === "all"
                ? "No tasks yet"
                : activeTab === "overdue"
                  ? "Nothing overdue"
                  : activeTab === "today"
                    ? "Nothing due today"
                    : activeTab === "thisWeek"
                      ? "Clear week ahead"
                      : "Nothing planned yet"
            }
            subtitle={
              activeTab === "overdue"
                ? "You're staying on top of things!"
                : "Add a task whenever you're ready."
            }
            icon={activeTab === "overdue" ? "checkmark-circle-outline" : "leaf-outline"}
            actionLabel="Add a task"
            onAction={() => router.push("/task/new")}
          />
        ) : (
          currentTasks.map((task) => {
            const isOverdue = new Date(task.dueDate) < new Date();
            return (
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
                  if (task.status !== "complete") {
                    setToast({ visible: true, taskId: task.id, taskTitle: task.title });
                    setTimeout(() => setToast(null), 5000);
                  }
                  setTaskStatus(
                    task.id,
                    task.status === "complete" ? "not_started" : "complete"
                  );
                }}
                onReschedule={isOverdue ? () => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  tomorrow.setHours(23, 59, 59, 999);
                  updateTask(task.id, {
                    dueDate: tomorrow.toISOString(),
                    startTime: undefined,
                    proposedTime: undefined,
                    scheduleStatus: "unscheduled",
                  });
                  const settingsState = useSettingsStore.getState();
                  const schedulingState = useSchedulingStore.getState();
                  proposeSchedule(task.id, {
                    calendarEvents: settingsState.calendarEvents,
                    busyBlocks: settingsState.busyBlocks,
                    quietHoursStart: settingsState.quietHoursStart,
                    quietHoursEnd: settingsState.quietHoursEnd,
                    energyPeakStart: settingsState.energyPeakStart,
                    energyPeakEnd: settingsState.energyPeakEnd,
                    signals: schedulingState.signals,
                  });
                  setToast({ visible: true, taskId: task.id, taskTitle: `Rescheduled: ${task.title}` });
                  setTimeout(() => setToast(null), 3000);
                } : undefined}
                onPress={() => router.push(`/task/${task.id}`)}
              />
            );
          })
        )}

        {/* Completed tasks section */}
        {completedTasks.length > 0 && (
          <View className="mt-4">
            <Pressable
              onPress={() => setIsCompletedExpanded(!isCompletedExpanded)}
              className="flex-row items-center py-3 min-h-[44px]"
              accessibilityRole="button"
              accessibilityLabel={`Completed tasks: ${completedTasks.length}. ${isCompletedExpanded ? "Collapse" : "Expand"}`}
            >
              <Ionicons
                name={isCompletedExpanded ? "chevron-down" : "chevron-forward"}
                size={18}
                className="text-content-muted dark:text-content-dark-muted"
              />
              <Text className="ml-2 text-caption font-semibold text-content-muted dark:text-content-dark-muted">
                Completed ({completedTasks.length})
              </Text>
            </Pressable>
            {isCompletedExpanded && (
              <View className="gap-3">
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    title={task.title}
                    dueDate={task.dueDate}
                    difficulty={task.difficulty}
                    subtaskCount={task.subtasks.length}
                    completedSubtasks={task.subtasks.filter((s) => s.isComplete).length}
                    subject={task.subject}
                    isComplete={true}
                    onToggleComplete={() => setTaskStatus(task.id, "not_started")}
                    onPress={() => router.push(`/task/${task.id}`)}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <FAB onPress={() => router.push("/task/new")} />

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
