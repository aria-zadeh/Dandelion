import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type BadgeVariant = "difficulty" | "time" | "status";
type DifficultyLevel = "low" | "medium" | "high";
type StatusType = "not_started" | "in_progress" | "complete";

interface DifficultyBadgeProps {
  variant: "difficulty";
  level: DifficultyLevel;
}

interface TimeBadgeProps {
  variant: "time";
  minutes: number;
}

interface StatusBadgeProps {
  variant: "status";
  status: StatusType;
}

type BadgeProps = DifficultyBadgeProps | TimeBadgeProps | StatusBadgeProps;

const difficultyConfig: Record<DifficultyLevel, { bg: string; text: string; icon: string; label: string }> = {
  low: {
    bg: "bg-success-light dark:bg-success/20",
    text: "text-success-dark dark:text-success",
    icon: "leaf-outline",
    label: "Easy",
  },
  medium: {
    bg: "bg-warning-light dark:bg-warning/20",
    text: "text-warning-dark dark:text-warning",
    icon: "flame-outline",
    label: "Medium",
  },
  high: {
    bg: "bg-danger-light dark:bg-danger/20",
    text: "text-danger-dark dark:text-danger",
    icon: "flash-outline",
    label: "Hard",
  },
};

const statusConfig: Record<StatusType, { bg: string; text: string; icon: string; label: string }> = {
  not_started: {
    bg: "bg-surface-elevated dark:bg-surface-dark-elevated",
    text: "text-content-secondary dark:text-content-dark-secondary",
    icon: "ellipse-outline",
    label: "Not started",
  },
  in_progress: {
    bg: "bg-primary/10 dark:bg-primary/20",
    text: "text-primary-dark dark:text-primary",
    icon: "play-circle-outline",
    label: "In progress",
  },
  complete: {
    bg: "bg-success-light dark:bg-success/20",
    text: "text-success-dark dark:text-success",
    icon: "checkmark-circle-outline",
    label: "Done",
  },
};

export function Badge(props: BadgeProps) {
  let config: { bg: string; text: string; icon: string; label: string };

  if (props.variant === "difficulty") {
    config = difficultyConfig[props.level];
  } else if (props.variant === "time") {
    config = {
      bg: "bg-accent-light dark:bg-accent/20",
      text: "text-accent-dark dark:text-accent",
      icon: "time-outline",
      label: `${props.minutes} min`,
    };
  } else {
    config = statusConfig[props.status];
  }

  return (
    <View
      className={`flex-row items-center rounded-full px-2.5 py-1 ${config.bg}`}
      accessibilityLabel={config.label}
    >
      <Ionicons name={config.icon as any} size={14} className={config.text} />
      <Text className={`ml-1 text-small font-medium ${config.text}`}>
        {config.label}
      </Text>
    </View>
  );
}
