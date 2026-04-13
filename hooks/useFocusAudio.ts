/**
 * useFocusAudio — manages ambient audio during a focus session.
 *
 * Lifecycle:
 *  - select(type): stop current → load new → play (looping)
 *  - pause(): pause without unloading (used on break)
 *  - resume(): resume paused sound
 *  - setVolume(0–1): live volume update
 *  - cleanup: sound is unloaded on unmount via useEffect return
 *
 * Graceful degradation: if uri is null or Audio fails, we silently no-op.
 */
import { useEffect, useRef, useCallback } from "react";
import { Audio } from "expo-av";
import type { FocusAudio } from "@/types";
import { getAudioOption } from "@/utils/audioConfig";

export function useFocusAudio() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const volumeRef = useRef<number>(0.7);
  const isPlayingRef = useRef<boolean>(false);

  // Configure audio session on mount
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {
      // Non-fatal — continue without audio mode config
    });

    return () => {
      // Cleanup on unmount
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  const _unloadCurrent = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {
        // ignore
      }
      soundRef.current = null;
      isPlayingRef.current = false;
    }
  }, []);

  const select = useCallback(
    async (type: FocusAudio) => {
      await _unloadCurrent();

      if (type === "none") return;

      const option = getAudioOption(type);
      if (!option?.uri) {
        // URI not yet set — infrastructure is wired, no audio plays
        return;
      }

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: option.uri },
          {
            shouldPlay: true,
            isLooping: true,
            volume: volumeRef.current,
          }
        );
        soundRef.current = sound;
        isPlayingRef.current = true;
      } catch {
        // Audio load failure — silently skip, no crash/error shown to user
        soundRef.current = null;
      }
    },
    [_unloadCurrent]
  );

  const pause = useCallback(async () => {
    if (soundRef.current && isPlayingRef.current) {
      try {
        await soundRef.current.pauseAsync();
        isPlayingRef.current = false;
      } catch {
        // ignore
      }
    }
  }, []);

  const resume = useCallback(async () => {
    if (soundRef.current && !isPlayingRef.current) {
      try {
        await soundRef.current.playAsync();
        isPlayingRef.current = true;
      } catch {
        // ignore
      }
    }
  }, []);

  const stop = useCallback(async () => {
    await _unloadCurrent();
  }, [_unloadCurrent]);

  const setVolume = useCallback(async (volume: number) => {
    volumeRef.current = volume;
    if (soundRef.current) {
      try {
        await soundRef.current.setVolumeAsync(volume);
      } catch {
        // ignore
      }
    }
  }, []);

  return { select, pause, resume, stop, setVolume };
}
