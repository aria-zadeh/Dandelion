import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  subtitle,
  icon = "leaf-outline",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View
      className="items-center justify-center py-12 px-8"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View className="w-16 h-16 rounded-full bg-accent-light dark:bg-accent/15 items-center justify-center mb-4">
        <Ionicons name={icon} size={32} className="text-accent dark:text-accent" />
      </View>
      <Text className="text-heading font-semibold text-content dark:text-content-dark-primary text-center mb-2">
        {title}
      </Text>
      <Text className="text-body text-content-secondary dark:text-content-dark-secondary text-center mb-6 leading-6">
        {subtitle}
      </Text>
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} variant="primary" />
      )}
    </View>
  );
}
