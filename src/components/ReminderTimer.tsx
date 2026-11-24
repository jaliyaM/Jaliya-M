import { useState, type FormEvent } from 'react';
import { BellRing, Pause, Play, RotateCcw } from 'lucide-react';

interface ReminderTimerProps {
  intervalMinutes: number;
  remainingSeconds: number;
  isRunning: boolean;
  compact: boolean;
  onSelectInterval: (minutes: number) => void;
  onToggleRun: () => void;
  onReset: () => void;
  onTestReminder: () => void;
}

const INTERVAL_PRESETS = [30, 45, 60];

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function ReminderTimer({
  intervalMinutes,
  remainingSeconds,
  isRunning,
  compact,
  onSelectInterval,
  onToggleRun,
  onReset,
  onTestReminder,
}: ReminderTimerProps) {
  const [customMinutes, setCustomMinutes] = useState(
    INTERVAL_PRESETS.includes(intervalMinutes) ? '' : String(intervalMinutes)
  );

  const totalSeconds = Math.max(60, intervalMinutes * 60);
  const elapsedFraction = Math.min(
    1,
    Math.max(0, (totalSeconds - remainingSeconds) / totalSeconds)
  );

  const handleCustomSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Math.round(Number(customMinutes));
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 240) {
      onSelectInterval(parsed);
    }
  };

  return (
    <section
      aria-labelledby="reminder-timer-heading"
      className="rounded-2xl bg-white dark:bg-[#0e1b2a] border border-slate-200 dark:border-slate-800/90 p-5 sm:p-6 space-y-5"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2
            id="reminder-timer-heading"
            className="font-display text-base font-semibold text-slate-900 dark:text-white"
          >
            Reminder Timer
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isRunning
              ? `Next alert in ${formatCountdown(remainingSeconds)}`
              : remainingSeconds < totalSeconds
                ? 'Paused — resume when ready'
                : `Every ${intervalMinutes} minutes`}
          </p>
        </div>

        <span
          className={`text-xs font-medium whitespace-nowrap ${
            isRunning
              ? 'text-sky-700 dark:text-sky-300'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {isRunning ? 'Active' : remainingSeconds < totalSeconds ? 'Paused' : 'Standby'}
        </span>
      </div>

      {/* Countdown readout + elapsed bar */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <div
            className={`font-mono font-bold tracking-tight tabular-nums text-slate-900 dark:text-white ${
              compact ? 'text-4xl' : 'text-5xl'
            }`}
            aria-live="off"
          >
            {formatCountdown(remainingSeconds)}
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {intervalMinutes}m cycle
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-sky-600 dark:bg-sky-400 transition-transform duration-300 ease-out origin-left"
            style={{ transform: `scaleX(${elapsedFraction})` }}
          />
        </div>
      </div>

      {/* Primary timer transport controls */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleRun}
          className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
            isRunning
              ? 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950'
              : 'bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-4 h-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Start
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onReset}
          aria-label="Reset timer"
          className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* Interval presets + custom minute input */}
      <div className="border-t border-slate-200/80 dark:border-slate-800 pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Reminder interval
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#08121e] border border-slate-200/70 dark:border-slate-800">
            {INTERVAL_PRESETS.map((mins) => {
              const active = intervalMinutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setCustomMinutes('');
                    onSelectInterval(mins);
                  }}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-mono tabular-nums transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {mins}m
                </button>
              );
            })}
          </div>

          <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5 flex-1 min-w-[125px]">
            <label htmlFor="custom-interval-min" className="sr-only">
              Custom interval in minutes
            </label>
            <input
              id="custom-interval-min"
              type="number"
              min={1}
              max={240}
              placeholder="Custom min"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#08121e] px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!customMinutes || Number(customMinutes) < 1}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap"
            >
              Set
            </button>
          </form>
        </div>

        {/* Dedicated Test Reminder Now button */}
        <button
          type="button"
          onClick={onTestReminder}
          className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/40 hover:bg-sky-100/80 dark:hover:bg-sky-900/50 text-sky-800 dark:text-sky-200 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <BellRing className="w-4 h-4 shrink-0" />
          Test Reminder Now
        </button>
      </div>
    </section>
  );
}
