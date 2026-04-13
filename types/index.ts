/** All Focal data models — from PRD section 5 */

export type Difficulty = "low" | "medium" | "high";
export type TaskSource = "manual" | "ai_extracted";
export type TaskStatus = "not_started" | "in_progress" | "complete";
export type ScheduleStatus = "unscheduled" | "proposed" | "confirmed" | "completed_on_time" | "rescheduled";
export type BreakTrigger = "manual" | "timer";
export type FocusAudio = "white_noise" | "brown_noise" | "rain" | "cafe" | "none";

export interface Task {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  dueDate: string; // ISO 8601
  startTime: string | undefined; // ISO 8601 timestamp, user-confirmed — enables Type A calendar blocks
  proposedTime: string | undefined; // ISO 8601 timestamp, algorithm-suggested (dashed block, pending confirm)
  durationMinutes: number | null; // manual override if no AI breakdown; else sum of subtasks
  isAbstract: boolean;
  difficulty: Difficulty;
  source: TaskSource;
  externalId: string | null;
  subtasks: Subtask[];
  starterAction: string;
  status: TaskStatus;
  scheduleStatus: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  parentTaskId: string;
  title: string;
  estimatedMinutes: number;
  isComplete: boolean;
  order: number;
}

export interface FocusSession {
  id: string;
  taskId: string;
  subtaskId: string | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  breaksTaken: number;
  completedSubtasks: string[];
}

export interface BreakEvent {
  id: string;
  sessionId: string;
  triggeredAt: string;
  trigger: BreakTrigger;
  breakTaken: boolean;
  breakDurationSeconds: number | null;
}

export interface ProductivityWindow {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startHour: number;
  endHour: number;
  confidenceScore: number;
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type PeriodKey = "morning" | "afternoon" | "evening";

/** A single block of time the user marked as busy (feeds the Phase 4 scheduler) */
export interface BusyBlock {
  day: DayKey;
  period: PeriodKey;
}

/** A one-off busy event the user adds (e.g. "Soccer 6-7pm Wed") */
export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date string (YYYY-MM-DD)
  startTime: string; // "HH:MM" 24h
  endTime: string; // "HH:MM" 24h
  createdAt: string; // ISO 8601
}

/** Tracks whether a user completed a task at a scheduled time — feeds the scheduling algorithm */
export interface SchedulingSignal {
  id: string;
  taskId: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hourOfDay: number;
  outcome: "completed" | "skipped" | "partial";
  actualDurationMinutes: number | null;
  recordedAt: string; // ISO 8601
}

export interface UserSettings {
  /** User's display name, collected after first login. Shown in Profile tab. */
  displayName: string | null;
  maxNotificationsPerHour: number;
  focusAudio: FocusAudio;
  pomodoroEnabled: boolean;
  pomodoroWorkMinutes: number;
  pomodoroBreakMinutes: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  onboardingComplete: boolean;
  energyPeakStart: number;
  energyPeakEnd: number;
  busyBlocks: BusyBlock[];
  /** Free-text extras from the availability screen (e.g. "swim practice Tues 4-6") */
  availabilityNotes: string;
  /** One-off busy events added by user */
  calendarEvents: CalendarEvent[];
  /** Auto-confirm algorithm-proposed schedule after 24h */
  autoAcceptProposedSchedule: boolean;
  /** Theme mode: light, dark, or system (follows device) */
  themePreference: "light" | "dark" | "system";
  /** Web Push subscription JSON for background notifications (web only) */
  webPushSubscription?: string | null;
}

export interface CompletionRecord {
  taskId: string;
  subtaskId: string | null;
  completedAt: string;
  hourOfDay: number;
}

/** Helper to compute urgency level from a due date */
export function getUrgencyLevel(dueDate: string): "none" | "soon" | "urgent" {
  const hoursUntil =
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < 12) return "urgent";
  if (hoursUntil < 48) return "soon";
  return "none";
}

/** Generate a UUID-like string */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
