import type {
  AlertTriggerResult,
  MultiScreenPermissionState,
  NotificationPermissionState,
  ScreenDetailedInfo,
  ScreenDetailsLike,
  SoundTone,
  SyncMessage,
} from '../types/hydration';
import { playHydrationSound } from './audio';

export const SYNC_CHANNEL_NAME = 'tide-hydration-sync-v1';

const activePopupWindows = new Set<Window>();
let titleFlashInterval: number | null = null;
const DEFAULT_TITLE = 'Tide — Hydration Reminder';

export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermissionState;
  } catch {
    return Notification.permission as NotificationPermissionState;
  }
}

export function isWindowManagementSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.getScreenDetails === 'function';
}

export async function queryMultiScreenPermission(): Promise<MultiScreenPermissionState> {
  if (!isWindowManagementSupported()) {
    return 'unsupported';
  }
  if (!navigator.permissions || !navigator.permissions.query) {
    return 'prompt';
  }
  try {
    const status = await navigator.permissions.query({
      name: 'window-management' as PermissionName,
    });
    if (status.state === 'granted') return 'granted';
    if (status.state === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'prompt';
  }
}

export async function requestMultiScreenDetails(): Promise<{
  permission: MultiScreenPermissionState;
  details: ScreenDetailsLike | null;
}> {
  if (!isWindowManagementSupported() || !window.getScreenDetails) {
    return { permission: 'unsupported', details: null };
  }
  try {
    const details = await window.getScreenDetails();
    return { permission: 'granted', details };
  } catch (err) {
    const isDenied =
      err instanceof DOMException &&
      (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    return { permission: isDenied ? 'denied' : 'prompt', details: null };
  }
}

export function startTabTitleFlash(message = '💧 Time to Drink Water!'): void {
  stopTabTitleFlash();
  let showAlert = true;
  document.title = message;
  titleFlashInterval = window.setInterval(() => {
    document.title = showAlert ? DEFAULT_TITLE : message;
    showAlert = !showAlert;
  }, 1100);
}

export function stopTabTitleFlash(customTitle?: string): void {
  if (titleFlashInterval !== null) {
    window.clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  document.title = customTitle || DEFAULT_TITLE;
}

export function closeAllReminderPopups(): void {
  activePopupWindows.forEach((win) => {
    try {
      if (!win.closed) {
        win.close();
      }
    } catch {
      // Ignore cross-origin or already-closed errors
    }
  });
  activePopupWindows.clear();

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      const msg: SyncMessage = { type: 'CLOSE_ALL_POPUPS' };
      channel.postMessage(msg);
      channel.close();
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

function buildPopupUrl(params: {
  screenIndex: number;
  screenTotal: number;
  intakeMl: number;
  goalMl: number;
  theme: 'light' | 'dark';
}): string {
  const url = new URL(window.location.href);
  url.searchParams.set('popup', 'reminder');
  url.searchParams.set('screen', String(params.screenIndex + 1));
  url.searchParams.set('total', String(params.screenTotal));
  url.searchParams.set('intake', String(params.intakeMl));
  url.searchParams.set('goal', String(params.goalMl));
  url.searchParams.set('theme', params.theme);
  return url.toString();
}

export interface TriggerAlertOptions {
  intakeMl: number;
  goalMl: number;
  soundMuted: boolean;
  soundVolume: number;
  soundTone: SoundTone;
  notificationsEnabled: boolean;
  multiScreenPopupsEnabled: boolean;
  screenDetails: ScreenDetailsLike | null;
  theme: 'light' | 'dark';
}

/**
 * Triggers the complete hydration reminder suite:
 * 1) Synthesized Web Audio droplet/chime sound
 * 2) Native OS Browser Notification
 * 3) Multi-monitor centered popup windows via getScreenDetails() (or standard popup + flashing tab title fallback)
 */
export async function triggerHydrationAlert(
  options: TriggerAlertOptions
): Promise<AlertTriggerResult> {
  const remainingMl = Math.max(0, options.goalMl - options.intakeMl);
  const progressText =
    remainingMl > 0
      ? `${options.intakeMl.toLocaleString()} / ${options.goalMl.toLocaleString()} ml today · ${remainingMl.toLocaleString()} ml left`
      : `Daily goal reached (${options.intakeMl.toLocaleString()} ml) — stay topped up!`;

  // 1) Web Audio sound
  const soundPlayed = await playHydrationSound(
    options.soundVolume,
    options.soundMuted,
    options.soundTone
  );

  // 2) Native OS Browser Notification
  let notificationSent = false;
  if (
    options.notificationsEnabled &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      const notification = new Notification('Time to Drink Water!', {
        body: progressText,
        tag: 'tide-hydration-reminder',
        requireInteraction: true,
        silent: true, // We play our own Web Audio water-drop chime
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      notificationSent = true;
    } catch {
      notificationSent = false;
    }
  }

  // Close stale popups before opening fresh ones
  closeAllReminderPopups();

  // 3) Multi-Screen Popup Mode or Standard Popup + Title Flash Fallback
  const popupWidth = 380;
  const popupHeight = 290;
  let popupsOpened = 0;
  let screensTargeted = 1;
  let usedMultiScreenApi = false;
  let popupsBlocked = false;
  let usedFallbackTitleFlash = false;

  let screens: ScreenDetailedInfo[] = [];

  if (options.multiScreenPopupsEnabled && options.screenDetails?.screens?.length) {
    screens = options.screenDetails.screens;
    usedMultiScreenApi = true;
  } else if (
    options.multiScreenPopupsEnabled &&
    isWindowManagementSupported() &&
    window.getScreenDetails
  ) {
    // Attempt non-blocking fetch if permission was already granted
    const perm = await queryMultiScreenPermission();
    if (perm === 'granted') {
      try {
        const freshDetails = await window.getScreenDetails();
        if (freshDetails.screens.length > 0) {
          screens = freshDetails.screens;
          usedMultiScreenApi = true;
        }
      } catch {
        usedMultiScreenApi = false;
      }
    }
  }

  if (options.multiScreenPopupsEnabled && usedMultiScreenApi && screens.length > 0) {
    screensTargeted = screens.length;
    screens.forEach((scr, index) => {
      const left = Math.round(scr.availLeft + (scr.availWidth - popupWidth) / 2);
      const top = Math.round(scr.availTop + (scr.availHeight - popupHeight) / 2);
      const features = `popup=yes,width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=no,scrollbars=no`;
      const popupUrl = buildPopupUrl({
        screenIndex: index,
        screenTotal: screens.length,
        intakeMl: options.intakeMl,
        goalMl: options.goalMl,
        theme: options.theme,
      });

      const win = window.open(popupUrl, `tide_hydration_screen_${index}`, features);
      if (win) {
        activePopupWindows.add(win);
        try {
          win.focus();
        } catch {
          // Ignore focus restrictions
        }
        popupsOpened += 1;
      } else {
        popupsBlocked = true;
      }
    });
  } else if (options.multiScreenPopupsEnabled) {
    // Fallback when getScreenDetails() is unsupported or permission not granted:
    // Open a standard centered popup window AND flash the main tab title
    screensTargeted = 1;
    const availLeft = (window.screen as unknown as { availLeft?: number }).availLeft ?? 0;
    const availTop = (window.screen as unknown as { availTop?: number }).availTop ?? 0;
    const left = Math.round(availLeft + (window.screen.availWidth - popupWidth) / 2);
    const top = Math.round(availTop + (window.screen.availHeight - popupHeight) / 2);
    const features = `popup=yes,width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=no,scrollbars=no`;
    const popupUrl = buildPopupUrl({
      screenIndex: 0,
      screenTotal: 1,
      intakeMl: options.intakeMl,
      goalMl: options.goalMl,
      theme: options.theme,
    });

    const win = window.open(popupUrl, 'tide_hydration_popup', features);
    if (win) {
      activePopupWindows.add(win);
      try {
        win.focus();
      } catch {
        // Ignore focus restrictions
      }
      popupsOpened = 1;
    } else {
      popupsBlocked = true;
    }

    startTabTitleFlash('💧 Time to Drink Water!');
    usedFallbackTitleFlash = true;
  } else {
    // Even if Multi-Screen Popups are switched off, flash the tab title gently until interacted with
    startTabTitleFlash('💧 Time to Drink Water!');
    usedFallbackTitleFlash = true;
  }

  return {
    soundPlayed,
    notificationSent,
    popupsOpened,
    screensTargeted,
    usedMultiScreenApi,
    popupsBlocked,
    usedFallbackTitleFlash,
  };
}
