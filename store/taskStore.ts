import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Task, Subtask, TaskStatus, CalendarEvent, BusyBlock, SchedulingSignal } from "@/types";
import { generateId } from "@/types";
import {
  getCurrentUser,
  upsertTask,
  upsertSubtask,
  deleteTask as deleteTaskFromDB,
  deleteSubtask as deleteSubtaskFromDB,
  taskToSupabase,
  subtaskToSupabase,
} from "@/services/supabase";
import { findBestSlot, type ScheduleInput } from "@/services/scheduler";
import { useSettingsStore } from "@/store/settingsStore";
import { useSchedulingStore } from "@/store/schedulingStore";

// ---------------------------------------------------------------------------
// Fire-and-forget sync helpers — errors are logged inside the service, never
// surfaced to the user. We only sync when a user session exists.
// ---------------------------------------------------------------------------

async function syncTask(task: Task): Promise<void> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return;
  upsertTask(taskToSupabase(task, user.id), user.id).catch(() => {});
}

async function syncSubtasks(subtasks: Subtask[]): Promise<void> {
  if (subtasks.length === 0) return;
  const user = await getCurrentUser().catch(() => null);
  if (!user) return;
  for (const subtask of subtasks) {
    upsertSubtask(subtaskToSupabase(subtask, user.id), user.id).catch(() => {});
  }
}

async function removeTask(taskId: string): Promise<void> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return;
  deleteTaskFromDB(taskId).catch(() => {});
}

async function removeSubtask(subtaskId: string): Promise<void> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return;
  deleteSubtaskFromDB(subtaskId).catch(() => {});
}

interface TaskState {
  tasks: Task[];
  /** ISO timestamp of the last successful Supabase sync, or null if never synced. */
  lastSyncedAt: string | null;
  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt" | "subtasks" | "status" | "scheduleStatus" | "durationMinutes" | "proposedTime"> & { durationMinutes?: number | null; proposedTime?: string }) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  addSubtasks: (taskId: string, subtasks: Omit<Subtask, "id" | "parentTaskId">[]) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  updateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => void;
  setLastSyncedAt: (timestamp: string) => void;
  proposeSchedule: (
    taskId: string,
    input: Omit<ScheduleInput, "task" | "allTasks">
  ) => void;
  getTaskById: (id: string) => Task | undefined;
  getUrgentTasks: () => Task[];
  getTasksByGroup: () => { overdue: Task[]; today: Task[]; thisWeek: Task[]; later: Task[] };
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      lastSyncedAt: null,

      addTask: (taskData) => {
        const id = generateId();
        const now = new Date().toISOString();
        const task: Task = {
          ...taskData,
          id,
          subtasks: [],
          status: "not_started",
          scheduleStatus: "unscheduled",
          durationMinutes: taskData.durationMinutes ?? null,
          proposedTime: taskData.proposedTime ?? undefined,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ tasks: [...state.tasks, task] }));
        syncTask(task).catch(() => {});
        // Auto-schedule: if no explicit startTime, propose a time slot
        if (!taskData.startTime) {
          try {
            const settingsState = useSettingsStore.getState();
            const schedulingState = useSchedulingStore.getState();
            // Use setTimeout to let the state settle before scheduling
            setTimeout(() => {
              get().proposeSchedule(id, {
                calendarEvents: settingsState.calendarEvents,
                busyBlocks: settingsState.busyBlocks,
                quietHoursStart: settingsState.quietHoursStart,
                quietHoursEnd: settingsState.quietHoursEnd,
                energyPeakStart: settingsState.energyPeakStart,
                energyPeakEnd: settingsState.energyPeakEnd,
                signals: schedulingState.signals,
              });
            }, 0);
          } catch {
            // Scheduling is best-effort — never block task creation
          }
        }
        return id;
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        }));
        const updated = get().tasks.find((t) => t.id === id);
        if (updated) syncTask(updated).catch(() => {});
      },

      deleteTask: (id) => {
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
        removeTask(id).catch(() => {});
      },

      setTaskStatus: (id, status) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t
          ),
        }));
        const updated = get().tasks.find((t) => t.id === id);
        if (updated) syncTask(updated).catch(() => {});
      },

      addSubtasks: (taskId, subtaskData) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const newSubtasks: Subtask[] = subtaskData.map((s, i) => ({
              ...s,
              id: generateId(),
              parentTaskId: taskId,
              order: t.subtasks.length + i,
            }));
            return {
              ...t,
              subtasks: [...t.subtasks, ...newSubtasks],
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
        const updatedTask = get().tasks.find((t) => t.id === taskId);
        if (updatedTask) {
          // Sync only the newly added subtasks (last N entries)
          const newSubtasks = updatedTask.subtasks.slice(-subtaskData.length);
          syncSubtasks(newSubtasks).catch(() => {});
        }
      },

      toggleSubtask: (taskId, subtaskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const subtasks = t.subtasks.map((s) =>
              s.id === subtaskId ? { ...s, isComplete: !s.isComplete } : s
            );
            const allDone = subtasks.every((s) => s.isComplete);
            const anyStarted = subtasks.some((s) => s.isComplete);
            return {
              ...t,
              subtasks,
              status: allDone ? "complete" : anyStarted ? "in_progress" : "not_started",
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
        const updatedTask = get().tasks.find((t) => t.id === taskId);
        if (updatedTask) {
          const changedSubtask = updatedTask.subtasks.find((s) => s.id === subtaskId);
          if (changedSubtask) syncSubtasks([changedSubtask]).catch(() => {});
          // Sync parent task too since status may have changed
          syncTask(updatedTask).catch(() => {});
        }
      },

      updateSubtask: (taskId, subtaskId, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t;
            return {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subtaskId ? { ...s, ...updates } : s
              ),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
        const updatedTask = get().tasks.find((t) => t.id === taskId);
        if (updatedTask) {
          const changedSubtask = updatedTask.subtasks.find((s) => s.id === subtaskId);
          if (changedSubtask) syncSubtasks([changedSubtask]).catch(() => {});
        }
      },

      setLastSyncedAt: (timestamp) => {
        set({ lastSyncedAt: timestamp });
      },

      proposeSchedule: (taskId, input) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return;
        const allTasks = get().tasks;
        const slot = findBestSlot({ ...input, task, allTasks });
        if (slot) {
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    proposedTime: slot.startTime.toISOString(),
                    scheduleStatus: "proposed" as const,
                    updatedAt: new Date().toISOString(),
                  }
                : t
            ),
          }));
          const updated = get().tasks.find((t) => t.id === taskId);
          if (updated) syncTask(updated).catch(() => {});
        }
      },

      getTaskById: (id) => get().tasks.find((t) => t.id === id),

      getUrgentTasks: () => {
        const now = Date.now();
        const in24h = now + 24 * 60 * 60 * 1000;
        return get()
          .tasks.filter(
            (t) => t.status !== "complete" && new Date(t.dueDate).getTime() <= in24h
          )
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      },

      getTasksByGroup: () => {
        const now = new Date();
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const incomplete = get().tasks.filter((t) => t.status !== "complete");
        const overdue: Task[] = [];
        const today: Task[] = [];
        const thisWeek: Task[] = [];
        const later: Task[] = [];

        for (const task of incomplete) {
          const due = new Date(task.dueDate);
          if (due < now) overdue.push(task);
          else if (due <= todayEnd) today.push(task);
          else if (due <= weekEnd) thisWeek.push(task);
          else later.push(task);
        }

        const byDate = (a: Task, b: Task) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

        return {
          overdue: overdue.sort(byDate),
          today: today.sort(byDate),
          thisWeek: thisWeek.sort(byDate),
          later: later.sort(byDate),
        };
      },
    }),
    {
      name: "dandelion-tasks",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
