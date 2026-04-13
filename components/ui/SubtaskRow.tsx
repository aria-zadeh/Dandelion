import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/utils/design-tokens";

interface SubtaskRowProps {
  title: string;
  durationMinutes: number;
  completed: boolean;
  onToggle: () => void;
  /** AI feature stub — will simplify this subtask */
  onMakeEasier?: () => void;
  /** When true, shows a small spinner next to the sparkles icon indicating simplification is in progress */
  isMakingEasier?: boolean;
}

export function SubtaskRow({
  title,
  durationMinutes,
  completed,
  onToggle,
  onMakeEasier,
  isMakingEasier = false,
}: SubtaskRowProps) {
  return (
    <View
      className="flex-row items-center py-3 border-b border-border/50 dark:border-border-dark/50"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      accessibilityLabel={`${title}, ${durationMinutes} minutes${completed ? ", completed" : ""}`}
    >
      {/* Checkbox */}
      <Pressable
        onPress={onToggle}
        className="min-w-[44px] min-h-[44px] items-center justify-center"
        accessibilityLabel={completed ? "Mark as incomplete" : "Mark as complete"}
        hitSlop={8}
      >
        <View
          className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
            completed
              ? "bg-success border-success"
              : "border-border dark:border-border-dark"
          }`}
        >
          {completed && (
            <Ionicons name="checkmark" size={14} color="#fff" />
          )}
        </View>
      </Pressable>

      {/* Content */}
      <View className="flex-1 ml-1">
        <Text
          className={`text-body ${
            completed
              ? "line-through text-content-muted dark:text-content-dark-muted"
              : "text-content dark:text-content-dark-primary"
          }`}
        >
          {title}
        </Text>
        <Text className="text-small text-content-muted dark:text-content-dark-muted">
          ~{durationMinutes} min
        </Text>
      </View>

      {/* Make easier — AI feature */}
      {onMakeEasier && !completed && (
        <Pressable
          onPress={onMakeEasier}
          disabled={isMakingEasier}
          className="min-w-[44px] min-h-[44px] items-center justify-center ml-1"
          accessibilityLabel={isMakingEasier ? "Making this step easier…" : "Make this step easier"}
          accessibilityHint="AI will suggest a simpler version of this step"
          accessibilityState={{ busy: isMakingEasier }}
          hitSlop={8}
        >
          {isMakingEasier ? (
            <ActivityIndicator
              size="small"
              color={colors.light.accent}
              accessibilityLabel="Simplifying step"
            />
          ) : (
            <Ionicons
              name="sparkles-outline"
              size={18}
              className="text-accent dark:text-accent"
            />
          )}
        </Pressable>
      )}
    </View>
  );
}
