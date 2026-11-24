import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BellRing,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
} from 'lucide-react';
import { AlertControls } from './components/AlertControls';
import { HydrationTracker } from './components/HydrationTracker';
import { InAppAlertModal } from './components/InAppAlertModal';
import { IntakeHistoryView } from './components/IntakeHistoryView';
import { ReminderPopupView } from './components/ReminderPopupView';
import { ReminderTimer } from './components/ReminderTimer';
import type {
  AlertTriggerResult,
  AppSettings,
  DailyProgress,
  DaySummary,
  IntakeEntry,
  MultiScreenPermissionState,
  NotificationPermissionState,
  ScreenDetailsLike,
  SyncMessage,
} from './types/hydration';
import {
  SYNC_CHANNEL_NAME,
  closeAllReminderPopups,
  getNotificationPermissionState,
  queryMultiScreenPermission,
  requestMultiScreenDetails,
  requestNotificationPermission,
  stopTabTitleFlash,
  triggerHydrationAlert,
} from './utils/alerts';
import { playHydrationSound, playLogSipSound } from './utils/audio';
import {
  formatReadableDate,
  getLocalDateKey,
  getMsUntilNextMidnight,
  loadDailyProgress,
  loadHistory,
  loadSettings,
  saveDailyProgress,
  saveSettings,
} from './utils/storage';

type ActiveTab = 'tracker' | 'history';

function MainHydrationApp() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [progress, setProgress] = useState<DailyProgress>(
    () => loadDailyProgress(loadSettings().goalMl).progress
  );
  const [history, setHistory] = useState<DaySummary[]>(() => loadHistory());
  const [activeTab, setActiveTab] = useState<ActiveTab>('tracker');
  const [lastAddedTick, setLastAddedTick] = useState(0);

  // Timer state (drift-free via target end timestamp)
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    () => loadSettings().intervalMinutes * 60
  );
  const targetEndTimeRef = useRef<number | null>(null);

  // Permissions & multi-screen state
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(() => getNotificationPermissionState());
  const [multiScreenPermission, setMultiScreenPermission] =
    useState<MultiScreenPermissionState>('prompt');
  const [screenDetails, setScreenDetails] = useState<ScreenDetailsLike | null>(
    null
  );
  const [detectedScreensCount, setDetectedScreensCount] = useState<number>(1);

  // Active alert overlay state
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [lastAlertResult, setLastAlertResult] =
    useState<AlertTriggerResult | null>(null);
  const [midnightNotice, setMidnightNotice] = useState(false);

  // Dedup guard for cross-window messages (BroadcastChannel + postMessage)
  const lastPopupLogAtRef = useRef<number>(0);

  // Keep latest values in refs for interval callbacks
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const screenDetailsRef = useRef(screenDetails);
  screenDetailsRef.current = screenDetails;

  // Sync theme class on <html> and persist settings
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    saveSettings(settings);
  }, [settings]);

  // Persist daily progress to localStorage and broadcast to any open popups
  useEffect(() => {
    saveDailyProgress(progress);
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
        const msg: SyncMessage = {
          type: 'STATE_SYNC',
          intakeMl: progress.intakeMl,
          goalMl: progress.goalMl,
        };
        ch.postMessage(msg);
        ch.close();
      } catch {
        // Ignore broadcast errors
      }
    }
  }, [progress]);

  // Helper: check if local calendar day changed and reset cleanly
  const checkMidnightRollover = useCallback(() => {
    const currentKey = getLocalDateKey();
    if (progressRef.current.dateKey !== currentKey) {
      const { progress: freshProgress } = loadDailyProgress(
        settingsRef.current.goalMl
      );
      setProgress(freshProgress);
      setHistory(loadHistory());
      setMidnightNotice(true);
      window.setTimeout(() => setMidnightNotice(false), 6000);
    }
  }, []);

  // Schedule exact midnight rollover + check on tab visibility/focus
  useEffect(() => {
    let timeoutId: number;
    const scheduleNext = () => {
      const ms = getMsUntilNextMidnight();
      timeoutId = window.setTimeout(() => {
        checkMidnightRollover();
        scheduleNext();
      }, ms);
    };
    scheduleNext();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkMidnightRollover();
        setNotificationPermission(getNotificationPermissionState());
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [checkMidnightRollover]);

  // Query initial Window Management API permission & attach screenschange listener if granted
  useEffect(() => {
    let mounted = true;
    let activeDetails: ScreenDetailsLike | null = null;

    const handleScreensChange = () => {
      if (activeDetails && mounted) {
        setDetectedScreensCount(Math.max(1, activeDetails.screens.length));
      }
    };

    (async () => {
      const perm = await queryMultiScreenPermission();
      if (!mounted) return;
      setMultiScreenPermission(perm);

      if (perm === 'granted') {
        const res = await requestMultiScreenDetails();
        if (!mounted) return;
        setMultiScreenPermission(res.permission);
        if (res.details) {
          activeDetails = res.details;
          setScreenDetails(res.details);
          setDetectedScreensCount(Math.max(1, res.details.screens.length));
          res.details.addEventListener('screenschange', handleScreensChange);
        }
      }
    })();

    return () => {
      mounted = false;
      if (activeDetails) {
        activeDetails.removeEventListener('screenschange', handleScreensChange);
      }
    };
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const addWater = useCallback(
    (amountMl: number, source: IntakeEntry['source'] = 'quick') => {
      if (amountMl <= 0) return;
      const todayKey = getLocalDateKey();
      const entry: IntakeEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        amountMl,
        timestamp: Date.now(),
        source,
      };

      setProgress((prev) => {
        if (prev.dateKey !== todayKey) {
          return {
            dateKey: todayKey,
            intakeMl: amountMl,
            goalMl: settingsRef.current.goalMl,
            entries: [entry],
          };
        }
        return {
          ...prev,
          intakeMl: prev.intakeMl + amountMl,
          entries: [...prev.entries, entry],
        };
      });

      setLastAddedTick((t) => t + 1);
      void playLogSipSound(
        settingsRef.current.soundVolume,
        settingsRef.current.soundMuted
      );
    },
    []
  );

  const handleUndoLast = useCallback(() => {
    setProgress((prev) => {
      if (prev.entries.length === 0) return prev;
      const last = prev.entries[prev.entries.length - 1];
      return {
        ...prev,
        intakeMl: Math.max(0, prev.intakeMl - last.amountMl),
        entries: prev.entries.slice(0, -1),
      };
    });
  }, []);

  const handleDeleteEntry = useCallback((id: string) => {
    setProgress((prev) => {
      const target = prev.entries.find((e) => e.id === id);
      if (!target) return prev;
      return {
        ...prev,
        intakeMl: Math.max(0, prev.intakeMl - target.amountMl),
        entries: prev.entries.filter((e) => e.id !== id),
      };
    });
  }, []);

  const handleResetToday = useCallback(() => {
    setProgress((prev) => ({
      ...prev,
      intakeMl: 0,
      entries: [],
    }));
  }, []);

  const handleUpdateGoal = useCallback((newGoalMl: number) => {
    setSettings((prev) => ({ ...prev, goalMl: newGoalMl }));
    setProgress((prev) => ({ ...prev, goalMl: newGoalMl }));
  }, []);

  const resetTimerToFullInterval = useCallback((keepRunning: boolean) => {
    const secs = settingsRef.current.intervalMinutes * 60;
    setRemainingSeconds(secs);
    if (keepRunning) {
      targetEndTimeRef.current = Date.now() + secs * 1000;
      setIsRunning(true);
    } else {
      targetEndTimeRef.current = null;
      setIsRunning(false);
    }
  }, []);

  const fireReminder = useCallback(async () => {
    const s = settingsRef.current;
    const p = progressRef.current;

    const result = await triggerHydrationAlert({
      intakeMl: p.intakeMl,
      goalMl: p.goalMl,
      soundMuted: s.soundMuted,
      soundVolume: s.soundVolume,
      soundTone: s.soundTone,
      notificationsEnabled: s.notificationsEnabled,
      multiScreenPopupsEnabled: s.multiScreenPopupsEnabled,
      screenDetails: screenDetailsRef.current,
      theme: s.theme,
    });

    setLastAlertResult(result);
    setAlertModalOpen(true);
  }, []);

  // Drift-free countdown loop
  useEffect(() => {
    if (!isRunning) return;

    if (targetEndTimeRef.current === null) {
      targetEndTimeRef.current = Date.now() + remainingSeconds * 1000;
    }

    const tick = () => {
      if (targetEndTimeRef.current === null) return;
      const msLeft = targetEndTimeRef.current - Date.now();
      if (msLeft <= 0) {
        const nextSecs = settingsRef.current.intervalMinutes * 60;
        targetEndTimeRef.current = Date.now() + nextSecs * 1000;
        setRemainingSeconds(nextSecs);
        void fireReminder();
      } else {
        setRemainingSeconds(Math.ceil(msLeft / 1000));
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, fireReminder]);

  // Listen for actions from multi-screen popup windows (BroadcastChannel + postMessage)
  useEffect(() => {
    const handleSyncMessage = (msg: SyncMessage) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'LOG_WATER') {
        const now = Date.now();
        if (now - lastPopupLogAtRef.current < 450) return;
        lastPopupLogAtRef.current = now;
        addWater(msg.amountMl, 'popup');
        stopTabTitleFlash();
        setAlertModalOpen(false);
        closeAllReminderPopups();
        if (isRunning) {
          resetTimerToFullInterval(true);
        }
      } else if (msg.type === 'DISMISS_ALERT') {
        stopTabTitleFlash();
        setAlertModalOpen(false);
      }
    };

    const handleWindowMessage = (event: MessageEvent<SyncMessage>) => {
      if (event.origin !== window.location.origin) return;
      handleSyncMessage(event.data);
    };

    window.addEventListener('message', handleWindowMessage);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<SyncMessage>) => {
        handleSyncMessage(event.data);
      };
    }

    return () => {
      window.removeEventListener('message', handleWindowMessage);
      if (channel) channel.close();
    };
  }, [addWater, isRunning, resetTimerToFullInterval]);

  // Stop flashing tab title when user returns to main window and dismisses
  const handleDismissAlert = useCallback(() => {
    stopTabTitleFlash();
    closeAllReminderPopups();
    setAlertModalOpen(false);
  }, []);

  const handleLogFromAlert = useCallback(() => {
    addWater(250, 'popup');
    stopTabTitleFlash();
    closeAllReminderPopups();
    setAlertModalOpen(false);
    if (isRunning) {
      resetTimerToFullInterval(true);
    }
  }, [addWater, isRunning, resetTimerToFullInterval]);

  const handleToggleRun = useCallback(() => {
    if (isRunning) {
      if (targetEndTimeRef.current !== null) {
        const secsLeft = Math.max(
          1,
          Math.ceil((targetEndTimeRef.current - Date.now()) / 1000)
        );
        setRemainingSeconds(secsLeft);
      }
      targetEndTimeRef.current = null;
      setIsRunning(false);
    } else {
      const startSecs =
        remainingSeconds > 0
          ? remainingSeconds
          : settings.intervalMinutes * 60;
      targetEndTimeRef.current = Date.now() + startSecs * 1000;
      setIsRunning(true);
    }
  }, [isRunning, remainingSeconds, settings.intervalMinutes]);

  const handleSelectInterval = useCallback(
    (minutes: number) => {
      const clamped = Math.min(240, Math.max(1, Math.round(minutes)));
      updateSettings({ intervalMinutes: clamped });
      const secs = clamped * 60;
      setRemainingSeconds(secs);
      if (isRunning) {
        targetEndTimeRef.current = Date.now() + secs * 1000;
      } else {
        targetEndTimeRef.current = null;
      }
    },
    [isRunning, updateSettings]
  );

  const handleRequestNotifications = useCallback(async () => {
    const nextPerm = await requestNotificationPermission();
    setNotificationPermission(nextPerm);
    if (nextPerm === 'granted') {
      updateSettings({ notificationsEnabled: true });
    }
  }, [updateSettings]);

  const handleRequestMultiScreen = useCallback(async () => {
    const { permission, details } = await requestMultiScreenDetails();
    setMultiScreenPermission(permission);
    if (details) {
      setScreenDetails(details);
      setDetectedScreensCount(Math.max(1, details.screens.length));
      updateSettings({ multiScreenPopupsEnabled: true });
    }
  }, [updateSettings]);

  const handlePreviewSound = useCallback(() => {
    void playHydrationSound(
      settings.soundMuted ? 0.6 : settings.soundVolume,
      false,
      settings.soundTone
    );
  }, [settings.soundMuted, settings.soundTone, settings.soundVolume]);

  // Clean human-readable permission summary text for the top utility strip
  const notifLabel =
    notificationPermission === 'granted' && settings.notificationsEnabled
      ? 'Enabled'
      : notificationPermission === 'denied'
        ? 'Blocked'
        : notificationPermission === 'unsupported'
          ? 'Unsupported'
          : 'Off';

  const multiScreenLabel =
    multiScreenPermission === 'granted' && settings.multiScreenPopupsEnabled
      ? `${detectedScreensCount} ${detectedScreensCount === 1 ? 'screen' : 'screens'}`
      : multiScreenPermission === 'unsupported'
        ? 'Fallback'
        : multiScreenPermission === 'denied'
          ? 'Fallback'
          : settings.multiScreenPopupsEnabled
            ? 'Needs access'
            : 'Off';

  const isCompact = settings.compactMode;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#08121e] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#08121e]/90 backdrop-blur-md">
        <div
          className={`mx-auto flex items-center justify-between gap-6 px-4 sm:px-6 h-14 transition-all duration-300 ${
            isCompact ? 'max-w-[430px]' : 'max-w-5xl'
          }`}
        >
          {/* Zone 1: Brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('tracker')}
            className="font-display text-lg font-bold tracking-tight text-sky-700 dark:text-sky-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Tide
          </button>

          {/* Zone 2: Clean single-line text nav links */}
          <nav
            aria-label="Primary sections"
            className="flex items-center gap-6 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setActiveTab('tracker')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'tracker'
                  ? 'border-sky-600 dark:border-sky-400 text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tracker
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'history'
                  ? 'border-sky-600 dark:border-sky-400 text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              History
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <button
            type="button"
            onClick={() => void fireReminder()}
            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <BellRing className="w-3.5 h-3.5 shrink-0" />
            <span>{isCompact ? 'Test' : 'Test Reminder'}</span>
          </button>
        </div>
      </header>

      {/* Main workspace container */}
      <main
        className={`flex-1 mx-auto w-full px-4 sm:px-6 py-5 sm:py-7 space-y-5 transition-all duration-300 ${
          isCompact ? 'max-w-[430px]' : 'max-w-5xl'
        }`}
      >
        {/* Compact Status & View Toolbar (unboxed metadata + functional permissions & display switches) */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
              {formatReadableDate()}
            </span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">
              Notifications:{' '}
              {notificationPermission === 'default' ? (
                <button
                  type="button"
                  onClick={handleRequestNotifications}
                  className="font-medium text-sky-700 dark:text-sky-400 underline underline-offset-2 hover:text-sky-800 dark:hover:text-sky-300 cursor-pointer"
                >
                  Enable
                </button>
              ) : (
                <span
                  className={
                    notifLabel === 'Enabled'
                      ? 'font-medium text-emerald-700 dark:text-emerald-400'
                      : notifLabel === 'Blocked'
                        ? 'font-medium text-amber-700 dark:text-amber-400'
                        : 'font-medium text-slate-500 dark:text-slate-400'
                  }
                >
                  {notifLabel}
                </span>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">
              Multi-screen:{' '}
              {multiScreenPermission === 'prompt' &&
              settings.multiScreenPopupsEnabled ? (
                <button
                  type="button"
                  onClick={handleRequestMultiScreen}
                  className="font-medium text-sky-700 dark:text-sky-400 underline underline-offset-2 hover:text-sky-800 dark:hover:text-sky-300 cursor-pointer"
                >
                  Grant access
                </button>
              ) : (
                <span
                  className={
                    multiScreenPermission === 'granted' &&
                    settings.multiScreenPopupsEnabled
                      ? 'font-medium text-emerald-700 dark:text-emerald-400'
                      : 'font-medium text-slate-500 dark:text-slate-400'
                  }
                >
                  {multiScreenLabel}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => updateSettings({ compactMode: !settings.compactMode })}
              title={
                isCompact
                  ? 'Switch to wide desktop layout'
                  : 'Switch to compact corner layout'
              }
              className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              {isCompact ? (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Wide</span>
                </>
              ) : (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Compact</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                updateSettings({
                  theme: settings.theme === 'dark' ? 'light' : 'dark',
                })
              }
              aria-label={
                settings.theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              {settings.theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Midnight rollover notice if user left tab open overnight */}
        {midnightNotice && (
          <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-4 py-2.5 text-xs text-sky-900 dark:text-sky-200 flex items-center justify-between">
            <span>New day started — daily hydration progress reset to 0 ml.</span>
            <button
              type="button"
              onClick={() => setMidnightNotice(false)}
              className="font-semibold underline underline-offset-2 ml-3 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active View Content */}
        {activeTab === 'tracker' ? (
          <div
            className={`grid gap-5 items-start ${
              isCompact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-12'
            }`}
          >
            {/* Left column: Daily Goal & Water Fill Gauge */}
            <div className={isCompact ? '' : 'md:col-span-6 space-y-5'}>
              <HydrationTracker
                intakeMl={progress.intakeMl}
                goalMl={progress.goalMl}
                entriesCount={progress.entries.length}
                compact={isCompact}
                lastAddedTick={lastAddedTick}
                onAddWater={(ml, src) => addWater(ml, src)}
                onUndoLast={handleUndoLast}
                onUpdateGoal={handleUpdateGoal}
              />

              {!isCompact && (
                <AlertControls
                  settings={settings}
                  notificationPermission={notificationPermission}
                  multiScreenPermission={multiScreenPermission}
                  detectedScreensCount={detectedScreensCount}
                  onUpdateSettings={updateSettings}
                  onRequestNotifications={handleRequestNotifications}
                  onRequestMultiScreen={handleRequestMultiScreen}
                  onPreviewSound={handlePreviewSound}
                />
              )}
            </div>

            {/* Right column: Reminder Timer + (Compact Alert Controls or Today's Quick Log) */}
            <div className={isCompact ? 'space-y-5' : 'md:col-span-6 space-y-5'}>
              <ReminderTimer
                intervalMinutes={settings.intervalMinutes}
                remainingSeconds={remainingSeconds}
                isRunning={isRunning}
                compact={isCompact}
                onSelectInterval={handleSelectInterval}
                onToggleRun={handleToggleRun}
                onReset={() => resetTimerToFullInterval(false)}
                onTestReminder={() => void fireReminder()}
              />

              {isCompact ? (
                <AlertControls
                  settings={settings}
                  notificationPermission={notificationPermission}
                  multiScreenPermission={multiScreenPermission}
                  detectedScreensCount={detectedScreensCount}
                  onUpdateSettings={updateSettings}
                  onRequestNotifications={handleRequestNotifications}
                  onRequestMultiScreen={handleRequestMultiScreen}
                  onPreviewSound={handlePreviewSound}
                />
              ) : (
                <IntakeHistoryView
                  entries={progress.entries.slice(-5)}
                  todayDateKey={progress.dateKey}
                  todayIntakeMl={progress.intakeMl}
                  goalMl={progress.goalMl}
                  history={history}
                  onDeleteEntry={handleDeleteEntry}
                  onResetToday={handleResetToday}
                  onQuickAdd={(ml) => addWater(ml, 'quick')}
                />
              )}
            </div>
          </div>
        ) : (
          <IntakeHistoryView
            entries={progress.entries}
            todayDateKey={progress.dateKey}
            todayIntakeMl={progress.intakeMl}
            goalMl={progress.goalMl}
            history={history}
            onDeleteEntry={handleDeleteEntry}
            onResetToday={handleResetToday}
            onQuickAdd={(ml) => addWater(ml, 'quick')}
          />
        )}
      </main>

      {/* High-contrast In-App Alert Modal */}
      <InAppAlertModal
        open={alertModalOpen}
        intakeMl={progress.intakeMl}
        goalMl={progress.goalMl}
        result={lastAlertResult}
        onLogAndClose={handleLogFromAlert}
        onDismiss={handleDismissAlert}
      />
    </div>
  );
}

export default function App() {
  const isReminderPopup =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('popup') === 'reminder';

  if (isReminderPopup) {
    return <ReminderPopupView />;
  }

  return <MainHydrationApp />;
}
