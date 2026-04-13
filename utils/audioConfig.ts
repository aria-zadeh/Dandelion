import type { FocusAudio } from "@/types";

export interface AudioOption {
  type: FocusAudio;
  label: string;
  icon: string;
  /**
   * URI for the ambient sound. Publicly-hosted royalty-free MP3s from Wikimedia Commons.
   * White noise: CC BY-SA 3.0 (HiRes9, upload.wikimedia.org)
   * Brown noise: Public domain (Kieff, upload.wikimedia.org)
   * Rain: CC BY-SA 3.0 (Effib, upload.wikimedia.org)
   * Cafe: Public domain (stephan / PDsounds.org, upload.wikimedia.org)
   * Set to null to silently skip playback.
   */
  uri: string | null;
}

export const AUDIO_OPTIONS: AudioOption[] = [
  {
    type: "white_noise",
    label: "White",
    icon: "volume-high-outline",
    uri: "https://upload.wikimedia.org/wikipedia/commons/transcoded/9/98/White-noise-sound-20sec-mono-44100Hz.ogg/White-noise-sound-20sec-mono-44100Hz.ogg.mp3",
  },
  {
    type: "brown_noise",
    label: "Brown",
    icon: "volume-medium-outline",
    uri: "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c9/Brownnoise.ogg/Brownnoise.ogg.mp3",
  },
  {
    type: "rain",
    label: "Rain",
    icon: "rainy-outline",
    uri: "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8a/Sound_of_rain.ogg/Sound_of_rain.ogg.mp3",
  },
  {
    type: "cafe",
    label: "Cafe",
    icon: "cafe-outline",
    uri: "https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b5/Restaurant_ambience.ogg/Restaurant_ambience.ogg.mp3",
  },
];

/** All options including "none" — used for the picker row */
export const AUDIO_PICKER_OPTIONS: (AudioOption | { type: "none"; label: string; icon: string })[] =
  [
    ...AUDIO_OPTIONS,
    { type: "none" as const, label: "Off", icon: "volume-mute-outline" },
  ];

export function getAudioOption(type: FocusAudio): AudioOption | null {
  return AUDIO_OPTIONS.find((o) => o.type === type) ?? null;
}
