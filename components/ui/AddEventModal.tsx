import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";

interface AddEventModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (event: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => void;
}

export function AddEventModal({ visible, onClose, onAdd }: AddEventModalProps) {
  const insets = useSafeAreaInsets();
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");

  const handleAdd = () => {
    if (!newDate || !newStartTime || !newEndTime) return;
    onAdd({
      title: newTitle.trim() || "Busy",
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
    });
    onClose();
    setNewTitle("");
    setNewDate("");
    setNewStartTime("");
    setNewEndTime("");
  };

  const handleClose = () => {
    onClose();
    setNewTitle("");
    setNewDate("");
    setNewStartTime("");
    setNewEndTime("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="bg-surface dark:bg-surface-dark rounded-t-3xl px-6 pt-6"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-heading font-bold text-content dark:text-content-dark-primary">
              Add Event
            </Text>
            <Pressable
              onPress={handleClose}
              className="min-w-[44px] min-h-[44px] items-center justify-center"
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons
                name="close"
                size={24}
                className="text-content-secondary dark:text-content-dark-secondary"
              />
            </Pressable>
          </View>

          {/* Title */}
          <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1.5">
            Title (optional)
          </Text>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="e.g. Soccer practice"
            placeholderTextColor="hsl(30, 6%, 60%)"
            className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3 text-body text-content dark:text-content-dark-primary mb-4"
            accessibilityLabel="Event title"
          />

          {/* Date */}
          <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1.5">
            Date
          </Text>
          {Platform.OS === "web" ? (
            <View className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3 mb-4 min-h-[44px] justify-center">
              <input
                type="date"
                value={newDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewDate(e.target.value)
                }
                style={{
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  fontSize: 16,
                  fontFamily: "inherit",
                  width: "100%",
                  outline: "none",
                  colorScheme: "dark",
                }}
                aria-label="Event date"
              />
            </View>
          ) : (
            <TextInput
              value={newDate}
              onChangeText={setNewDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="hsl(30, 6%, 60%)"
              className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3 text-body text-content dark:text-content-dark-primary mb-4"
              accessibilityLabel="Event date"
            />
          )}

          {/* Time row */}
          <View className="flex-row gap-3 mb-6">
            <View className="flex-1">
              <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1.5">
                Start time
              </Text>
              {Platform.OS === "web" ? (
                <View className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3 min-h-[44px] justify-center">
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewStartTime(e.target.value)
                    }
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      fontSize: 16,
                      fontFamily: "inherit",
                      width: "100%",
                      outline: "none",
                      colorScheme: "dark",
                    }}
                    aria-label="Start time"
                  />
                </View>
              ) : (
                <TextInput
                  value={newStartTime}
                  onChangeText={setNewStartTime}
                  placeholder="HH:MM"
                  placeholderTextColor="hsl(30, 6%, 60%)"
                  className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3 text-body text-content dark:text-content-dark-primary"
                  accessibilityLabel="Start time"
                />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-caption font-medium text-content-secondary dark:text-content-dark-secondary mb-1.5">
                End time
              </Text>
              {Platform.OS === "web" ? (
                <View className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3 min-h-[44px] justify-center">
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewEndTime(e.target.value)
                    }
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      fontSize: 16,
                      fontFamily: "inherit",
                      width: "100%",
                      outline: "none",
                      colorScheme: "dark",
                    }}
                    aria-label="End time"
                  />
                </View>
              ) : (
                <TextInput
                  value={newEndTime}
                  onChangeText={setNewEndTime}
                  placeholder="HH:MM"
                  placeholderTextColor="hsl(30, 6%, 60%)"
                  className="bg-surface-card dark:bg-surface-dark-card border border-border dark:border-border-dark rounded-lg px-4 py-3 text-body text-content dark:text-content-dark-primary"
                  accessibilityLabel="End time"
                />
              )}
            </View>
          </View>

          <Button
            title="Add Event"
            variant="primary"
            onPress={handleAdd}
            accessibilityLabel="Save event"
          />
        </View>
      </View>
    </Modal>
  );
}
