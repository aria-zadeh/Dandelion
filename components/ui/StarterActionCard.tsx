import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface StarterActionCardProps {
  action: string;
  taskTitle?: string;
  onComplete: () => void;
  onSkip?: () => void;
}

export function StarterActionCard({
  action,
  taskTitle,
  onComplete,
  onSkip,
}: StarterActionCardProps) {
  return (
    <View
      className="bg-accent-light dark:bg-accent/10 border border-accent/30 dark:border-accent/20 rounded-xl p-5"
      accessibilityLabel={`Starter action: ${action}`}
    >
      {/* Warm header */}
      <View className="flex-row items-center mb-3">
        <View className="w-8 h-8 rounded-full bg-primary/15 dark:bg-primary/25 items-center justify-center mr-2">
          <Ionicons name="sunny-outline" size={18} className="text-primary dark:text-primary" />
        </View>
        <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary">
          Start here — just this one step
        </Text>
      </View>

      {/* Task context */}
      {taskTitle && (
        <Text className="text-small text-content-muted dark:text-content-dark-muted mb-2">
          For: {taskTitle}
        </Text>
      )}

      {/* The action — large and clear */}
      <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mb-4 leading-7">
        {action}
      </Text>

      {/* Actions */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={onComplete}
          className="flex-1 min-h-[52px] flex-row items-center justify-center bg-primary rounded-lg px-4 active:bg-primary-dark"
          accessibilityRole="button"
          accessibilityLabel="Mark starter action as done"
          accessibilityHint="Completes this first step and reveals the full task breakdown"
        >
          <Ionicons name="checkmark-circle" size={20} color="hsl(30, 10%, 10%)" />
          <Text className="ml-2 text-body font-semibold text-primary-foreground">
            Done!
          </Text>
        </Pressable>

        {onSkip && (
          <Pressable
            onPress={onSkip}
            className="min-h-[52px] items-center justify-center px-4 rounded-lg active:bg-surface-elevated dark:active:bg-surface-dark-elevated"
            accessibilityRole="button"
            accessibilityLabel="Skip starter action"
          >
            <Text className="text-body text-content-secondary dark:text-content-dark-secondary">
              Skip
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
