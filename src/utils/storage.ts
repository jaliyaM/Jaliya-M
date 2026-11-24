import type { AppSettings, DailyProgress, DaySummary } from '../types/hydration';

const PROGRESS_STORAGE_KEY = 'tide_hydration_daily_v1';
const HISTORY_STORAGE_KEY = 'tide_hydration_history_v1';
const SETTINGS_STORAGE_KEY = 'tide_hydration_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  goalMl: 2500,
  intervalMinutes: 45,
  soundMuted: false,
  soundVolume: 0.75,
  soundTone: 'droplet',
  notificationsEnabled: true,
  multiScreenPopupsEnabled: true,
  theme: 'light',
  compactMode: false,
};

/**
 * Returns local calendar date key as YYYY-MM-DD.
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Milliseconds until the next local midnight (00:00:00.500 to avoid boundary jitter).
 */
export function getMsUntilNextMidnight(now: Date = new Date()): number {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    500
  );
  return Math.max(1000, nextMidnight.getTime() - now.getTime());
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      // Respect OS dark preference on first launch
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      return { ...DEFAULT_SETTINGS, theme: prefersDark ? 'dark' : 'light' };
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      goalMl: Math.min(10000, Math.max(500, Number(parsed.goalMl) || DEFAULT_SETTINGS.goalMl)),
      intervalMinutes: Math.min(
        240,
        Math.max(1, Number(parsed.intervalMinutes) || DEFAULT_SETTINGS.intervalMinutes)
      ),
      soundVolume: Math.min(
        1,
        Math.max(0, typeof parsed.soundVolume === 'number' ? parsed.soundVolume : DEFAULT_SETTINGS.soundVolume)
      ),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadHistory(): DaySummary[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-14);
  } catch {
    return [];
  }
}

export function saveHistory(history: DaySummary[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-14)));
  } catch {
    // Ignore storage quota errors
  }
}

function archiveProgressToHistory(progress: DailyProgress): void {
  if (progress.intakeMl <= 0) return;
  const history = loadHistory();
  const existingIdx = history.findIndex((d) => d.dateKey === progress.dateKey);
  const entry: DaySummary = {
    dateKey: progress.dateKey,
    intakeMl: progress.intakeMl,
    goalMl: progress.goalMl,
  };
  if (existingIdx >= 0) {
    history[existingIdx] = entry;
  } else {
    history.push(entry);
  }
  history.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  saveHistory(history);
}

/**
 * Loads today's progress from localStorage. If stored progress belongs to a previous day,
 * archives it to history and resets today's progress to 0 ml cleanly.
 */
export function loadDailyProgress(currentGoalMl: number): {
  progress: DailyProgress;
  didResetForNewDay: boolean;
} {
  const todayKey = getLocalDateKey();
  const emptyToday: DailyProgress = {
    dateKey: todayKey,
    intakeMl: 0,
    goalMl: currentGoalMl,
    entries: [],
  };

  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) {
      saveDailyProgress(emptyToday);
      return { progress: emptyToday, didResetForNewDay: false };
    }

    const parsed = JSON.parse(raw) as DailyProgress;
    if (!parsed || typeof parsed.dateKey !== 'string') {
      saveDailyProgress(emptyToday);
      return { progress: emptyToday, didResetForNewDay: false };
    }

    if (parsed.dateKey !== todayKey) {
      archiveProgressToHistory(parsed);
      saveDailyProgress(emptyToday);
      return { progress: emptyToday, didResetForNewDay: true };
    }

    return {
      progress: {
        dateKey: todayKey,
        intakeMl: Math.max(0, Number(parsed.intakeMl) || 0),
        goalMl: currentGoalMl,
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      },
      didResetForNewDay: false,
    };
  } catch {
    saveDailyProgress(emptyToday);
    return { progress: emptyToday, didResetForNewDay: false };
  }
}

export function saveDailyProgress(progress: DailyProgress): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors
  }
}

export function formatTimeShort(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatReadableDate(date: Date = new Date()): string {
  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
