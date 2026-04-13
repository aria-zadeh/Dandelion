import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOutRight } from "react-native-reanimated";
import { ProgressBar } from "./ProgressBar";
import { Badge } from "./Badge";
import { getUrgencyLevel } from "@/types";
import type { Difficulty } from "@/types";

interface TaskCardProps {
  title: string;
  dueDate: string;
  difficulty: Difficulty;
  subtaskCount: number;
  completedSubtasks: number;
  subject?: string | null;
  isComplete?: boolean;
  onToggleComplete?: () => void;
  onReschedule?: () => void;
  onPress: () => void;
}

const urgencyDisplay = {
  none: { icon: "time-outline" as const, textClass: "text-content-secondary dark:text-content-dark-secondary", label: "" },
  soon: { icon: "alert-circle-outline" as const, textClass: "text-warning dark:text-warning", label: "Due soon" },
  urgent: { icon: "warning-outline" as const, textClass: "text-danger dark:text-danger", label: "Due today" },
};

function formatDueDate(dueDate: string): string {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) {
    const overdue = Math.abs(diffHours);
    if (overdue < 24) return `${Math.round(overdue)}h overdue`;
    return `${Math.round(overdue / 24)}d overdue`;
  }
  if (diffHours < 1) return `${Math.round(diffHours * 60)}m left`;
  if (diffHours < 24) return `${Math.round(diffHours)}h left`;
  if (diffHours < 48) return "Tomorrow";
  if (diffHours < 168) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[due.getDay()];
  }
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TaskCard({
  title,
  dueDate,
  difficulty,
  subtaskCount,
  completedSubtasks,
  subject,
  isComplete = false,
  onToggleComplete,
  onReschedule,
  onPress,
}: TaskCardProps) {
  const urgency = getUrgencyLevel(dueDate);
  const urgencyStyle = urgencyDisplay[urgency];
  const progress = subtaskCount > 0 ? completedSubtasks / subtaskCount : 0;
  const isOverdue = new Date(dueDate).getTime() < Date.now();

  return (
    <Animated.View
      entering={FadeInDown.duration(250).springify()}
      exiting={FadeOutRight.duration(200)}
      className="flex-row items-center gap-3"
      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      {/* Completion checkbox — 44pt touch target */}
      <Pressable
        onPress={onToggleComplete}
        className="min-w-[44px] min-h-[44px] items-center justify-center"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isComplete }}
        accessibilityLabel={isComplete ? "Mark task as incomplete" : "Mark task as complete"}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={isComplete ? "checkmark-circle" : "ellipse-outline"}
          size={26}
          className={
            isComplete
              ? "text-success dark:text-success"
              : "text-content-muted dark:text-content-dark-muted"
          }
        />
      </Pressable>

      {/* Card body */}
      <Pressable
        onPress={onPress}
        className={`flex-1 bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg p-4 active:opacity-90 active:scale-[0.98] ${isComplete ? "opacity-50" : ""}`}
        accessibilityRole="button"
        accessibilityLabel={`Task: ${title}. ${formatDueDate(dueDate)}. ${completedSubtasks} of ${subtaskCount} subtasks done.${isComplete ? " Completed." : ""}`}
        accessibilityHint="Opens task details"
      >
      {/* Top row: title + due date */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-3">
          <Text
            className={`text-body font-semibold ${isComplete ? "line-through text-content-muted dark:text-content-dark-muted" : "text-content dark:text-content-dark-primary"}`}
            numberOfLines={2}
          >
            {title}
          </Text>
          {subject && (
            <Text className="text-small text-content-muted dark:text-content-dark-muted mt-0.5">
              {subject}
            </Text>
          )}
        </View>
        <View className="flex-row items-center">
          <Ionicons name={urgencyStyle.icon} size={16} className={urgencyStyle.textClass} />
          <Text className={`ml-1 text-small font-medium ${urgencyStyle.textClass} ${isOverdue ? "text-danger dark:text-danger" : ""}`}>
            {formatDueDate(dueDate)}
          </Text>
          {onReschedule && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onReschedule(); }}
              className="bg-primary/15 rounded-full px-3 py-1 ml-2"
              accessibilityRole="button"
              accessibilityLabel="Reschedule task"
            >
              <Text className="text-small font-semibold text-primary">Reschedule</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Badges row */}
      <View className="flex-row gap-2 mb-3">
        <Badge variant="difficulty" level={difficulty} />
        {subtaskCount > 0 && (
          <Badge variant="time" minutes={subtaskCount * 10} />
        )}
      </View>

      {/* Progress */}
      {subtaskCount > 0 && (
        <ProgressBar
          progress={progress}
          label={`${completedSubtasks}/${subtaskCount} steps`}
        />
      )}
      </Pressable>
    </Animated.View>
  );
}
