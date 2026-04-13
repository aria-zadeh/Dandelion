/**
 * Focal Design Tokens
 * Warm, calm palette for ADHD-friendly UX.
 * All colors defined here — never hardcode values in components.
 */

export const colors = {
  light: {
    primary: "hsl(35, 85%, 55%)",
    primaryLight: "hsl(35, 85%, 70%)",
    primaryDark: "hsl(35, 85%, 45%)",
    primaryForeground: "hsl(30, 10%, 10%)",

    background: "hsl(40, 33%, 98%)",
    card: "hsl(35, 40%, 97%)",
    elevated: "hsl(35, 35%, 95%)",

    text: "hsl(30, 10%, 15%)",
    textSecondary: "hsl(30, 8%, 45%)",
    textMuted: "hsl(30, 6%, 60%)",

    success: "hsl(145, 55%, 48%)",
    successLight: "hsl(145, 55%, 92%)",
    warning: "hsl(38, 90%, 55%)",
    warningLight: "hsl(38, 90%, 92%)",
    danger: "hsl(0, 70%, 58%)",
    dangerLight: "hsl(0, 70%, 93%)",

    border: "hsl(30, 15%, 90%)",
    accent: "hsl(33, 74%, 62%)",
    accentLight: "hsl(33, 74%, 90%)",
  },
  dark: {
    primary: "hsl(35, 85%, 60%)",
    primaryLight: "hsl(35, 85%, 70%)",
    primaryDark: "hsl(35, 85%, 50%)",
    primaryForeground: "hsl(25, 15%, 10%)",

    background: "hsl(25, 15%, 10%)",
    card: "hsl(25, 12%, 14%)",
    elevated: "hsl(25, 10%, 18%)",

    text: "hsl(35, 20%, 95%)",
    textSecondary: "hsl(30, 10%, 65%)",
    textMuted: "hsl(30, 8%, 45%)",

    success: "hsl(145, 55%, 48%)",
    successLight: "hsl(145, 40%, 18%)",
    warning: "hsl(38, 90%, 55%)",
    warningLight: "hsl(38, 60%, 18%)",
    danger: "hsl(0, 70%, 58%)",
    dangerLight: "hsl(0, 50%, 18%)",

    border: "hsl(25, 10%, 20%)",
    accent: "hsl(33, 74%, 62%)",
    accentLight: "hsl(33, 40%, 18%)",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
  "5xl": 64,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: "700" as const },
  title: { fontSize: 24, lineHeight: 32, fontWeight: "600" as const },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  small: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
} as const;

export const shadows = {
  sm: {
    shadowColor: "hsl(30, 20%, 30%)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "hsl(30, 20%, 30%)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "hsl(30, 20%, 30%)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

/** Minimum touch target size per WCAG / Apple HIG */
export const TOUCH_TARGET_MIN = 44;
/** Preferred touch target for primary actions */
export const TOUCH_TARGET_PRIMARY = 52;
/** Minimum button height */
export const BUTTON_MIN_HEIGHT = 56;

export const urgency = {
  /** >48 hours — no urgency */
  none: { color: "text-content-secondary", icon: "time-outline" as const },
  /** 12-48 hours — amber warning */
  soon: { color: "text-warning", icon: "alert-circle-outline" as const },
  /** <12 hours — red urgent */
  urgent: { color: "text-danger", icon: "warning-outline" as const },
} as const;
