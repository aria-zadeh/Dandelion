# Product Requirements Document
## Focal — ADHD Task & Time Management App
### MIT CREATe Challenge | Team: Saketh Baddam, Aria Zadeh, Srihith Chennareddy, Shayan Mohammad-Rafiee
### Co-Designer: Garrett Bunin

---

## 1. Overview

### 1.1 Problem Statement
Students with ADHD face compounding barriers when managing schoolwork: difficulty initiating tasks, poor time estimation, deadline-driven panic, and inadequate tooling that doesn't account for executive function challenges. Existing productivity apps assume neurotypical focus patterns and overwhelm ADHD users with complexity or notification spam.

### 1.2 Vision
Focal is a mobile-first productivity app built for and with a student who has ADHD. It reduces friction at every stage of the task lifecycle — from remembering deadlines, to starting the first step, to managing time mid-task — using AI-generated task breakdowns, smart scheduling, and minimal, non-intrusive notifications.

### 1.3 Target User
- **Primary:** High school students diagnosed with ADHD
- **Co-Designer Profile (Garrett):**
  - Diagnosed ADHD; struggles with initiation, time management, and abstract tasks
  - Forgets deadlines; does work late at night driven by deadline pressure
  - Gets stressed/anxious when overwhelmed
  - Uses Schoology partially; finds constant notifications annoying
  - Feels most energetic midday; struggles most with essays and large open-ended projects
  - Math packets (structured) are manageable; essays and research (abstract) are hardest

### 1.4 Platform
- **Framework:** React Native with Expo (SDK 54)
- **Target Platforms:** iOS and Android
- **Minimum OS:** iOS 16+, Android 10+

---

## 2. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Reduce missed deadlines | User misses ≤1 deadline/month after 2 weeks of use |
| Reduce task initiation time | User starts tasks within 30 min of first reminder |
| Reduce perceived stress | Self-reported stress score decreases over 2 weeks |
| Keep notifications non-intrusive | User does not disable notifications within first week |
| Increase task completion rate | ≥70% of created tasks marked complete before deadline |

---

## 3. Core Features

### 3.1 Feature List (Priority Ordered)

| Priority | Feature | Description |
|---|---|---|
| P0 | AI Task Breakdown | Break any task into timed subtasks via Gemini 2.5 Flash |
| P0 | Due Date Tracking | Manual task entry with deadline extraction |
| P0 | Smart Notifications | Rate-limited, context-aware reminders (native + web push) |
| P0 | Focus Session Mode | Distraction-reduced timer with break system |
| P0 | Web Platform Compatibility | All features work on dandelion-cyan.vercel.app |
| P1 | Calendar Tab | Week + month view of tasks and scheduled sessions |
| P1 | Smart Scheduling Algorithm | Auto-place task blocks around busy times; learn from completion history |
| P1 | One-Off Calendar Events | User-added busy events that block scheduling (e.g. "soccer 6–7pm Wed") |
| P1 | Productivity Time Analysis | Identify peak productivity windows from past completions |
| P1 | Availability Settings | Edit busy blocks in Settings (not onboarding-only) |
| P2 | Motivation Nudges | Context-sensitive starter prompts |
| P2 | Weekly Planning Screen | Paste syllabus/schedule → AI date extraction |
| ~V2~ | ~Google Calendar Integration~ | ~REMOVED — users manage busy times in-app~ |

---

## 4. Detailed Feature Specifications

---

### 4.1 Task Entry & Due Date Management

#### 4.1.1 Task Entry (New Task Screen)
- Users type a task name (required) and optional description
- Users can paste full assignment text; the app uses AI to extract due dates and details
- A due date picker lets users set a deadline (currently preset options; full date picker in Phase 3)
- "Break it down" button calls the Gemini backend to generate subtasks
- AI breakdown results are displayed before saving; user can confirm, edit, or delete subtasks
- Saving creates a `Task` object persisted to AsyncStorage via Zustand

#### 4.1.2 Deadline Extraction (AI)
- On text paste, call the `/ai/extract-dates` backend endpoint with the pasted text
- The AI returns an array of `{ title, dueDate, subject }` objects
- Extracted tasks are shown in a review state before being added
- UI affordance for this flow (paste-a-syllabus) is planned for Phase 3

#### 4.1.3 Schoology Integration — REMOVED
Schoology integration has been dropped from scope. Garrett's school district approval requirements make this impractical.

#### 4.1.4 Google Calendar Integration — REMOVED
Removed from scope. Users manage busy times and calendar events directly in the app.

---

### 4.2 AI Task Breakdown Engine

#### 4.2.1 Subtask Generation Rules
- For any task with a deadline **more than 24 hours away:**
  - Generate 1–3 starting subtasks that each take **≤10 minutes**
  - Generate larger subtasks of **15–30 minutes** to complete the remainder
- For any task with a deadline **within 24 hours:**
  - Generate only short subtasks (5–10 minutes) with no large blocks
- The first subtask must always be a concrete, specific action (not "start the essay" — instead "write one sentence describing the main argument")
- Maximum 8 subtasks total

#### 4.2.2 Subtask Display
- Show subtasks as a vertical checklist under each parent task
- Each subtask has:
  - Title (AI-generated, editable by user)
  - Estimated duration (badge)
  - Completion checkbox
  - "Make easier" button that re-calls Gemini to simplify the step
- Parent task shows a progress bar as subtasks are completed

#### 4.2.3 AI Starter Action
- For every task, generate a **single starter action** that takes 2–5 minutes
- Displayed as the `StarterActionCard` on the Home screen and Task Detail screen
- Example: "Open a new doc and type the title of your essay"
- Tap to mark done → immediately reveals the full subtask list

#### 4.2.4 Abstract Task Detection
- If a task title or description contains keywords like "essay," "research," "analyze," "write," "project," "presentation" → flag as abstract
- Abstract tasks get more aggressive breaking down (more subtasks, shorter durations)
- Abstract tasks surface a tooltip: "This one's big — let's break it down together"

#### 4.2.5 AI Fallback Behavior
- On API error or quota exhaustion, fall back to a generic 4-subtask template:
  - "Read the assignment prompt"
  - "Write an outline"
  - "Draft the first section"
  - "Review and edit"
- A subtle, warm banner informs the user that generic steps are being shown (not task-specific)
- Fallback results are NOT cached — a retry can succeed if quota replenishes
- Successful AI results are cached in AsyncStorage keyed by `(title, dueDate)` to avoid re-burning quota

---

### 4.3 Smart Notification System

#### 4.3.1 Notification Rate Limits
- **Default:** Maximum 1 notification per hour
- **Deadline < 12 hours:** Notifications may fire up to 1 per 30 minutes
- **Deadline < 2 hours:** Notifications fire every 20 minutes
- Never send more than 3 start reminders per day for a single task
- Respect OS Do Not Disturb settings; do not override system-level silencing

#### 4.3.2 Notification Types

| Type | Trigger | Content |
|---|---|---|
| Start Reminder | Task not started + user in productive time window | "Hey — [task] is due [date]. Want to do the first step? It takes 5 min." |
| Deadline Approaching | Deadline < 12 hours | "[Task] is due tomorrow. You've got this — start with [first subtask]." |
| Motivation Nudge | No interaction with task in 24 hours | "Haven't touched [task] in a day. Here's a small step to get going." |
| Completion Celebrate | All subtasks checked off | "You finished [task]! 🎉" |

#### 4.3.3 Notification Scheduling Logic
- On app open: compute all notifications for the next 7 days
- Schedule using `expo-notifications` with exact trigger times
- Cancel and reschedule all notifications when task data changes
- Do not send start reminders between 11pm–8am
- Avoid scheduling reminders during user's `busyBlocks` from availability onboarding

---

### 4.4 Productivity Time Analysis

#### 4.4.1 Activity Tracking
- Log timestamps when the user:
  - Opens the app
  - Marks subtasks complete
  - Starts a focus session
- After 7 days of data: compute average completion activity by hour-of-day
- Identify top 2–3 "productive windows" per day (e.g., 3pm–5pm)

#### 4.4.2 Adaptive Scheduling
- Schedule start reminders to fire at the beginning of the user's identified productive windows
- Display a "Your best time today: 3pm–5pm" chip on the Home screen
- For new users (< 7 days of data): default to 3pm–5pm weekdays and 11am–1pm weekends (based on Garrett's reported midday energy peak)

---

### 4.5 Break System (Manual)

#### 4.5.1 Manual Break Trigger
- A "Take a break" button is always visible during an active focus session
- An "I feel overwhelmed" button is also available — it is a **first-class action**, not hidden
- Both trigger the same break flow

#### 4.5.2 Break Screen
- Full-screen modal with:
  - Countdown timer (default 5 minutes, user adjustable)
  - One of three calming prompts (random): "Take 5 deep breaths," "Stand up and stretch," "Look away from the screen"
  - Skip button (available after 60 seconds)
- On break end: return to task with a fresh starter action displayed

---

### 4.6 Focus Session Mode

#### 4.6.1 Session Start
- User taps "Start" on any subtask to enter focus mode
- Focus mode is a distraction-reduced full-screen view showing:
  - Current subtask (large text)
  - Estimated time (countdown timer, optional)
  - Progress bar within parent task
  - "I'm stuck" button → calls Gemini to rephrase or simplify the subtask
  - "Take a break" button → triggers break flow
  - "I feel overwhelmed" button → same break flow

#### 4.6.2 Session Timer
- Optional Pomodoro-style timer (default: 25 min work / 5 min break)
- User can disable timer and work in open-ended mode
- Timer completion triggers a break prompt

#### 4.6.3 White Noise / Focus Audio
- Built-in ambient audio options: white noise, brown noise, rain, cafe
- Plays through device speaker or headphones during focus session
- Volume control within session view
- Audio implemented via `expo-av`

---

### 4.7 Home Screen & Navigation

#### 4.7.1 Home Screen Philosophy
The Home screen is not a dashboard. It shows **one task** with a `StarterActionCard` — the smallest possible action to reduce initiation friction. This is the core anxiety reducer.

#### 4.7.2 Home Screen Layout
- **Top:** Today's date, greeting, and productive window chip ("Your best time: 3pm–5pm")
- **Urgent strip:** Any tasks due within 24 hours (danger highlight)
- **Today's Focus card:** AI-recommended single task to work on today, shown as a `TaskCard` (with completion checkbox) + its `StarterActionCard` coaching prompt below
- **Up next:** Remaining tasks sorted by deadline, each with completion checkbox
- **Add a busy time:** Pressable row that opens an Add Event modal (same as Profile → Busy Times) to add one-off calendar events without leaving the Home tab
- **FAB:** Floating action button to add a new task in 2 taps
- **Empty state:** "You're all caught up" — an invitation, not an error

#### 4.7.3 Navigation Structure (5 Tabs)
```
Tab Bar:
├── Home          (Today's focus, urgent strip, StarterActionCard)
├── Tasks         (Full task list with segment filter: Overdue / Today / This Week / Later; completed section at bottom)
├── Calendar      (Week + month view of scheduled tasks and sessions)
├── Focus         (Start a focus session; recent session history)
└── Profile       (Insights chart + all settings merged — not a separate tab)
```

**Design rationale:**
- ADHD users need clear, distinct purposes per tab
- Each tab has ONE clear job
- Insights live inside Profile (weekly reflection, not daily action)
- Calendar is its own tab because time-based planning is distinct from task browsing

---

### 4.8 Calendar Tab

#### 4.8.1 View Modes
- Pill switcher at top toggles between **Week** (default) and **Month**
- Week view: Google-Calendar-style vertical time axis (7am–11pm), 7 day columns Mon–Sun
- Month view: standard calendar grid with a dot under any day that has tasks due or sessions scheduled; tapping a day switches to week view centered on that day

#### 4.8.2 Week View Layout — 3-Day Sliding Window
- **Shows 3 days** (today + next 2 days) by default — gives each day enough width to read task names
- Horizontal swipe/scroll to reveal earlier or later days (scrollable day strip)
- Each hour = 60px tall; total grid height = 16h × 60 = 960px
- Time labels fixed-column on left (40px wide)
- Day columns each = (screenWidth − 40 − padding) / 3 px (~100px on iPhone vs ~42px with 7 days)
- Sticky day header at top via `stickyHeaderIndices={[0]}`
- All-day row sits above the time grid, holds wider pills that can display full task titles
- Today's column: amber circle behind date number + subtle warm tint on column background
- Day header strip is swipeable: shows 7 days in a scrollable row, 3 are visible at once

#### 4.8.3 Task Block Types

**Type A — Timed task (explicit start time)**
- Colored block at correct vertical offset: `top = (startHour − 7) × 60 + (startMinute / 60) × 60`
- Height = `max(durationMinutes / 60 × 60, 30px)`
- Title truncated to 1 line, 10px font
- Color: amber/gold (primary palette)

**Type B — All-day / due-date-only**
- Slim pill in the all-day row above the grid
- Muted warm accent color, title truncated
- Never appears in the scrollable time grid

**Type C — AI-broken-down task (has subtasks)**
- Renders as a **single block** using the parent task's title — NOT individual subtask blocks
- Block spans the total duration of all subtasks (sum of `estimatedMinutes`)
- Displays a small "N steps" label below the title to indicate subtask count
- Styled identically to Type A (amber/gold, same border treatment)
- Tapping the block navigates to the task detail page where individual subtasks are listed
- This prevents calendar clutter when tasks are broken into 5-8 subtasks

#### 4.8.4 Busy Blocks
- Rendered from `settings.busyBlocks` (muted gray, zIndex below task blocks)
- Labeled "Busy" in small muted text
- Not tappable

#### 4.8.5 Interactions
- Tapping a block opens a bottom-sheet modal with full title, time, duration, and completion status
- Long-pressing an empty hour slot navigates to `/task/new` with date+time pre-filled via params

#### 4.8.6 Implementation Notes
- Week view is built manually with a vertical `ScrollView` + absolutely positioned blocks
- Month view uses `react-native-calendars` themed to the Dandelion warm palette
- Phase 3: wire real store data; Phase 2 used placeholder hardcoded data

---

### 4.8b Task Completion UX

#### 4.8b.1 Completed Tasks Section (Tasks Tab)
The Tasks tab splits into two zones:
- **Active tasks** — the current list (Overdue / Today / This Week / Later segments)
- **Completed tasks** — collapsible section at the bottom with:
  - Header row: "Completed" label + count badge (e.g., "Completed (7)") + collapse/expand chevron arrow
  - Collapsed by default — the user doesn't need to see finished work
  - When expanded, shows completed tasks in reverse-completion order (most recent first)
  - Each completed task shows strikethrough title, completion date, and a subtle "Undo" button

#### 4.8b.2 Marking a Task Complete
- Tap the checkbox on the task row → task animates down to the "Completed" section with a brief slide transition
- A toast/snackbar appears at the bottom: "Task completed! [Undo]" — visible for 5 seconds
- Tapping "Undo" immediately moves the task back to active and restores its previous status
- If the task had a `scheduleStatus`, it's preserved so re-opening doesn't lose schedule context

#### 4.8b.3 Delete Task (Web Fix)
- `Alert.alert()` does not work on web — the delete button currently fails silently on web
- Fix: use a custom confirmation modal (React Native `Modal` component) instead of `Alert.alert()`
- Shows: "Delete this task?" with "Cancel" and "Delete" buttons, same pattern as the Add Event modal

---

### 4.9 Smart Scheduling Algorithm

#### 4.9.1 Purpose
When a task is created (or when subtasks are generated), the algorithm **automatically** finds suitable time slots and places them in the calendar. Reduces cognitive overhead of "when should I do this?" for Garrett. The user can always drag to reschedule or dismiss.

#### 4.9.1b Auto-Scheduling Triggers
The scheduler runs automatically in these cases:
1. **Task created** — immediately after `addTask()`, call `proposeSchedule()` if no `startTime` set
2. **AI breakdown complete** — after subtasks are generated, schedule each subtask individually (if `durationMinutes` or `estimatedMinutes` known)
3. **Task rescheduled** — after "No" on post-schedule review, re-run for next available slot
4. **Daily recalculation** — on app open, re-evaluate unscheduled tasks against updated calendar state

#### 4.9.1c Subtask-Level Scheduling
When a task has subtasks:
- Each subtask is scheduled independently based on its `estimatedMinutes`
- Subtasks are scheduled in order (subtask 1 before subtask 2) but not necessarily back-to-back
- The parent task's `durationMinutes` is the sum of all subtask durations
- Calendar renders each subtask as its own block (Type C), allowing the user to move individual pieces
- User can drag any subtask block to reschedule it independently

#### 4.9.2 Inputs
- All existing tasks with `startTime` set (already-scheduled blocks)
- `settings.busyBlocks` — recurring busy periods (morning/afternoon/evening per day of week)
- `calendarEvents` — one-off user-added events (e.g. "soccer 6–7pm Wed Apr 16")
- Task `durationMinutes` — either sum of subtask `estimatedMinutes`, or the manually set value
- `settings.energyPeakStart/End` — user's self-reported focus window
- `SchedulingSignal` history — past outcomes (did/didn't complete at each scheduled slot)

#### 4.9.3 Slot Selection Algorithm
1. Enumerate candidate 15-min-aligned slots from now until the task's `dueDate`
2. Eliminate slots that overlap:
   - Any existing task block (accounting for `durationMinutes`)
   - Any recurring `busyBlock` period
   - Any one-off `CalendarEvent`
   - Quiet hours (default 11pm–8am)
3. Score remaining slots:
   - +2 if slot falls within `energyPeakStart`–`energyPeakEnd`
   - +1 if the same day+hour has ≥1 historical positive `SchedulingSignal` (past success)
   - −2 if the same day+hour has ≥2 historical negative signals (past failure)
   - −1 per hour past 8pm (late-night penalty)
4. Pick the highest-scoring slot with enough contiguous free minutes for the task duration
5. Write to `task.proposedTime` (not `startTime` — user must confirm first)

#### 4.9.4 User Confirmation
- Proposed slot shown in calendar as a "suggested" block (dashed border, amber tint, "Suggested" label)
- Tap to accept (→ sets `startTime`), tap and drag to move, or dismiss
- Auto-accepted if the user doesn't interact for 24 hours and slot is still free (configurable setting)

#### 4.9.5 Post-Schedule Completion Tracking
After a task's scheduled time has passed and it is not yet marked complete:
- A prompt appears on the Home screen card: "Did you work on **[task]** at [time]? → **Yes** / **No** / **Partially**"
- This prompt appears once and does not repeat
- **Yes:** Record positive `SchedulingSignal` for that day+hour; set `scheduleStatus = 'completed_on_time'`
- **No:** Record negative `SchedulingSignal`; run algorithm again to find next slot; set `scheduleStatus = 'rescheduled'`
- **Partially:** Positive signal + log shorter actual duration; reschedule remaining estimated time
- Minimum 3 signals per day+hour bucket before score modifier applies (cold-start protection)

#### 4.9.6 Learning & Adaptation
- `SchedulingSignal` rows stored in Supabase `scheduling_signals` table — persist across devices
- Algorithm reads signals for the past 30 days with linear weight decay (day 0 = 1.0, day 30 = 0.0)
- After 14+ days of data: observed completion patterns override energy peak preference

#### 4.9.7 "Best Time to Start" Smart Notifications
The app learns from the user's completion history and sends proactive notifications:
- **Trigger:** When a task has a `proposedTime` approaching (15 min before), send a push notification:
  > "You usually follow through at this time — start [task] now?"
- **Learning input:** `SchedulingSignal` history determines which day+hour slots have highest completion rates
- **Algorithm choice:** Uses the deterministic scoring algorithm in `services/scheduler.ts` (not AI/ML). Rationale: the scoring factors (energy peak + signal history + conflict avoidance) are sufficient for a cold-start-friendly scheduler; ML models (scikit-learn, etc.) require large datasets (hundreds of signals) that a new user won't have. The deterministic algorithm works from day 1 with sensible defaults and improves as signals accumulate.
- **Notification scheduling:** When `proposeSchedule()` runs, also schedule a local notification at `proposedTime - 15min` via `expo-notifications` (native) or Web Push (web)
- **If dismissed:** Record a negative signal; propose next best slot

#### 4.9.8 Manual Override
- User can tap any scheduled block in the calendar → opens task detail → can change start time
- User can drag-to-reschedule any block (existing feature)
- User can tap "Not now" on proposed time banner to dismiss scheduling
- User can toggle "Auto-schedule new tasks" in Settings (default: on)

---

### 4.10 Calendar Events (One-Off Busy Blocks)

#### 4.10.1 Purpose
Let the user add specific timed events that block scheduling — beyond the recurring weekly busy grid set at onboarding. Examples: "Soccer practice Wed 6–7pm", "Dentist Thu 2–3pm".

#### 4.10.2 Adding an Event
- Accessible from:
  1. Long-press on a calendar time slot → "Mark as Busy" option
  2. `Profile → Settings → Busy Times → Add Event`
- Fields: title (optional), date, start time, end time
- Saved as `CalendarEvent` in the settings store; synced to Supabase
- Past events (end time < now) are auto-archived after 24 hours

#### 4.10.3 Rendering in Calendar
- Shown as muted gray blocks (same visual language as recurring busy blocks)
- Labeled with event title or "Busy" if no title
- Tapping opens a small sheet: title, time range, Delete button

#### 4.10.4 Settings — Edit Busy Times
`Profile tab → Settings → Busy Times`:
- Weekly morning/afternoon/evening toggle grid (same as onboarding, always editable)
- List of upcoming one-off `CalendarEvent` items with edit/delete actions
- "Add event" button at the bottom

---

### 4.11 Web Platform Compatibility

The Vercel deployment (`dandelion-cyan.vercel.app`) is the primary demo surface for the MIT CREATe Challenge. All P0 features must work on web.

#### 4.11.1 Date & Time Picker (Web)
`@react-native-community/datetimepicker` is **native-only** and renders nothing on web.

**Fix:** Create `components/ui/WebDateTimePicker.tsx`. When `Platform.OS === 'web'`, render an HTML `<input type="date">` or `<input type="time">` element using React Native Web's style bridge. Style to match the Dandelion design system (amber border, dark background, correct font). Replace all `DateTimePicker` usages with a cross-platform wrapper that switches on platform.

#### 4.11.2 Push Notifications (Web)
`expo-notifications` does **not** work on web. Web push notifications require a separate stack.

**Architecture:**
1. **Service Worker** (`public/sw.js`) — registers with the browser, handles `push` events, displays OS-level notifications via `self.registration.showNotification()`
2. **Push subscription** — on app load (web), check permission; if granted, call `PushManager.subscribe()` with a VAPID public key. Store the `PushSubscription` JSON in Supabase `user_settings.web_push_subscription`
3. **Supabase Edge Function `send-web-push`** — holds the VAPID private key as a secret; accepts `{ userId, title, body, url }`; fetches the subscription from `user_settings`; calls the Web Push protocol to deliver
4. **Scheduler** — Supabase pg_cron job (runs every 15 min) checks tasks with upcoming deadlines and calls `send-web-push`

**VAPID keys:** Generated once via `npx web-push generate-vapid-keys`. Public key in `EXPO_PUBLIC_VAPID_PUBLIC_KEY`. Private key in Supabase secrets.

**Platform branch in `services/notifications.ts`:**
```
Platform.OS === 'web'
  → register service worker → PushManager.subscribe → save to Supabase
  → scheduling handled server-side by Edge Function + pg_cron
Platform.OS !== 'web'
  → expo-notifications (existing flow, unchanged)
```

#### 4.11.3 Known Web Limitations Summary

| Feature | Web Status | Fix |
|---|---|---|
| DateTimePicker | ❌ no-op | WebDateTimePicker component (HTML inputs) |
| expo-notifications | ❌ | Web Push API + service worker + Edge Function |
| expo-haptics | silent no-op | Acceptable |
| expo-av (audio) | ✅ (HTML5 audio) | Verify CORS on audio URIs |
| Calendar drag-to-reschedule | ❌ Reanimated limitation | Tap-to-reschedule modal on web (V1 acceptable) |
| expo-secure-store | localStorage fallback | Acceptable for tokens |
| AI features (JWT) | Broken — auth header not sent | Fix `getAuthHeader()` for web session |
| Magic link redirect | ✅ (detectSessionInUrl) | Already fixed |

---

## 5. Data Models

### 5.1 Task
```typescript
interface Task {
  id: string;                        // UUID
  title: string;
  subject: string | null;            // e.g. "English 2H"
  description: string | null;
  dueDate: Date;
  startTime: Date | null;            // explicit user-set start (Type A block)
  proposedTime: Date | null;         // algorithm-suggested time (dashed block, pending confirm)
  durationMinutes: number | null;    // manually set if no AI breakdown; else sum of subtasks
  isAbstract: boolean;               // AI-flagged
  difficulty: 'low' | 'medium' | 'high';
  source: 'manual' | 'ai_extracted';
  externalId: string | null;
  subtasks: Subtask[];
  starterAction: string;             // AI-generated
  status: 'not_started' | 'in_progress' | 'complete';
  scheduleStatus: 'unscheduled' | 'proposed' | 'confirmed' | 'completed_on_time' | 'rescheduled' | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2 Subtask
```typescript
interface Subtask {
  id: string;
  parentTaskId: string;
  title: string;
  estimatedMinutes: number;
  isComplete: boolean;
  order: number;
}
```

### 5.3 FocusSession
```typescript
interface FocusSession {
  id: string;
  taskId: string;
  subtaskId: string | null;
  startTime: Date;
  endTime: Date | null;
  durationMinutes: number | null;
  breaksTaken: number;
  completedSubtasks: string[];
}
```

### 5.4 BreakEvent
```typescript
interface BreakEvent {
  id: string;
  sessionId: string;
  triggeredAt: Date;
  trigger: 'manual' | 'timer';
  breakTaken: boolean;
  breakDurationSeconds: number | null;
}
```

### 5.5 ProductivityWindow
```typescript
interface ProductivityWindow {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0=Sun
  startHour: number;
  endHour: number;
  confidenceScore: number;  // 0–1, based on historical data
}
```

### 5.6 UserSettings
```typescript
type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type PeriodKey = 'morning' | 'afternoon' | 'evening';
interface BusyBlock { day: DayKey; period: PeriodKey; }

interface UserSettings {
  displayName: string | null;          // collected after first magic-link login; shown in Profile
  maxNotificationsPerHour: number;     // default: 1
  focusAudio: 'white_noise' | 'brown_noise' | 'rain' | 'cafe' | 'none';
  pomodoroEnabled: boolean;
  pomodoroWorkMinutes: number;         // default: 25
  pomodoroBreakMinutes: number;        // default: 5
  quietHoursStart: number;             // hour, default: 23
  quietHoursEnd: number;               // hour, default: 8
  onboardingComplete: boolean;
  energyPeakStart: number;             // hour, default: 15
  energyPeakEnd: number;               // hour, default: 17
  busyBlocks: BusyBlock[];             // recurring weekly busy periods (editable in Settings)
  availabilityNotes: string;           // free-text extras from onboarding
  calendarEvents: CalendarEvent[];     // one-off busy events added by user
  webPushSubscription: string | null;  // PushSubscription JSON for web push (web only)
  autoAcceptProposedSchedule: boolean; // default: true — auto-confirm after 24h
}
```

### 5.7 CalendarEvent
```typescript
interface CalendarEvent {
  id: string;          // UUID
  title: string;       // e.g. "Soccer practice"
  date: string;        // ISO date string
  startTime: string;   // "HH:MM" 24h
  endTime: string;     // "HH:MM" 24h
  createdAt: Date;
}
```

### 5.8 SchedulingSignal
```typescript
interface SchedulingSignal {
  id: string;
  userId: string;
  taskId: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0=Sun
  hourOfDay: number;                        // 0–23
  outcome: 'completed' | 'skipped' | 'partial';
  actualDurationMinutes: number | null;
  recordedAt: Date;
}
```

---

## 6. AI Integration

### 6.1 Model & Infrastructure
- **AI Provider:** Google Gemini 2.0 Flash (`gemini-2.0-flash` via the v1beta generateContent REST endpoint)
- **Auth:** Google Gemini API key, stored in `backend/.env` as `GEMINI_API_KEY` — **never committed to git**
- All AI calls are made server-side via a lightweight Express backend proxy to protect the API key
- The proxy strips markdown fences (` ```json `) before JSON parsing to handle Gemini's typical fenced output format

### 6.2 Backend Proxy

**Location:** `backend/server.js`

**Endpoints:**

| Endpoint | Purpose | Input | Output |
|---|---|---|---|
| `POST /ai/breakdown` | Generate subtasks for a task | `{ task: { title, subject, dueDate, difficulty } }` | `{ starterAction, subtasks: [{ title, estimatedMinutes }] }` |
| `POST /ai/simplify` | Rewrite a subtask as a simpler 2-min action | `{ subtask: { title } }` | `{ simplified }` |
| `POST /ai/extract-dates` | Extract tasks + dates from free text | `{ userInput }` | `[{ title, dueDate, subject }]` |

**Error handling:**
- On any failure (including 429 quota-exhausted), endpoints return `500 { error: "AI failed" }`
- Phase 3 improvement: differentiate 429 from other errors so the client can show "AI is resting, using generic steps" instead of silently falling back

### 6.3 AI Prompt Templates

#### Task Breakdown Prompt
```
You are a task planning assistant for a high school student with ADHD.

Given this task:
- Title: {task.title}
- Subject: {task.subject}
- Due: {task.dueDate}
- Hours until due: {hoursUntilDue}
- Difficulty: {task.difficulty}

Generate a JSON object with:
1. "starterAction": A single concrete action (2-5 min) to begin immediately. Be very specific.
2. "subtasks": Array of subtasks. Each has:
   - "title": specific, concrete action step
   - "estimatedMinutes": number
   If hoursUntilDue > 24: first 1-3 subtasks are ≤10 min, rest are 15-30 min.
   If hoursUntilDue ≤ 24: all subtasks are ≤10 min.
   Max 8 subtasks total.

Return only valid JSON. No preamble.
```

#### Due Date Extraction Prompt
```
Extract all tasks and due dates from the following text. Return a JSON array.
Each item: { "title": string, "dueDate": "ISO8601 or null", "subject": "string or null" }
Text: {userInput}
Return only valid JSON. No preamble.
```

#### Simplify Subtask Prompt
```
A high school student with ADHD is stuck on this step:
"{subtask.title}"

Rewrite it as a simpler, more concrete action they can do in 2 minutes or less.
Return only the new step as plain text. No preamble.
```

### 6.4 Client-Side AI Handling (`services/ai.ts`)

- Pattern: **check AsyncStorage cache → fetch backend → cache result → fall back on error**
- `breakdownTask({ title, subject, dueDate, difficulty })` → cache key: `ai-breakdown-${title}-${dueDate}`
- `simplifySubtask(subtaskId, subtaskTitle)` → cache key: `ai-simplify-${subtaskId}`
- `extractDates(userInput)` → returns `[]` on error; not yet wired to UI (Phase 3)
- All functions backed by `API_BASE = "http://localhost:3000"` (configurable for production)
- Failures are NOT cached — a retry can succeed when quota replenishes
- A `fromFallback` flag is returned so the UI can show a warm "using generic steps" banner when appropriate

### 6.5 AI Wiring in Screens

| File | AI Feature | Status |
|---|---|---|
| `app/task/new.tsx` | `handleBreakdown` calls `breakdownTask()` | ✅ Wired (Phase 2) |
| `app/task/[id].tsx` | `handleMakeEasier` calls `simplifySubtask()` | ✅ Wired (Phase 2) |
| `app/focus/session.tsx` | `handleStuck` calls `simplifySubtask()` for current subtask | ✅ Wired (Phase 2) |
| `app/task/new.tsx` | Paste text → `extractDates()` | 🔲 Phase 3 |

---

## 7. Tech Stack

### 7.1 Frontend
| Layer | Choice | Reason |
|---|---|---|
| Framework | React Native + Expo SDK 54 | Cross-platform, fast iteration |
| Navigation | Expo Router (file-based) | Clean, typed navigation |
| State Management | Zustand (v5) | Lightweight, no boilerplate |
| Local Cache | AsyncStorage | Offline task data, AI result cache |
| Secure Storage | expo-secure-store | API keys, auth tokens |
| Notifications | expo-notifications | Scheduled + local push |
| Audio | expo-av | White noise playback |
| Auth (OAuth) | expo-auth-session | Google Calendar OAuth |
| Animations | react-native-reanimated + react-native-gesture-handler | Smooth UI |
| Styling | NativeWind v4 (TailwindCSS v3) | Design system tokens |
| Icons | @expo/vector-icons (Ionicons) | Cross-platform icons |
| Calendar UI | react-native-calendars | Month view grid |
| Supabase Client | @supabase/supabase-js | Auth + database sync |

### 7.2 Backend & Database
| Layer | Choice | Reason |
|---|---|---|
| Database | Supabase (Postgres) | Free tier, generous limits, dashboard, JS SDK |
| Auth | Supabase Auth — Magic Link (passwordless email) | No password for Garrett to forget; one tap sign-in |
| AI Proxy | Supabase Edge Functions | Same infrastructure as DB/auth; no separate server to manage |
| Current interim | Express server (`backend/server.js`) on Railway/Render | In place since Phase 2; migrate to Edge Functions in Phase 3 |

### 7.3 External APIs
| API | Purpose | Auth Method |
|---|---|---|
| Google Gemini API (2.5 Flash) | Task breakdown, date extraction, subtask simplification | API key (Supabase Edge Function secrets only) |
| Supabase API | Database read/write, auth, Edge Functions | Project URL + anon key (public) + service role key (server only) |
| Web Push API (browser) | Web push notifications | VAPID key pair (public in env, private in Supabase secrets) |
| Google Calendar API | Import/export events (V2, deferred) | OAuth 2.0 via expo-auth-session |

---

## 8. Authentication & User Data

### 8.1 Auth Strategy

**Method:** Supabase Auth with **Magic Link (passwordless email)**

Garrett enters his email once on first launch. Supabase sends a one-tap sign-in link to his inbox — no password to create or remember. Tapping the link opens the app and establishes a session. Sessions are long-lived and automatically refreshed; Garrett should never need to re-authenticate in normal use.

**Why magic link:**
- ADHD users forget passwords. Eliminating passwords removes a real friction point.
- No sign-up form — just an email field.
- Works on iOS and Android via Expo's deep link handling.

### 8.2 Auth Flow (Screens)

```
First launch (no session):
└── Auth screen
    ├── App logo + "Built for brains that work differently"
    ├── Email input field
    ├── "Send me a sign-in link" button
    └── Loading state → "Check your email — link is on its way"

On magic link tap (deep link):
└── Supabase client exchanges token → session established
    └── Name collection screen (first time only):
        ├── "What should we call you?" (single text input, required)
        ├── Saved to user_settings.display_name in Supabase
        └── Redirect to onboarding (first time) OR Home (returning user with session)

Returning user (valid session in expo-secure-store):
└── Skip auth screen entirely → straight to Home
```

### 8.3 User Data Architecture

Every piece of user data in Supabase is tagged with `user_id` (the Supabase Auth UUID). Row-Level Security (RLS) policies ensure users can only read and write their own data.

**Storage split:**

| Data | Where | Why |
|---|---|---|
| Tasks, subtasks | Supabase (primary) + AsyncStorage (cache) | Cloud = survives reinstall; local cache = offline + instant load |
| Focus sessions | Supabase | Needed for productivity window analysis across time |
| Productivity windows | Supabase | Computed from historical sessions; must persist |
| User settings | Supabase (primary) + AsyncStorage (cache) | Survive reinstall; sync across devices |
| AI breakdown results | AsyncStorage only | Ephemeral cache; not worth syncing |
| Auth token | expo-secure-store | Encrypted, OS-level secure storage |
| Google Calendar token | expo-secure-store | Encrypted |
| Schoology API key | expo-secure-store | Encrypted |

### 8.4 Supabase Database Schema

```sql
-- Tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  subject text,
  description text,
  due_date timestamptz not null,
  start_time timestamptz,                    -- user-confirmed explicit start
  proposed_time timestamptz,                 -- algorithm-suggested (pending confirm)
  duration_minutes integer,                  -- manual override if no AI breakdown
  is_abstract boolean default false,
  difficulty text check (difficulty in ('low','medium','high')) default 'medium',
  source text check (source in ('manual','ai_extracted','google_calendar')) default 'manual',
  external_id text,
  starter_action text,
  status text check (status in ('not_started','in_progress','complete')) default 'not_started',
  schedule_status text check (schedule_status in ('unscheduled','proposed','confirmed','completed_on_time','rescheduled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Subtasks
create table subtasks (
  id uuid primary key default gen_random_uuid(),
  parent_task_id uuid references tasks on delete cascade not null,
  user_id uuid references auth.users not null,
  title text not null,
  estimated_minutes integer not null,
  is_complete boolean default false,
  "order" integer not null
);

-- Focus sessions
create table focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  task_id uuid references tasks on delete cascade,
  subtask_id uuid references subtasks,
  start_time timestamptz not null,
  end_time timestamptz,
  duration_minutes integer,
  breaks_taken integer default 0,
  completed_subtask_ids uuid[] default '{}'
);

-- User settings (1 row per user)
create table user_settings (
  user_id uuid primary key references auth.users,
  display_name text,
  energy_peak_start integer default 15,
  energy_peak_end integer default 17,
  pomodoro_enabled boolean default true,
  pomodoro_work_minutes integer default 25,
  pomodoro_break_minutes integer default 5,
  quiet_hours_start integer default 23,
  quiet_hours_end integer default 8,
  focus_audio text default 'none',
  busy_blocks jsonb default '[]',
  availability_notes text default '',
  calendar_events jsonb default '[]',        -- one-off CalendarEvent objects
  web_push_subscription text,                -- PushSubscription JSON (web only)
  auto_accept_proposed_schedule boolean default true,
  google_calendar_connected boolean default false,
  onboarding_complete boolean default false
);

-- Scheduling signals (learning data)
create table scheduling_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  task_id uuid references tasks on delete set null,
  day_of_week integer check (day_of_week between 0 and 6) not null,
  hour_of_day integer check (hour_of_day between 0 and 23) not null,
  outcome text check (outcome in ('completed','skipped','partial')) not null,
  actual_duration_minutes integer,
  recorded_at timestamptz default now()
);

-- RLS: users only see their own data
alter table tasks enable row level security;
alter table subtasks enable row level security;
alter table focus_sessions enable row level security;
alter table user_settings enable row level security;
alter table scheduling_signals enable row level security;

create policy "own data only" on tasks for all using (auth.uid() = user_id);
create policy "own data only" on subtasks for all using (auth.uid() = user_id);
create policy "own data only" on focus_sessions for all using (auth.uid() = user_id);
create policy "own data only" on user_settings for all using (auth.uid() = user_id);
create policy "own data only" on scheduling_signals for all using (auth.uid() = user_id);
```

### 8.5 Offline Sync Strategy

1. **On app open:** Load from AsyncStorage immediately (instant render), then fetch fresh data from Supabase in the background and reconcile
2. **On task create/update/delete:** Write to Supabase first; on success, update local AsyncStorage cache. On failure (offline), queue the mutation and retry when connectivity returns.
3. **AI results:** Cached in AsyncStorage only — no Supabase sync needed
4. **Settings:** Read from Supabase on login; write-through on change (AsyncStorage + Supabase simultaneously)

### 8.6 AI Proxy Migration Plan

**Current (Phase 2):** Express server in `backend/server.js`, running locally or on Railway, wrapping Gemini API.

**Target (Phase 3):** Migrate the three AI endpoints to **Supabase Edge Functions**:
- `supabase/functions/ai-breakdown/index.ts`
- `supabase/functions/ai-simplify/index.ts`
- `supabase/functions/ai-extract-dates/index.ts`

Edge Functions run on Deno, are deployed via `supabase functions deploy`, and have access to Supabase secrets (where `GEMINI_API_KEY` lives). The `services/ai.ts` client module just changes its `API_BASE` from `localhost:3000` to the Supabase functions URL — no other frontend changes needed.

**Why Edge Functions over Railway/Render:**
- No separate service to manage or pay for
- Secrets managed in Supabase dashboard alongside DB/auth
- Free tier covers Dandelion's usage
- Supabase MCP in Claude Code can scaffold and deploy them directly

---

## 9. Screens & User Flows

### 9.1 Onboarding Flow
```
1. Welcome screen → "Built for brains that work differently"
2. Notification permission request (with explanation of rate limiting)
3. Availability setup → weekly grid of busy time blocks (morning/afternoon/evening per day)
   + free-text "anything else" field; stored as settings.busyBlocks
4. Energy peak question → "When do you usually feel most focused?" (time picker)
5. All set → Home screen
```

#### 9.1.1 Availability Setup Screen
- Weekly grid: 7 rows (Mon–Sun) × 3 columns (Morning 6am–12pm, Afternoon 12pm–6pm, Evening 6pm–11pm)
- Tapping a cell toggles it between free (amber) and busy (muted gray with X)
- Text field: "Anything else? (e.g. swim practice Tues 4–6)"
- Selections stored in `settings.busyBlocks: Array<{ day, period }>` — consumed by the Phase 4 scheduler

### 9.2 Adding a Task Flow
```
FAB tap → Add Task sheet
├── Type task name (required)
├── Paste full assignment text (optional) → AI extraction (Phase 3)
├── Set due date (date picker)
├── Tap "Break it down" → Gemini generates subtasks → LoadingSkeleton → results shown
│   └── If Gemini quota exhausted → fallback subtasks shown with warm banner
└── Confirm → Task saved, redirected to Home with StarterActionCard
```

### 9.3 Focus Session Flow
```
Task detail screen → Tap subtask → "Start Focus"
├── Focus mode screen (full screen, minimal UI)
│   ├── Current subtask shown large
│   ├── Optional timer (Pomodoro or countdown)
│   ├── White noise toggle
│   ├── "I'm stuck" → Gemini simplifies subtask (LoadingSkeleton while in flight)
│   ├── "I feel overwhelmed" → Break screen
│   ├── "Take a break" → Break screen
│   └── Check off → next subtask auto-loads
├── Break screen modal
│   ├── Countdown timer (5 min default)
│   ├── Calming prompt (random)
│   └── Return → Fresh starter action
└── All subtasks done → Completion celebration
```

### 9.4 Profile Screen (Insights + Settings)
```
- Productivity chart: bar chart of completions by hour-of-day (last 7 days)
- Streak counter: days with ≥1 task completed
- "Your best time today": derived from productivity windows
- Tasks completed this week: count + list
- Settings rows: Pomodoro, quiet hours, focus audio, notification preferences
```

---

## 10. Design System

### 10.1 Palette (Warm Amber/Golden)
| Token | HSL | Purpose |
|---|---|---|
| primary | hsl(35, 85%, 55%) | Primary action, CTA buttons |
| background | hsl(40, 33%, 98%) | Page background (warm off-white) |
| card | hsl(35, 40%, 97%) | Card backgrounds |
| text | hsl(30, 10%, 15%) | Primary text |
| success | hsl(145, 55%, 48%) | Completion, done states |
| warning | hsl(38, 90%, 55%) | Due soon (12–48h) |
| danger | hsl(0, 70%, 58%) | Urgent (<12h) |
| accent | hsl(33, 74%, 62%) | AI features, highlights |

Dark mode: warm dark background (hsl(25, 15%, 10%)), not cold blue-black.

### 10.2 Design Principles (ADHD-First)
- **One primary action per screen** — no decision paralysis
- **Empty states are invitations**, not failures
- **"I feel overwhelmed" is a first-class button**, not hidden
- **Color is never the only signal** — always paired with text or icon
- **Progress is celebrated**, incompleteness is normalized
- **No streak anxiety** — streak counters do NOT appear on Home
- **Warm, not corporate** — amber/gold palette, not sterile blue or white

### 10.3 Touch Targets
- Minimum: 44pt (WCAG/Apple HIG)
- Primary actions: 52pt
- Buttons: 56pt min height

### 10.4 Source Files
- `utils/design-tokens.ts` — programmatic tokens (source of truth)
- `tailwind.config.js` — NativeWind theme extension
- `global.css` — TailwindCSS v3 directives (`@tailwind base/components/utilities`)

---

## 11. Non-Functional Requirements

### 11.1 Performance
- App cold start < 2 seconds on mid-range Android device
- AI API calls must show loading state within 100ms of initiation
- All local operations (task CRUD, navigation) must respond within 16ms (60fps)
- Subtask generation must complete within 5 seconds; show a meaningful loading state if longer

### 11.2 Offline Behavior
- Task data is cached locally in AsyncStorage for offline access; Supabase is the source of truth when online
- AI features gracefully degrade offline: show cached subtasks or fallback template with warm banner
- Notifications fire based on locally scheduled data; no internet required post-scheduling
- GCal/Schoology sync only attempted when online; last sync time displayed
- Mutations made offline (task create/update/delete) are queued and synced to Supabase on reconnect

### 11.3 Accessibility
- All interactive elements have `accessibilityLabel`
- Minimum tap target size: 44×44pt
- Support system font scaling up to 200%
- Respect `useColorScheme` for dark/light mode throughout
- No purely color-coded information (always paired with text or icon)

### 11.4 Privacy
- User task data is stored in Supabase, associated only with the user's auth UUID — no name, phone number, or other PII is required beyond an email address
- AI calls send only task title + description to the Gemini proxy; no user identity or auth token is transmitted to Google
- Supabase auth token stored in `expo-secure-store` (encrypted, OS-level)
- Schoology API key stored in `expo-secure-store`, never in plain AsyncStorage
- Google Calendar tokens stored in `expo-secure-store`
- Gemini API key stored in Supabase Edge Function secrets (production) or `backend/.env` (local dev) — never committed to git
- No analytics or tracking libraries

### 11.5 Notification Behavior Contract
- Never send notifications outside quiet hours (default 11pm–8am)
- Hard cap: 1 notification/hour (unless deadline < 12h)
- All notifications are dismissible and lead to the relevant task on tap
- User can snooze any notification for 30 or 60 minutes from the notification action

### 11.6 Zustand Selector Discipline
- Any selector that does `.map`, `.filter`, `.slice`, or `.sort` inline will cause infinite re-render loops with Zustand v5 + React 19's `useSyncExternalStore`
- **Pattern:** select raw array → derive slice via `useMemo` in the component
- All new store consumers must follow this pattern

---

## 12. File & Folder Structure

```
/
├── app/                          # Expo Router screens
│   ├── (tabs)/
│   │   ├── index.tsx             # Home screen
│   │   ├── tasks.tsx             # Task list (segment filter)
│   │   ├── calendar.tsx          # Calendar (week + month view)
│   │   ├── focus.tsx             # Focus session entry + history
│   │   └── profile.tsx           # Insights + Settings merged
│   ├── task/
│   │   ├── [id].tsx              # Task detail
│   │   └── new.tsx               # Add task
│   ├── focus/
│   │   └── session.tsx           # Active focus session (full screen)
│   ├── onboarding/
│   │   ├── welcome.tsx
│   │   ├── notifications.tsx
│   │   ├── availability.tsx      # Busy blocks grid
│   │   └── energy.tsx
│   ├── auth.tsx                  # Magic link sign-in screen
│   └── _layout.tsx
├── components/
│   ├── BreakModal.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Badge.tsx
│       ├── ProgressBar.tsx
│       ├── StarterActionCard.tsx
│       ├── TaskCard.tsx
│       ├── SubtaskRow.tsx
│       ├── EmptyState.tsx
│       ├── LoadingSkeleton.tsx
│       ├── FAB.tsx
│       └── TimerDisplay.tsx
├── store/
│   ├── taskStore.ts
│   ├── sessionStore.ts
│   ├── settingsStore.ts
│   └── insightsStore.ts
├── supabase/
│   └── functions/
│       ├── ai-breakdown/index.ts
│       ├── ai-simplify/index.ts
│       ├── ai-extract-dates/index.ts
│       └── send-web-push/index.ts     # Phase 8: Web push delivery
├── services/
│   ├── supabase.ts               # Supabase client init + auth helpers
│   ├── ai.ts                     # Gemini proxy calls (breakdown, extract, simplify)
│   ├── notifications.ts          # expo-notifications (native) + web push (web)
│   ├── scheduler.ts              # Smart scheduling algorithm + SchedulingSignal writes
│   ├── googleCalendar.ts         # V2 deferred
│   └── audio.ts
├── hooks/
│   ├── useProductivityWindows.ts
│   └── useNotificationScheduler.ts
├── utils/
│   ├── design-tokens.ts          # Source of truth for design tokens
│   ├── dateUtils.ts
│   ├── taskUtils.ts
│   └── constants.ts
├── types/
│   └── index.ts
├── assets/
│   ├── audio/
│   └── images/
├── backend/                      # Express proxy (Gemini wrapper)
│   ├── server.js
│   ├── package.json
│   └── .env                      # GEMINI_API_KEY — gitignored
├── app.json
├── babel.config.js               # NativeWind preset + import.meta transform
├── metro.config.js               # Package exports + NativeWind config
├── tailwind.config.js
├── global.css
├── tsconfig.json
└── package.json
```

---

## 13. Build Phases & Current Status

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Full UI rebuild: NativeWind, Zustand stores, all screens + components, design system | ✅ Complete (2026-04-08) |
| Phase 2 | AI integration: Gemini backend proxy, wire stubs to real endpoints, web rendering | ✅ Complete (2026-04-10) |
| Phase 3 | Supabase auth (magic link) + DB schema + local-first data layer; backend error differentiation; calendar store wiring; real date picker + AI task parser | ✅ Complete (2026-04-11) |
| Phase 4 | Task lifecycle complete, mark complete, notifications (expo-notifications), focus audio (expo-av), calendar drag-to-reschedule, profile tab, Edge Function migration | ✅ Complete (2026-04-12) |
| Phase 5 | Playwright verification, Vercel deployment, auth web fix, push sync wired | ✅ Complete (2026-04-12) |
| Phase 6 | Web compatibility: WebDateTimePicker, fix AI JWT on web, fix auth redirect; manual task duration; AI breakdown CTA | ✅ Complete (2026-04-12) |
| Phase 7 | Smart scheduling algorithm, one-off calendar events, Busy Times settings screen, post-schedule tracking UI | ✅ Complete (2026-04-12) |
| Phase 8 | App rename (Focal), 3-day calendar view, auto-scheduling on task creation, dark mode toggle, completed tasks section, delete button web fix, daily recalculation, "best time" notifications | ✅ Complete (2026-04-12) |
| Phase 9 | Dark mode web fix, Google Calendar removal, AI extract modal dismiss, web notifications, motivation nudge, display name onboarding, onboarding permissions | ✅ Complete (2026-04-12) |
| Phase 10 | Calendar overlap BFS fix, scheduler break buffer, "All" tasks tab, overdue reschedule, home tab checkboxes, profile setting modals, Reanimated animations | ✅ Complete (2026-04-12) |
| Phase 11 | Calendar subtask→single block, home tab top-task checkbox, AddEventModal from Home, busy-times refactor | ✅ Complete (2026-04-12) |

### Known Blockers (as of 2026-04-12)
- **web_push_subscription column** — not yet in Supabase schema; needed for future web push notifications
- ~~Supabase `tasks` table missing columns~~ — **Resolved** (migration applied Phase 7)
- ~~AI features broken on web~~ — **Resolved** (anon key fallback, Phase 6)
- ~~DateTimePicker no-op on web~~ — **Resolved** (WebDateTimePicker, Phase 6)
- ~~AI breakdown broken after extract-dates~~ — **Resolved** (Phase 6)
- ~~Delete button no-op on web~~ — **Resolved** (Modal replaces Alert.alert, Phase 8)

---

## 14. Open Questions & Future Scope

| Item | Status | Notes |
|---|---|---|
| Schoology API integration | **DROPPED** | School district approval requirements; out of scope |
| Google Calendar integration | V2 deferred | Not a current priority |
| WebDateTimePicker component | Phase 6 | Replace @rn-community/datetimepicker on web with HTML inputs |
| AI JWT fix on web | Phase 6 | `services/ai.ts` getAuthHeader() fails on web |
| Smart scheduling algorithm | Phase 7 | Scoring + slot selection + learning from signals |
| One-off calendar events | Phase 7 | User-added busy events beyond onboarding grid |
| Busy Times settings screen | Phase 7 | Edit busy blocks after onboarding |
| Web push notifications | Phase 8 | Service worker + VAPID + Supabase Edge Function scheduler |
| Productivity time analysis UI | Phase 8 | Bar chart of completions by hour in Profile tab |
| On-device AI | V2 | Eliminate Wi-Fi dependency |
| Teacher/parent view | V3 | Read-only progress view |

---

## 15. Constraints

- **Timeline:** MIT CREATe Challenge deadline; prioritize P0 features first
- **Team size:** 4 developers; divide by feature area (AI, integrations, UI, backend)
- **AI budget:** Google Gemini free tier (quota-limited); rotate key when exhausted
- **Database/Auth:** Supabase free tier — generous limits, more than sufficient for Focal's user count
- **No paid infrastructure for V1:** Supabase free tier covers DB + auth + Edge Functions; all other data is local
- **Demo device:** Ensure demo runs on at least one physical iOS device (Expo Go or TestFlight build)
- **Secrets:** Gemini API key in Supabase Edge Function secrets (production) or `backend/.env` (local dev) — never committed to git

---

*Last updated: April 2026 | For MIT CREATe Challenge submission*
