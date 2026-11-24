export interface IntakeEntry {
  id: string;
  amountMl: number;
  timestamp: number;
  source: 'quick' | 'popup' | 'custom';
}

export interface DailyProgress {
  dateKey: string; // YYYY-MM-DD in local time
  intakeMl: number;
  goalMl: number;
  entries: IntakeEntry[];
}

export interface DaySummary {
  dateKey: string;
  intakeMl: number;
  goalMl: number;
}

export type SoundTone = 'droplet' | 'chime' | 'tide';

export interface AppSettings {
  goalMl: number;
  intervalMinutes: number;
  soundMuted: boolean;
  soundVolume: number; // 0 to 1
  soundTone: SoundTone;
  notificationsEnabled: boolean;
  multiScreenPopupsEnabled: boolean;
  theme: 'light' | 'dark';
  compactMode: boolean;
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export type MultiScreenPermissionState =
  | 'granted'
  | 'prompt'
  | 'denied'
  | 'unsupported';

export interface ScreenDetailedInfo {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary?: boolean;
  label?: string;
}

export interface ScreenDetailsLike extends EventTarget {
  screens: ScreenDetailedInfo[];
  currentScreen: ScreenDetailedInfo;
}

export interface AlertTriggerResult {
  soundPlayed: boolean;
  notificationSent: boolean;
  popupsOpened: number;
  screensTargeted: number;
  usedMultiScreenApi: boolean;
  popupsBlocked: boolean;
  usedFallbackTitleFlash: boolean;
}

export type SyncMessage =
  | { type: 'LOG_WATER'; amountMl: number; source: 'popup' }
  | { type: 'CLOSE_ALL_POPUPS' }
  | { type: 'DISMISS_ALERT' }
  | { type: 'STATE_SYNC'; intakeMl: number; goalMl: number };

declare global {
  interface Window {
    getScreenDetails?: () => Promise<ScreenDetailsLike>;
  }
}
