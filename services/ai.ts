import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Task, Subtask } from "@/types";
import { getSession } from "@/services/supabase";

/**
 * When true, AI calls hit Supabase Edge Functions instead of localhost:3000.
 * Set the GEMINI_API_KEY secret in Supabase dashboard for this to work.
 */
const USE_EDGE_FUNCTIONS = !!process.env.EXPO_PUBLIC_SUPABASE_URL;

const LOCAL_BASE = "http://localhost:3000";
const EDGE_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
  : "";

async function getAIHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (USE_EDGE_FUNCTIONS) {
    // apikey header is always required by Supabase Edge Functions
    if (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
      headers["apikey"] = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    }
    try {
      const session = await getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      } else if (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        headers["Authorization"] = `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`;
      }
    } catch {
      // Session retrieval failed on web — use anon key as fallback
      if (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        headers["Authorization"] = `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`;
      }
    }
  }
  return headers;
}

function aiUrl(path: string): string {
  return USE_EDGE_FUNCTIONS ? `${EDGE_BASE}/${path}` : `${LOCAL_BASE}/ai/${path}`;
}

/** Map endpoint names to Edge Function slugs */
function edgePath(endpoint: string): string {
  const map: Record<string, string> = {
    breakdown: "ai-breakdown",
    simplify: "ai-simplify",
    "extract-dates": "ai-extract-dates",
  };
  return USE_EDGE_FUNCTIONS ? map[endpoint] ?? endpoint : endpoint;
}

const FALLBACK_SUBTASKS = [
  { title: "Read the assignment prompt", estimatedMinutes: 5 },
  { title: "Write an outline", estimatedMinutes: 10 },
  { title: "Draft the first section", estimatedMinutes: 15 },
  { title: "Review and edit", estimatedMinutes: 10 },
];

export interface BreakdownResult {
  starterAction: string;
  subtasks: { title: string; estimatedMinutes: number }[];
  /** True when the result came from the local fallback instead of live AI.
   *  Set when the backend returns 429 (rate_limited) or any other error.
   *  @deprecated Use `isFallback` — kept for backwards compatibility. */
  fromFallback?: boolean;
  /** True when the result came from the local fallback instead of live AI. */
  isFallback?: boolean;
  /** Reason the fallback was triggered. */
  fallbackReason?: "rate_limited" | "ai_failed";
}

/** Cache key for AI breakdown results */
function breakdownKey(taskId: string) {
  return `ai-breakdown-${taskId}`;
}

/** Cache key for simplified subtask results */
function simplifyKey(subtaskId: string) {
  return `ai-simplify-${subtaskId}`;
}

/**
 * Call POST /ai/breakdown — generates subtasks for a task.
 * Caches result in AsyncStorage keyed by task ID.
 */
export async function breakdownTask(task: {
  title: string;
  subject: string | null;
  dueDate: string;
  difficulty: string;
}): Promise<BreakdownResult> {
  // Check cache first
  const cacheKey = breakdownKey(`${task.title}-${task.dueDate}`);
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  try {
    const res = await fetch(aiUrl(edgePath("breakdown")), {
      method: "POST",
      headers: await getAIHeaders(),
      body: JSON.stringify({ task }),
    });

    // Rate-limited: return fallback flagged so the UI can tell the user.
    if (res.status === 429) {
      return {
        starterAction: `Open "${task.title}" and read what's needed`,
        subtasks: FALLBACK_SUBTASKS,
        fromFallback: true,
        isFallback: true,
        fallbackReason: "rate_limited",
      };
    }

    if (!res.ok) {
      return {
        starterAction: `Open "${task.title}" and read what's needed`,
        subtasks: FALLBACK_SUBTASKS,
        fromFallback: true,
        isFallback: true,
        fallbackReason: "ai_failed",
      };
    }

    const data: BreakdownResult = await res.json();
    const result: BreakdownResult = { ...data, isFallback: false, fromFallback: false };

    // Cache the result (live results only — never cache the fallback)
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
    } catch {}

    return result;
  } catch {
    // Network/parse failure — also fall back, also flagged.
    return {
      starterAction: `Open "${task.title}" and read what's needed`,
      subtasks: FALLBACK_SUBTASKS,
      fromFallback: true,
      isFallback: true,
      fallbackReason: "ai_failed",
    };
  }
}

/**
 * Call POST /ai/simplify — simplifies a subtask.
 * Caches result in AsyncStorage keyed by subtask ID.
 */
export async function simplifySubtask(
  subtaskId: string,
  subtaskTitle: string
): Promise<string> {
  const cacheKey = simplifyKey(subtaskId);
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch {}

  try {
    const res = await fetch(aiUrl(edgePath("simplify")), {
      method: "POST",
      headers: await getAIHeaders(),
      body: JSON.stringify({ subtask: { title: subtaskTitle } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const simplified = data.simplified || subtaskTitle;

    // Cache the result
    try {
      await AsyncStorage.setItem(cacheKey, simplified);
    } catch {}

    return simplified;
  } catch {
    return subtaskTitle;
  }
}

export interface ExtractDatesResult {
  items: { title: string; dueDate: string | null; subject: string | null }[];
  isFallback: boolean;
  fallbackReason?: "rate_limited" | "ai_failed";
}

/**
 * Call POST /ai/extract-dates — extracts tasks from text.
 */
export async function extractDates(
  userInput: string
): Promise<ExtractDatesResult> {
  try {
    const res = await fetch(aiUrl(edgePath("extract-dates")), {
      method: "POST",
      headers: await getAIHeaders(),
      body: JSON.stringify({ userInput }),
    });

    if (res.status === 429) {
      return { items: [], isFallback: true, fallbackReason: "rate_limited" };
    }

    if (!res.ok) {
      return { items: [], isFallback: true, fallbackReason: "ai_failed" };
    }

    const items = await res.json();
    return { items, isFallback: false };
  } catch {
    return { items: [], isFallback: true, fallbackReason: "ai_failed" };
  }
}
