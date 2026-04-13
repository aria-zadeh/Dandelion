import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Switch, Platform, Modal } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTaskStore } from "@/store/taskStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useSchedulingStore } from "@/store/schedulingStore";
import { StarterActionCard } from "@/components/ui/StarterActionCard";
import { SubtaskRow } from "@/components/ui/SubtaskRow";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { simplifySubtask, breakdownTask } from "@/services/ai";
import { getUrgencyLevel } from "@/types";
import { DateTimePickerCrossPlatform } from "@/components/ui/DateTimePickerCrossPlatform";

function formatTimeFromDate(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const task = useTaskStore((s) => s.getTaskById(id));
  const toggleSubtask = useTaskStore((s) => s.toggleSubtask);
  const updateSubtask = useTaskStore((s) => s.updateSubtask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const setTaskStatus = useTaskStore((s) => s.setTaskStatus);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const addSubtasks = useTaskStore((s) => s.addSubtasks);
  const proposeSchedule = useTaskStore((s) => s.proposeSchedule);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStarter, setShowStarter] = useState(true);
  const [makeEasierLoading, setMakeEasierLoading] = useState<string | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownFallback, setBreakdownFallback] = useState(false);
  const [editingDuration, setEditingDuration] = useState<number | null>(null);
  const [durationInitialized, setDurationInitialized] = useState(false);

  // ── Start time editing (Type A calendar block) ────────────────────────
  // Initialise from task.startTime — updated once task loads (task is stable by the time render reaches here)
  const [hasStartTime, setHasStartTime] = useState(() => !!task?.startTime);
  const [startTimeDate, setStartTimeDate] = useState<Date>(() => {
    if (task?.startTime) return new Date(task.startTime);
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [androidStartTimePicker, setAndroidStartTimePicker] = useState(false);

  const handleSaveStartTime = useCallback((enabled: boolean, time: Date) => {
    if (!task) return;
    let startTimeISO: string | undefined;
    if (enabled) {
      const st = new Date(task.dueDate);
      st.setHours(time.getHours(), time.getMinutes(), 0, 0);
      startTimeISO = st.toISOString();
    }
    updateTask(task.id, { startTime: startTimeISO });
  }, [task, updateTask]);

  if (!task) {
    return (
      <View className="flex-1 bg-surface dark:bg-surface-dark justify-center items-center">
        <EmptyState
          title="Task not found"
          subtitle="This task may have been deleted."
          icon="alert-circle-outline"
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const completedCount = task.subtasks.filter((s) => s.isComplete).length;
  const progress = task.subtasks.length > 0 ? completedCount / task.subtasks.length : 0;
  const urgency = getUrgencyLevel(task.dueDate);
  const allDone = task.subtasks.length > 0 && completedCount === task.subtasks.length;

  const handleStarterComplete = () => {
    setShowStarter(false);
    setTaskStatus(task.id, "in_progress");
  };

  const handleMakeEasier = async (subtaskId: string) => {
    const subtask = task.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) return;
    setMakeEasierLoading(subtaskId);
    const simplified = await simplifySubtask(subtaskId, subtask.title);
    if (simplified !== subtask.title) {
      updateSubtask(task.id, subtaskId, { title: simplified });
    }
    setMakeEasierLoading(null);
  };

  const handleBreakdown = async () => {
    if (!task) return;
    setBreakdownLoading(true);
    try {
      const result = await breakdownTask({
        title: task.title,
        subject: task.subject,
        dueDate: task.dueDate,
        difficulty: task.difficulty,
      });
      addSubtasks(
        task.id,
        result.subtasks.map((s, i) => ({
          title: s.title,
          estimatedMinutes: s.estimatedMinutes,
          isComplete: false,
          order: i,
        }))
      );
      updateTask(task.id, { starterAction: result.starterAction });
      // Auto-schedule after breakdown — calculate total duration from subtasks
      const totalDuration = result.subtasks.reduce((sum, s) => sum + s.estimatedMinutes, 0);
      if (totalDuration > 0 && !task.startTime) {
        try {
          const settingsState = useSettingsStore.getState();
          const schedulingState = useSchedulingStore.getState();
          // Update duration first
          updateTask(task.id, { durationMinutes: totalDuration });
          // Then propose schedule
          setTimeout(() => {
            proposeSchedule(task.id, {
              calendarEvents: settingsState.calendarEvents,
              busyBlocks: settingsState.busyBlocks,
              quietHoursStart: settingsState.quietHoursStart,
              quietHoursEnd: settingsState.quietHoursEnd,
              energyPeakStart: settingsState.energyPeakStart,
              energyPeakEnd: settingsState.energyPeakEnd,
              signals: schedulingState.signals,
            });
          }, 0);
        } catch {
          // Best-effort — don't block the UI
        }
      }
      if (result.isFallback || result.fromFallback) {
        setBreakdownFallback(true);
      }
    } finally {
      setBreakdownLoading(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    // Capture id before deletion — task becomes undefined once store updates
    const taskId = task.id;
    setShowDeleteModal(false);
    deleteTask(taskId);
    // Use replace so we don't navigate back to a now-deleted task
    router.replace("/(tabs)/tasks");
  };

  const handleStartFocus = () => {
    router.push({ pathname: "/focus/session", params: { taskId: task.id } });
  };

  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable
          onPress={() => router.back()}
          className="min-w-[44px] min-h-[44px] items-center justify-center"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} className="text-content dark:text-content-dark-primary" />
        </Pressable>
        <Pressable
          onPress={handleDelete}
          className="min-w-[44px] min-h-[44px] items-center justify-center"
          accessibilityLabel="Delete task"
        >
          <Ionicons name="trash-outline" size={22} className="text-danger dark:text-danger" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-32"
        showsVerticalScrollIndicator={false}
      >
        {/* Task title and meta */}
        <Text className="text-title font-bold text-content dark:text-content-dark-primary mb-2">
          {task.title}
        </Text>

        <View className="flex-row items-center gap-2 mb-3 flex-wrap">
          {task.subject && (
            <View className="bg-surface-elevated dark:bg-surface-dark-elevated px-2.5 py-1 rounded-full">
              <Text className="text-small text-content-secondary dark:text-content-dark-secondary">
                {task.subject}
              </Text>
            </View>
          )}
          <Badge variant="difficulty" level={task.difficulty} />
          <Badge variant="status" status={task.status} />
        </View>

        {/* Due date */}
        <View className="flex-row items-center mb-4">
          <Ionicons
            name={urgency === "urgent" ? "warning-outline" : urgency === "soon" ? "alert-circle-outline" : "time-outline"}
            size={16}
            className={
              urgency === "urgent"
                ? "text-danger"
                : urgency === "soon"
                  ? "text-warning"
                  : "text-content-secondary dark:text-content-dark-secondary"
            }
          />
          <Text
            className={`ml-1.5 text-caption font-medium ${
              urgency === "urgent"
                ? "text-danger"
                : urgency === "soon"
                  ? "text-warning"
                  : "text-content-secondary dark:text-content-dark-secondary"
            }`}
          >
            Due {new Date(task.dueDate).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </View>

        {/* Proposed schedule — accept/dismiss bar */}
        {task.scheduleStatus === "proposed" && task.proposedTime && (
          <View className="bg-primary/10 dark:bg-primary/15 border border-primary/30 dark:border-primary/20 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center mb-1">
              <Ionicons name="sparkles-outline" size={16} className="text-primary dark:text-primary" />
              <Text className="ml-1.5 text-small font-medium text-content-secondary dark:text-content-dark-secondary">
                Suggested time
              </Text>
            </View>
            <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mb-3">
              {new Date(task.proposedTime).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() =>
                  updateTask(task.id, {
                    startTime: task.proposedTime,
                    scheduleStatus: "confirmed",
                  })
                }
                className="flex-1 min-h-[44px] flex-row items-center justify-center bg-primary rounded-lg px-4 active:bg-primary-dark"
                accessibilityRole="button"
                accessibilityLabel="Accept suggested time"
              >
                <Ionicons name="checkmark" size={18} color="hsl(30, 10%, 10%)" />
                <Text className="ml-1.5 text-body font-semibold text-primary-foreground">
                  Accept
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  updateTask(task.id, {
                    proposedTime: undefined,
                    scheduleStatus: "unscheduled",
                  })
                }
                className="min-h-[44px] flex-row items-center justify-center px-4 rounded-lg active:bg-surface-elevated dark:active:bg-surface-dark-elevated"
                accessibilityRole="button"
                accessibilityLabel="Dismiss suggested time"
              >
                <Text className="text-body font-medium text-content-secondary dark:text-content-dark-secondary">
                  Not now
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Start time — optional Type A calendar block */}
        <View className="mb-4 bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-2xl px-4 py-3 gap-2">
          <Pressable
            onPress={() => {
              const next = !hasStartTime;
              setHasStartTime(next);
              if (!next) setShowStartTimePicker(false);
              handleSaveStartTime(next, startTimeDate);
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
              Start time
              <Text className="text-content-muted dark:text-content-dark-muted font-normal"> (optional)</Text>
            </Text>
            <Switch
              value={hasStartTime}
              onValueChange={(val) => {
                setHasStartTime(val);
                if (!val) setShowStartTimePicker(false);
                handleSaveStartTime(val, startTimeDate);
              }}
              accessibilityLabel="Add start time"
            />
          </Pressable>

          {hasStartTime && (
            <>
              {Platform.OS === "android" ? (
                <Pressable
                  onPress={() => setAndroidStartTimePicker(true)}
                  className="flex-row items-center bg-surface dark:bg-surface-dark border border-primary/40 dark:border-primary/30 rounded-xl px-4 py-3 min-h-[44px]"
                  accessibilityRole="button"
                  accessibilityLabel={`Start time: ${formatTimeFromDate(startTimeDate)}. Tap to change.`}
                >
                  <Ionicons name="time-outline" size={18} className="text-primary dark:text-primary" />
                  <Text className="ml-2 text-body font-semibold text-primary dark:text-primary">
                    {formatTimeFromDate(startTimeDate)}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setShowStartTimePicker((p) => !p)}
                  className="flex-row items-center bg-surface dark:bg-surface-dark border border-primary/40 dark:border-primary/30 rounded-xl px-4 py-3 min-h-[44px]"
                  accessibilityRole="button"
                  accessibilityLabel={`Start time: ${formatTimeFromDate(startTimeDate)}. Tap to change.`}
                >
                  <Ionicons name="time-outline" size={18} className="text-primary dark:text-primary" />
                  <Text className="ml-2 text-body font-semibold text-primary dark:text-primary">
                    {formatTimeFromDate(startTimeDate)}
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
                    onChange={(selected) => {
                      setStartTimeDate(selected);
                      handleSaveStartTime(true, selected);
                    }}
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
                    handleSaveStartTime(true, selected);
                  }}
                  accessibilityLabel="Select start time"
                />
              )}
            </>
          )}
        </View>

        {/* Duration — How long? */}
        <View className="mb-4">
          <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary mb-1.5">
            How long?
          </Text>

          {/* Auto-sum from subtasks */}
          {task.subtasks.length > 0 && (
            <View className="flex-row items-center bg-accent-light dark:bg-accent/10 rounded-lg px-3 py-2 mb-2">
              <Ionicons name="sparkles-outline" size={14} className="text-accent dark:text-accent" />
              <Text className="text-small text-accent-dark dark:text-accent ml-1.5">
                Total from steps: {task.subtasks.reduce((sum, s) => sum + s.estimatedMinutes, 0)}m
              </Text>
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
              const currentDuration = durationInitialized ? editingDuration : task.durationMinutes;
              const isSelected = currentDuration === preset.value;
              return (
                <Pressable
                  key={preset.value}
                  onPress={() => {
                    const newVal = isSelected ? null : preset.value;
                    setEditingDuration(newVal);
                    setDurationInitialized(true);
                    updateTask(task.id, { durationMinutes: newVal });
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

        {/* Progress */}
        {task.subtasks.length > 0 && (
          <View className="mb-5">
            <ProgressBar
              progress={progress}
              label={`${completedCount} of ${task.subtasks.length} steps done`}
              showPercentage
            />
          </View>
        )}

        {/* Celebration */}
        {allDone && (
          <View className="bg-success-light dark:bg-success/10 border border-success/30 rounded-xl p-5 items-center mb-5">
            <Ionicons name="checkmark-circle" size={40} className="text-success" />
            <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mt-2">
              You did it!
            </Text>
            <Text className="text-body text-content-secondary dark:text-content-dark-secondary text-center mt-1">
              Every step counts. Nice work.
            </Text>
          </View>
        )}

        {/* Starter action */}
        {showStarter && task.status === "not_started" && !allDone && (
          <View className="mb-5">
            <StarterActionCard
              action={task.starterAction}
              onComplete={handleStarterComplete}
              onSkip={handleStarterComplete}
            />
          </View>
        )}

        {/* AI Breakdown CTA — shown when task has no subtasks */}
        {task.subtasks.length === 0 && task.status !== "complete" && !breakdownLoading && (
          <View className="mb-5 bg-accent/10 dark:bg-accent/15 border border-accent/30 dark:border-accent/20 rounded-2xl p-5">
            <View className="flex-row items-center mb-2">
              <Ionicons name="sparkles" size={20} className="text-accent dark:text-accent" />
              <Text className="ml-2 text-heading font-semibold text-content dark:text-content-dark-primary">
                Let&apos;s break this into smaller steps
              </Text>
            </View>
            <Text className="text-body text-content-secondary dark:text-content-dark-secondary mb-4">
              AI will split this task into bite-sized steps so you know exactly where to start.
            </Text>
            <Button
              title="Break it down"
              variant="primary"
              onPress={handleBreakdown}
              icon={<Ionicons name="sparkles" size={18} color="hsl(30, 10%, 10%)" />}
              accessibilityLabel="Break task into smaller steps with AI"
              style={{ minHeight: 52 }}
            />
            {/* Skeleton previews — hint at what subtasks will look like */}
            <View className="mt-4 gap-2 opacity-40">
              <LoadingSkeleton width="100%" height={44} borderRadius={8} />
              <LoadingSkeleton width="90%" height={44} borderRadius={8} />
              <LoadingSkeleton width="95%" height={44} borderRadius={8} />
            </View>
          </View>
        )}

        {/* AI Breakdown loading state */}
        {breakdownLoading && (
          <View className="mb-5 gap-3">
            <LoadingSkeleton width="100%" height={20} />
            <LoadingSkeleton width="90%" height={20} />
            <LoadingSkeleton width="95%" height={20} />
            <LoadingSkeleton width="80%" height={20} />
          </View>
        )}

        {/* Subtask list */}
        {task.subtasks.length > 0 && (
          <View className="mb-5">
            <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mb-2">
              Steps
            </Text>
            {task.subtasks
              .sort((a, b) => a.order - b.order)
              .map((subtask) => (
                <React.Fragment key={subtask.id}>
                  {makeEasierLoading === subtask.id ? (
                    <View className="py-3">
                      <LoadingSkeleton width="100%" height={44} borderRadius={8} />
                    </View>
                  ) : (
                    <SubtaskRow
                      title={subtask.title}
                      durationMinutes={subtask.estimatedMinutes}
                      completed={subtask.isComplete}
                      onToggle={() => toggleSubtask(task.id, subtask.id)}
                      onMakeEasier={() => handleMakeEasier(subtask.id)}
                    />
                  )}
                </React.Fragment>
              ))}

            {/* Fallback banner — shown after subtask list when AI used fallback */}
            {breakdownFallback && (
              <View className="flex-row items-center bg-warning-light dark:bg-warning/10 rounded-md px-2.5 py-1.5 mt-2">
                <Ionicons name="flower-outline" size={14} className="text-warning-dark dark:text-warning" />
                <Text className="text-small text-warning-dark dark:text-warning ml-1.5">
                  Showing general steps — AI is resting 🌱
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Description */}
        {task.description && (
          <View className="mb-5">
            <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary mb-1">
              Notes
            </Text>
            <Text className="text-body text-content dark:text-content-dark-primary leading-6">
              {task.description}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View
        className="px-5 pt-3 gap-2 bg-surface dark:bg-surface-dark border-t border-border dark:border-border-dark"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        {task.status === "complete" ? (
          <Button
            title="Reopen task"
            variant="secondary"
            onPress={() => setTaskStatus(task.id, "not_started")}
            icon={<Ionicons name="refresh-outline" size={18} />}
            accessibilityLabel="Reopen task"
          />
        ) : (
          <>
            <Button
              title="Mark complete"
              variant="primary"
              onPress={() => setTaskStatus(task.id, "complete")}
              icon={<Ionicons name="checkmark-circle-outline" size={18} color="hsl(30, 10%, 10%)" />}
              accessibilityLabel="Mark task as complete"
            />
            {!allDone && (
              <Button
                title="Start focus session"
                variant="secondary"
                onPress={handleStartFocus}
                icon={<Ionicons name="play" size={18} />}
                accessibilityLabel="Start a focus session for this task"
              />
            )}
          </>
        )}
      </View>

      {/* Delete confirmation modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={() => setShowDeleteModal(false)}
          accessibilityLabel="Close delete confirmation"
        >
          <View
            className="bg-surface dark:bg-surface-dark rounded-2xl mx-8 p-6 w-[300px]"
            onStartShouldSetResponder={() => true}
          >
            <Text className="text-heading font-bold text-content dark:text-content-dark-primary text-center mb-2">
              Delete Task
            </Text>
            <Text className="text-body text-content-secondary dark:text-content-dark-secondary text-center mb-6">
              Are you sure? This can&apos;t be undone.
            </Text>
            <View className="gap-3">
              <Pressable
                onPress={confirmDelete}
                className="min-h-[52px] items-center justify-center rounded-lg bg-danger active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Confirm delete task"
              >
                <Text className="text-body font-semibold text-white">
                  Delete
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                className="min-h-[52px] items-center justify-center rounded-lg bg-surface-elevated dark:bg-surface-dark-elevated active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Cancel delete"
              >
                <Text className="text-body font-semibold text-content dark:text-content-dark-primary">
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
