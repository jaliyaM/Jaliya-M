import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { DaySummary, IntakeEntry } from '../types/hydration';
import { formatTimeShort } from '../utils/storage';

interface IntakeHistoryViewProps {
  entries: IntakeEntry[];
  todayDateKey: string;
  todayIntakeMl: number;
  goalMl: number;
  history: DaySummary[];
  onDeleteEntry: (id: string) => void;
  onResetToday: () => void;
  onQuickAdd: (amountMl: number) => void;
}

function formatShortDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString([], { weekday: 'short' });
}

export function IntakeHistoryView({
  entries,
  todayDateKey,
  todayIntakeMl,
  goalMl,
  history,
  onDeleteEntry,
  onResetToday,
  onQuickAdd,
}: IntakeHistoryViewProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  // Combine archived days with today for a clean 7-day trend bar chart
  const recentDays: DaySummary[] = [
    ...history.filter((d) => d.dateKey !== todayDateKey).slice(-6),
    { dateKey: todayDateKey, intakeMl: todayIntakeMl, goalMl },
  ];

  const maxChartMl = Math.max(
    goalMl,
    ...recentDays.map((d) => d.intakeMl),
    1000
  );

  return (
    <div className="space-y-5">
      {/* 7-Day Hydration Trend */}
      <section className="rounded-2xl bg-white dark:bg-[#0e1b2a] border border-slate-200 dark:border-slate-800/90 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Recent Daily Intake
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Saved locally · Archives automatically each midnight
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Goal {goalMl.toLocaleString()} ml
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 items-end h-36 pt-4">
          {recentDays.map((day) => {
            const pct = Math.min(100, Math.round((day.intakeMl / maxChartMl) * 100));
            const isToday = day.dateKey === todayDateKey;
            const metGoal = day.intakeMl >= day.goalMl;

            return (
              <div
                key={day.dateKey}
                className="flex flex-col items-center justify-end h-full gap-1.5"
              >
                <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {day.intakeMl > 0 ? `${(day.intakeMl / 1000).toFixed(1)}L` : '0'}
                </span>
                <div className="w-full max-w-[36px] flex-1 flex items-end rounded-lg bg-slate-100 dark:bg-slate-800/70 overflow-hidden">
                  <div
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      metGoal
                        ? 'bg-sky-600 dark:bg-sky-400'
                        : isToday
                          ? 'bg-sky-500/80 dark:bg-sky-500/75'
                          : 'bg-slate-400/70 dark:bg-slate-600'
                    }`}
                    style={{ height: `${Math.max(day.intakeMl > 0 ? 8 : 0, pct)}%` }}
                  />
                </div>
                <span
                  className={`text-[11px] whitespace-nowrap ${
                    isToday
                      ? 'font-semibold text-sky-700 dark:text-sky-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isToday ? 'Today' : formatShortDayLabel(day.dateKey)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Today's Timestamped Log */}
      <section className="rounded-2xl bg-white dark:bg-[#0e1b2a] border border-slate-200 dark:border-slate-800/90 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Today&apos;s Log
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} ·{' '}
              {todayIntakeMl.toLocaleString()} ml total
            </p>
          </div>

          {entries.length > 0 && !confirmReset && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              Reset today
            </button>
          )}

          {confirmReset && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onResetToday();
                  setConfirmReset(false);
                }}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Confirm reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="py-8 text-center space-y-3 border-t border-slate-200/80 dark:border-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No water logged yet today.
            </p>
            <button
              type="button"
              onClick={() => onQuickAdd(250)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Log first glass (+250 ml)
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-slate-800 border-t border-slate-200/80 dark:border-slate-800">
            {[...entries].reverse().map((entry) => (
              <li
                key={entry.id}
                className="py-3 flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono font-semibold tabular-nums text-sky-700 dark:text-sky-300 whitespace-nowrap">
                    +{entry.amountMl} ml
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {formatTimeShort(entry.timestamp)} ·{' '}
                    {entry.source === 'popup'
                      ? 'Reminder popup'
                      : entry.source === 'custom'
                        ? 'Custom entry'
                        : 'Quick add'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteEntry(entry.id)}
                  aria-label={`Remove ${entry.amountMl} ml entry`}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
