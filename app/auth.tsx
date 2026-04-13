/**
 * Auth screen — magic link sign-in
 * PRD §8.2
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { signInWithMagicLink } from "@/services/supabase";
import { useSettingsStore } from "@/store/settingsStore";

type ScreenState = "idle" | "loading" | "success" | "error";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [screenState, setScreenState] = useState<ScreenState>("idle");
  const router = useRouter();
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);

  const isValidEmail = email.includes("@") && email.includes(".");

  async function handleSend() {
    if (!isValidEmail || screenState === "loading") return;

    setScreenState("loading");
    const { error } = await signInWithMagicLink(email.trim().toLowerCase());

    if (error) {
      setScreenState("error");
    } else {
      setScreenState("success");
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-surface dark:bg-surface-dark"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center"
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-8 py-12">
          {/* ── Brand block ── */}
          <View className="items-center mb-12">
            <Ionicons
              name="aperture-outline"
              size={64}
              color="hsl(35, 85%, 55%)"
              accessibilityLabel="Focal app icon"
            />
            <Text
              className="text-display font-bold text-content dark:text-content-dark-primary mt-4"
              accessibilityRole="header"
            >
              Focal
            </Text>
            <Text className="text-body text-content-secondary dark:text-content-dark-secondary mt-2 text-center">
              Built for brains that work differently
            </Text>
          </View>

          {/* ── Success state ── */}
          {screenState === "success" ? (
            <View
              className="bg-accent-light dark:bg-accent-dark rounded-xl p-6 items-center gap-3"
              accessibilityLiveRegion="polite"
            >
              <Ionicons
                name="mail-outline"
                size={40}
                color="hsl(33, 74%, 62%)"
                accessibilityLabel="Mail icon"
              />
              <Text className="text-body font-semibold text-content dark:text-content-dark-primary text-center">
                Check your email — link is on its way 📬
              </Text>
              <Text className="text-caption text-content-secondary dark:text-content-dark-secondary text-center">
                Tap the link in your inbox to sign in.
              </Text>
            </View>
          ) : (
            /* ── Form state ── */
            <View className="gap-4">
              {/* Email input */}
              <View>
                <Text
                  className="text-caption font-semibold text-content-secondary dark:text-content-dark-secondary mb-2 uppercase tracking-wide"
                  accessibilityLabel="Email address label"
                >
                  Email address
                </Text>
                <TextInput
                  className="min-h-[56px] bg-surface-elevated dark:bg-surface-dark-elevated border border-border dark:border-border-dark rounded-lg px-4 text-body text-content dark:text-content-dark-primary"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (screenState === "error") setScreenState("idle");
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor="hsl(30, 6%, 60%)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  accessibilityLabel="Email address input"
                  accessibilityHint="Enter your email address to receive a sign-in link"
                  editable={screenState !== "loading"}
                />
              </View>

              {/* Error message — warm, not alarming */}
              {screenState === "error" && (
                <Text
                  className="text-caption text-warning dark:text-warning text-center"
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                >
                  Hmm, something went wrong. Try again?
                </Text>
              )}

              {/* Submit button */}
              <Button
                title="Send me a sign-in link"
                variant="primary"
                loading={screenState === "loading"}
                disabled={!isValidEmail || screenState === "loading"}
                onPress={handleSend}
                accessibilityLabel="Send magic link to email"
                accessibilityHint="Sends a sign-in link to the email address you entered"
              />
            </View>
          )}

          {/* Developer testing mode */}
          {(
            <View className="mt-10 items-center">
              <Pressable
                onPress={() => {
                  // Set a global flag so _layout.tsx treats us as "authenticated"
                  // without a real Supabase session
                  (globalThis as Record<string, unknown>).__FOCAL_GUEST_MODE__ = true;
                  if (onboardingComplete) {
                    router.replace("/(tabs)");
                  } else {
                    router.replace("/onboarding/welcome");
                  }
                }}
                className="border border-border dark:border-border-dark rounded-lg px-5 py-3 min-h-[44px] items-center justify-center"
                accessibilityLabel="Enter guest mode"
                accessibilityRole="button"
              >
                <Text className="text-caption font-medium text-content-muted dark:text-content-dark-muted">
                  Guest Mode
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
