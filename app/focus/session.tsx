import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  PanResponder,
  LayoutChangeEvent,
  type DimensionValue,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTaskStore } from "@/store/taskStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useInsightsStore } from "@/store/insightsStore";
import { TimerDisplay } from "@/components/ui/TimerDisplay";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { SubtaskRow } from "@/components/ui/SubtaskRow";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { BreakModal } from "@/components/BreakModal";
import { simplifySubtask } from "@/services/ai";
import { useFocusAudio } from "@/hooks/useFocusAudio";
import { AUDIO_PICKER_OPTIONS } from "@/utils/audioConfig";
import type { FocusAudio } from "@/types";

// ─── Volume Slider ─────────────────────────────────────────────────────────────

interface VolumeSliderProps {
  value: number;
  onChange: (v: number) => void;
}

function VolumeSlider({ value, onChange }: VolumeSliderProps) {
  const trackWidth = useRef<number>(0);

  const clamp = (n: number) => Math.min(1, Math.max(0, n));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (trackWidth.current > 0) {
          const x = evt.nativeEvent.locationX;
          onChange(clamp(x / trackWidth.current));
        }
      },
      onPanResponderMove: (evt) => {
        if (trackWidth.current > 0) {
          const x = evt.nativeEvent.locationX;
          onChange(clamp(x / trackWidth.current));
        }
      },
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  const pct = Math.round(value * 100);
  const thumbLeft = `${pct}%` as DimensionValue;

  return (
    <View
      className="mt-3 mx-1"
      accessibilityLabel={`Volume: ${Math.round(value * 100)} percent`}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      {/* Track */}
      <View
        className="h-[44px] justify-center"
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {/* Rail background */}
        <View className="h-[6px] rounded-full bg-border dark:bg-border-dark overflow-hidden">
          {/* Fill */}
          <View
            className="h-full rounded-full bg-accent"
            style={{ width: thumbLeft }}
          />
        </View>
        {/* Thumb */}
        <View
          className="absolute w-[22px] h-[22px] rounded-full bg-accent border-2 border-surface dark:border-surface-dark"
          style={{
            left: thumbLeft,
            marginLeft: -11,
            top: "50%" as DimensionValue,
            marginTop: -11,
          }}
        />
      </View>
      {/* Labels */}
      <View className="flex-row justify-between">
        <Ionicons
          name="volume-low-outline"
          size={14}
          className="text-content-muted dark:text-content-dark-muted"
        />
        <Ionicons
          name="volume-high-outline"
          size={14}
          className="text-content-muted dark:text-content-dark-muted"
        />
      </View>
    </View>
  );
}

// ─── Audio Picker ──────────────────────────────────────────────────────────────

interface AudioPickerProps {
  selected: FocusAudio;
  onSelect: (type: FocusAudio) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
}

function AudioPicker({ selected, onSelect, volume, onVolumeChange }: AudioPickerProps) {
  return (
    <View className="w-full mb-4">
      <Text className="text-caption font-medium text-content-muted dark:text-content-dark-muted mb-2">
        Ambient sound
      </Text>

      {/* Chip row */}
      <View className="flex-row gap-2 flex-wrap">
        {AUDIO_PICKER_OPTIONS.map((opt) => {
          const isSelected = selected === opt.type;
          return (
            <Pressable
              key={opt.type}
              onPress={() => onSelect(opt.type as FocusAudio)}
              className={[
                "min-h-[44px] flex-row items-center px-3 rounded-xl border",
                isSelected
                  ? "bg-accent/20 border-accent"
                  : "bg-surface-elevated dark:bg-surface-dark-elevated border-border dark:border-border-dark",
              ].join(" ")}
              accessibilityRole="button"
              accessibilityLabel={`${opt.label} ambient sound`}
              accessibilityState={{ selected: isSelected }}
            >
              <Ionicons
                // @ts-ignore — Ionicons name types are overly strict; all icons used are valid
                name={opt.icon}
                size={16}
                className={
                  isSelected
                    ? "text-accent"
                    : "text-content-secondary dark:text-content-dark-secondary"
                }
              />
              <Text
                className={[
                  "text-small font-medium ml-1.5",
                  isSelected
                    ? "text-accent"
                    : "text-content-secondary dark:text-content-dark-secondary",
                ].join(" ")}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Volume slider — only when audio is active */}
      {selected !== "none" && (
        <VolumeSlider value={volume} onChange={onVolumeChange} />
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function FocusSessionScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const insets = useSafeAreaInsets();

  const task = useTaskStore((s) => s.getTaskById(taskId));
  const toggleSubtask = useTaskStore((s) => s.toggleSubtask);
  const updateSubtask = useTaskStore((s) => s.updateSubtask);
  const { startSession, endSession, markSubtaskCompleted, activeSession } = useSessionStore();
  const pomodoroEnabled = useSettingsStore((s) => s.pomodoroEnabled);
  const pomodoroWork = useSettingsStore((s) => s.pomodoroWorkMinutes);
  const logCompletion = useInsightsStore((s) => s.logCompletion);
  const savedFocusAudio = useSettingsStore((s) => s.focusAudio);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const [seconds, setSeconds] = useState(pomodoroEnabled ? pomodoroWork * 60 : 0);
  const [running, setRunning] = useState(true);
  const [showBreak, setShowBreak] = useState(false);
  const [stuckLoading, setStuckLoading] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<FocusAudio>(savedFocusAudio);
  const [volume, setVolume] = useState(0.7);
  const sessionStarted = useRef(false);

  // Audio hook
  const audio = useFocusAudio();

  // Start session on mount
  useEffect(() => {
    if (!sessionStarted.current && taskId) {
      const nextSubtask = task?.subtasks.find((s) => !s.isComplete);
      startSession(taskId, nextSubtask?.id || null);
      sessionStarted.current = true;
    }
    return () => {
      if (sessionStarted.current) {
        endSession();
      }
    };
  }, []);

  // Kick off saved audio preference on session start
  useEffect(() => {
    if (savedFocusAudio !== "none") {
      audio.select(savedFocusAudio);
      audio.setVolume(volume);
    }
    // Cleanup: stop audio when session screen unmounts
    return () => {
      audio.stop();
    };
  }, []); // intentionally once on mount

  // Timer
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (pomodoroEnabled) {
          // Countdown
          if (prev <= 1) {
            setRunning(false);
            setShowBreak(true);
            return 0;
          }
          return prev - 1;
        }
        // Count up
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, pomodoroEnabled]);

  // Pause / resume audio when break modal opens/closes
  useEffect(() => {
    if (showBreak) {
      audio.pause();
    } else {
      // Only resume if an audio type is selected
      if (selectedAudio !== "none") {
        audio.resume();
      }
    }
  }, [showBreak]);

  // ── Handlers ──

  const handleSelectAudio = useCallback(
    async (type: FocusAudio) => {
      setSelectedAudio(type);
      updateSetting("focusAudio", type);
      await audio.select(type);
    },
    [audio, updateSetting]
  );

  const handleVolumeChange = useCallback(
    (v: number) => {
      setVolume(v);
      audio.setVolume(v);
    },
    [audio]
  );

  if (!task) {
    return (
      <View className="flex-1 bg-surface dark:bg-surface-dark justify-center items-center">
        <Text className="text-body text-content-secondary">Task not found</Text>
        <Button title="Go back" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const subtasks = task.subtasks.sort((a, b) => a.order - b.order);
  const currentSubtask = subtasks.find((s) => !s.isComplete);
  const completedCount = subtasks.filter((s) => s.isComplete).length;
  const progress = subtasks.length > 0 ? completedCount / subtasks.length : 0;
  const allDone = subtasks.length > 0 && completedCount === subtasks.length;

  const handleToggleSubtask = (subtaskId: string) => {
    toggleSubtask(task.id, subtaskId);
    markSubtaskCompleted(subtaskId);
    logCompletion(task.id, subtaskId);
  };

  const handleStuck = async () => {
    if (!currentSubtask) return;
    setStuckLoading(true);
    const simplified = await simplifySubtask(currentSubtask.id, currentSubtask.title);
    if (simplified !== currentSubtask.title) {
      updateSubtask(task.id, currentSubtask.id, { title: simplified });
    }
    setStuckLoading(false);
  };

  const handleEndSession = () => {
    audio.stop();
    endSession();
    router.back();
  };

  return (
    <View
      className="flex-1 bg-surface dark:bg-surface-dark"
      style={{ paddingTop: insets.top }}
    >
      {/* Top bar */}
      <View className="flex-row items-center justify-between px-5 py-2">
        <Pressable
          onPress={handleEndSession}
          className="min-w-[44px] min-h-[44px] items-center justify-center"
          accessibilityLabel="End focus session"
        >
          <Ionicons name="close" size={24} className="text-content dark:text-content-dark-primary" />
        </Pressable>
        <Text
          className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary"
          numberOfLines={1}
        >
          {task.title}
        </Text>
        <Pressable
          onPress={() => setRunning((r) => !r)}
          className="min-w-[44px] min-h-[44px] items-center justify-center"
          accessibilityLabel={running ? "Pause timer" : "Resume timer"}
        >
          <Ionicons
            name={running ? "pause" : "play"}
            size={22}
            className="text-content dark:text-content-dark-primary"
          />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 items-center pb-32"
        showsVerticalScrollIndicator={false}
      >
        {/* Timer */}
        <View className="mt-8 mb-6">
          <TimerDisplay
            seconds={seconds}
            running={running}
            label={pomodoroEnabled ? "Focus time remaining" : "Time focused"}
          />
        </View>

        {/* Progress */}
        <View className="w-full mb-8">
          <ProgressBar
            progress={progress}
            label={`${completedCount}/${subtasks.length} steps done`}
            showPercentage
          />
        </View>

        {/* Audio picker — always visible during session */}
        <AudioPicker
          selected={selectedAudio}
          onSelect={handleSelectAudio}
          volume={volume}
          onVolumeChange={handleVolumeChange}
        />

        {/* All done celebration */}
        {allDone ? (
          <View className="items-center py-8">
            <Ionicons name="checkmark-circle" size={64} className="text-success" />
            <Text className="text-title font-bold text-content dark:text-content-dark-primary mt-4 text-center">
              You finished everything!
            </Text>
            <Text className="text-body text-content-secondary dark:text-content-dark-secondary text-center mt-2 mb-6">
              Seriously, great job. Every step counted.
            </Text>
            <Button title="Done" variant="primary" onPress={handleEndSession} />
          </View>
        ) : (
          <>
            {/* Current subtask — large and clear */}
            {currentSubtask && (
              <View className="w-full bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-xl p-5 mb-4">
                <Text className="text-small font-medium text-content-muted dark:text-content-dark-muted mb-1">
                  Current step
                </Text>
                {stuckLoading ? (
                  <LoadingSkeleton width="100%" height={28} />
                ) : (
                  <Text className="text-heading font-semibold text-content dark:text-content-dark-primary leading-7">
                    {currentSubtask.title}
                  </Text>
                )}
                <Text className="text-small text-content-muted dark:text-content-dark-muted mt-2">
                  ~{currentSubtask.estimatedMinutes} min
                </Text>

                {/* Complete current step */}
                <Pressable
                  onPress={() => handleToggleSubtask(currentSubtask.id)}
                  className="mt-4 min-h-[52px] flex-row items-center justify-center bg-success/10 dark:bg-success/20 border border-success/30 rounded-lg"
                  accessibilityRole="button"
                  accessibilityLabel="Mark step as done"
                >
                  <Ionicons name="checkmark-circle" size={20} className="text-success" />
                  <Text className="text-body font-semibold text-success ml-2">
                    Done with this step
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Remaining subtasks */}
            {subtasks.filter((s) => !s.isComplete && s.id !== currentSubtask?.id).length > 0 && (
              <View className="w-full mb-4">
                <Text className="text-caption font-medium text-content-muted dark:text-content-dark-muted mb-2">
                  Coming up
                </Text>
                {subtasks
                  .filter((s) => !s.isComplete && s.id !== currentSubtask?.id)
                  .map((s) => (
                    <SubtaskRow
                      key={s.id}
                      title={s.title}
                      durationMinutes={s.estimatedMinutes}
                      completed={false}
                      onToggle={() => handleToggleSubtask(s.id)}
                    />
                  ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom action buttons — always accessible */}
      {!allDone && (
        <View
          className="px-5 pt-3 bg-surface dark:bg-surface-dark border-t border-border/50 dark:border-border-dark/50"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <View className="flex-row gap-3">
            {/* I'm stuck — AI stub */}
            <Pressable
              onPress={handleStuck}
              className="flex-1 min-h-[48px] flex-row items-center justify-center bg-accent-light dark:bg-accent/10 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="I'm stuck"
              accessibilityHint="AI will simplify the current step"
            >
              <Ionicons name="sparkles-outline" size={18} className="text-accent dark:text-accent" />
              <Text className="text-caption font-semibold text-accent-dark dark:text-accent ml-1.5">
                I'm stuck
              </Text>
            </Pressable>

            {/* Take a break */}
            <Pressable
              onPress={() => setShowBreak(true)}
              className="flex-1 min-h-[48px] flex-row items-center justify-center bg-surface-elevated dark:bg-surface-dark-elevated rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="Take a break"
            >
              <Ionicons name="cafe-outline" size={18} className="text-content-secondary dark:text-content-dark-secondary" />
              <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary ml-1.5">
                Take a break
              </Text>
            </Pressable>

            {/* I feel overwhelmed */}
            <Pressable
              onPress={() => setShowBreak(true)}
              className="flex-1 min-h-[48px] flex-row items-center justify-center bg-surface-elevated dark:bg-surface-dark-elevated rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="I feel overwhelmed"
            >
              <Ionicons name="heart-outline" size={18} className="text-content-secondary dark:text-content-dark-secondary" />
              <Text className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary ml-1.5">
                Overwhelmed
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <BreakModal visible={showBreak} onClose={() => setShowBreak(false)} />
    </View>
  );
}
