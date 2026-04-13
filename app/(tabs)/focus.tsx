import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTaskStore } from "@/store/taskStore";
import { useSessionStore } from "@/store/sessionStore";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function FocusScreen() {
  const insets = useSafeAreaInsets();
  const tasks = useTaskStore((s) => s.tasks);
  const sessions = useSessionStore((s) => s.sessions);
  const recentSessions = useMemo(() => sessions.slice(-5).reverse(), [sessions]);

  const activeTasks = tasks
    .filter((t) => t.status !== "complete")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const handleStartFocus = (taskId: string) => {
    router.push({ pathname: "/focus/session", params: { taskId } });
  };

  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="pt-4 pb-2">
          <Text className="text-title font-bold text-content dark:text-content-dark-primary">
            Focus
          </Text>
          <Text className="text-caption text-content-secondary dark:text-content-dark-secondary mt-1">
            Pick a task and get in the zone
          </Text>
        </View>

        {activeTasks.length === 0 ? (
          <EmptyState
            title="Nothing to focus on"
            subtitle="Add a task first, then come here to start a focus session."
            icon="timer-outline"
            actionLabel="Add a task"
            onAction={() => router.push("/task/new")}
          />
        ) : (
          <View className="mt-4 gap-3">
            <Text className="text-heading font-semibold text-content dark:text-content-dark-primary">
              What do you want to work on?
            </Text>
            {activeTasks.map((task) => {
              const nextSubtask = task.subtasks.find((s) => !s.isComplete);
              return (
                <Card
                  key={task.id}
                  variant="default"
                  onPress={() => handleStartFocus(task.id)}
                  accessibilityLabel={`Focus on ${task.title}`}
                  accessibilityHint="Starts a focus session for this task"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <Text
                        className="text-body font-semibold text-content dark:text-content-dark-primary"
                        numberOfLines={1}
                      >
                        {task.title}
                      </Text>
                      {nextSubtask && (
                        <Text
                          className="text-caption text-content-secondary dark:text-content-dark-secondary mt-1"
                          numberOfLines={1}
                        >
                          Next: {nextSubtask.title}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Badge variant="difficulty" level={task.difficulty} />
                      <View className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 items-center justify-center">
                        <Ionicons name="play" size={18} className="text-primary dark:text-primary" />
                      </View>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <View className="mt-8">
            <Text className="text-heading font-semibold text-content dark:text-content-dark-primary mb-3">
              Recent sessions
            </Text>
            {recentSessions.map((session) => (
              <View
                key={session.id}
                className="flex-row items-center py-3 border-b border-border/50 dark:border-border-dark/50"
              >
                <Ionicons name="checkmark-circle" size={20} className="text-success dark:text-success" />
                <View className="flex-1 ml-3">
                  <Text className="text-caption text-content dark:text-content-dark-primary">
                    {session.durationMinutes} min session
                  </Text>
                  <Text className="text-small text-content-muted dark:text-content-dark-muted">
                    {session.completedSubtasks.length} steps completed
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
