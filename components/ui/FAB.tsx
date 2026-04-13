import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FABProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function FAB({ onPress, icon = "add" }: FABProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.88, { damping: 12, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 8, stiffness: 180 });
      }}
      className="absolute bottom-6 right-5 w-[60px] h-[60px] rounded-full bg-primary items-center justify-center shadow-lg"
      accessibilityRole="button"
      accessibilityLabel="Add new task"
      accessibilityHint="Opens the new task form"
      style={[
        {
          position: "absolute" as const,
          bottom: 24,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: "hsl(35, 85%, 55%)",
          alignItems: "center" as const,
          justifyContent: "center" as const,
          zIndex: 50,
          shadowColor: "hsl(35, 85%, 35%)",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
        },
        animatedStyle,
      ]}
    >
      <Ionicons name={icon} size={28} color="hsl(30, 10%, 10%)" />
    </AnimatedPressable>
  );
}
