import { Bell, Monitor, Volume2, VolumeX } from 'lucide-react';
import type {
  AppSettings,
  MultiScreenPermissionState,
  NotificationPermissionState,
  SoundTone,
} from '../types/hydration';

interface AlertControlsProps {
  settings: AppSettings;
  notificationPermission: NotificationPermissionState;
  multiScreenPermission: MultiScreenPermissionState;
  detectedScreensCount: number;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onRequestNotifications: () => void;
  onRequestMultiScreen: () => void;
  onPreviewSound: () => void;
}

const TONE_OPTIONS: { id: SoundTone; label: string }[] = [
  { id: 'droplet', label: 'Droplet' },
  { id: 'chime', label: 'Chime' },
  { id: 'tide', label: 'Tide' },
];

export function AlertControls({
  settings,
  notificationPermission,
  multiScreenPermission,
  detectedScreensCount,
  onUpdateSettings,
  onRequestNotifications,
  onRequestMultiScreen,
  onPreviewSound,
}: AlertControlsProps) {
  const volumePercent = Math.round(settings.soundVolume * 100);

  const notificationStatusText = (() => {
    if (notificationPermission === 'unsupported') return 'Unsupported in this browser';
    if (notificationPermission === 'granted') {
      return settings.notificationsEnabled ? 'Enabled · OS alerts ready' : 'Permission granted · Muted';
    }
    if (notificationPermission === 'denied') return 'Blocked in browser settings';
    return 'Permission not yet requested';
  })();

  const multiScreenStatusText = (() => {
    if (multiScreenPermission === 'unsupported') {
      return 'Fallback · Single popup & tab title flash';
    }
    if (multiScreenPermission === 'granted') {
      const label =
        detectedScreensCount > 1
          ? `${detectedScreensCount} monitors detected`
          : '1 monitor detected';
      return settings.multiScreenPopupsEnabled
        ? `Enabled · ${label}`
        : `Granted (${label}) · Off`;
    }
    if (multiScreenPermission === 'denied') {
      return 'Blocked · Using single popup & tab flash';
    }
    return 'Click Detect screens for all monitors';
  })();

  return (
    <section
      aria-labelledby="alerts-controls-heading"
      className="rounded-2xl bg-white dark:bg-[#0e1b2a] border border-slate-200 dark:border-slate-800/90 p-5 sm:p-6 divide-y divide-slate-200/80 dark:divide-slate-800"
    >
      {/* Section Heading */}
      <div className="pb-4">
        <h2
          id="alerts-controls-heading"
          className="font-display text-base font-semibold text-slate-900 dark:text-white"
        >
          Alerts &amp; Multi-Screen Popups
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Sound, native OS notifications, and multi-monitor popup behavior
        </p>
      </div>

      {/* 1. Sound & Volume */}
      <div className="py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ soundMuted: !settings.soundMuted })
              }
              aria-label={settings.soundMuted ? 'Unmute reminder sound' : 'Mute reminder sound'}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              {settings.soundMuted ? (
                <VolumeX className="w-4 h-4 text-slate-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              )}
            </button>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Water-drop Chime
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {settings.soundMuted ? 'Muted' : `${volumePercent}% volume`}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onPreviewSound}
            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Preview
          </button>
        </div>

        {/* Volume slider + tone segmented picker */}
        <div className="flex items-center gap-3">
          <label htmlFor="sound-volume-slider" className="sr-only">
            Sound volume
          </label>
          <input
            id="sound-volume-slider"
            type="range"
            min={0}
            max={100}
            value={settings.soundMuted ? 0 : volumePercent}
            onChange={(e) => {
              const nextVol = Number(e.target.value) / 100;
              onUpdateSettings({
                soundVolume: nextVol,
                soundMuted: nextVol === 0,
              });
            }}
            className="flex-1 accent-sky-600 dark:accent-sky-400 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
          />

          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-[#08121e] border border-slate-200/70 dark:border-slate-800 shrink-0">
            {TONE_OPTIONS.map((tone) => (
              <button
                key={tone.id}
                type="button"
                onClick={() => onUpdateSettings({ soundTone: tone.id })}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  settings.soundTone === tone.id
                    ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Native OS Browser Notifications */}
      <div className="py-4 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-white">
              OS Notifications
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {notificationStatusText}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {notificationPermission === 'default' && (
            <button
              type="button"
              onClick={onRequestNotifications}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Enable
            </button>
          )}
          {notificationPermission === 'granted' && (
            <button
              type="button"
              role="switch"
              aria-checked={settings.notificationsEnabled}
              aria-label="Toggle OS Notifications"
              onClick={() =>
                onUpdateSettings({
                  notificationsEnabled: !settings.notificationsEnabled,
                })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                settings.notificationsEnabled
                  ? 'bg-sky-600 dark:bg-sky-500'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                  settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* 3. Multi-Screen Popups */}
      <div className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="mt-0.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 shrink-0">
              <Monitor className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Multi-Screen Popups
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {multiScreenStatusText}
              </div>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.multiScreenPopupsEnabled}
            aria-label="Toggle Multi-Screen Popups"
            onClick={() => {
              const next = !settings.multiScreenPopupsEnabled;
              onUpdateSettings({ multiScreenPopupsEnabled: next });
              if (next && multiScreenPermission === 'prompt') {
                onRequestMultiScreen();
              }
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
              settings.multiScreenPopupsEnabled
                ? 'bg-sky-600 dark:bg-sky-500'
                : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                settings.multiScreenPopupsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {settings.multiScreenPopupsEnabled &&
          multiScreenPermission === 'prompt' && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Allow window placement access to center popups on every active monitor.
              </p>
              <button
                type="button"
                onClick={onRequestMultiScreen}
                className="min-h-[36px] px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Detect screens
              </button>
            </div>
          )}
      </div>
    </section>
  );
}
