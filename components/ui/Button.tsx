import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
} from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends Omit<PressableProps, "children"> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, { base: string; text: string }> = {
  primary: {
    base: "bg-primary active:bg-primary-dark",
    text: "text-primary-foreground font-semibold",
  },
  secondary: {
    base: "bg-surface-elevated dark:bg-surface-dark-elevated border border-border dark:border-border-dark active:bg-surface-card",
    text: "text-content dark:text-content-dark-primary font-semibold",
  },
  ghost: {
    base: "bg-transparent active:bg-surface-elevated dark:active:bg-surface-dark-elevated",
    text: "text-content dark:text-content-dark-primary font-medium",
  },
  danger: {
    base: "bg-danger active:bg-danger-dark",
    text: "text-white font-semibold",
  },
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  disabled,
  icon,
  ...props
}: ButtonProps) {
  const styles = variantClasses[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      className={`min-h-[56px] flex-row items-center justify-center rounded-lg px-6 py-3
        ${styles.base}
        ${isDisabled ? "opacity-50" : ""}
      `}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={props.accessibilityLabel || title}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "danger" ? "#fff" : undefined}
          className="mr-2"
        />
      ) : icon ? (
        <>{icon}</>
      ) : null}
      <Text className={`text-body ${styles.text} ${icon || loading ? "ml-2" : ""}`}>
        {title}
      </Text>
    </Pressable>
  );
}
