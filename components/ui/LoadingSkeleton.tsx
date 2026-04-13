import React, { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface LoadingSkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
}

export function LoadingSkeleton({
  width,
  height,
  borderRadius = 8,
}: LoadingSkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="bg-surface-elevated dark:bg-surface-dark-elevated"
      style={[{ width: width as any, height, borderRadius }, animatedStyle]}
      accessibilityLabel="Loading content"
    />
  );
}
