import { Droplets, X } from 'lucide-react';
import type { AlertTriggerResult } from '../types/hydration';

interface InAppAlertModalProps {
  open: boolean;
  intakeMl: number;
  goalMl: number;
  result: AlertTriggerResult | null;
  onLogAndClose: () => void;
  onDismiss: () => void;
}

export function InAppAlertModal({
  open,
  intakeMl,
  goalMl,
  result,
  onLogAndClose,
  onDismiss,
}: InAppAlertModalProps) {
  if (!open) return null;

  const remainingMl = Math.max(0, goalMl - intakeMl);

  const summaryParts: string[] = [];
  if (result?.soundPlayed) summaryParts.push('Sound played');
  if (result?.notificationSent) summaryParts.push('OS notification sent');
  if (result && result.popupsOpened > 0) {
    summaryParts.push(
      result.popupsOpened === 1
        ? '1 popup opened'
        : `${result.popupsOpened} screen popups opened`
    );
  }
  if (result?.usedFallbackTitleFlash) {
    summaryParts.push('Tab title flashing');
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="tide-alert-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-sky-950 text-white border border-sky-800 shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sky-300 text-xs font-medium">
            <Droplets className="w-4 h-4 shrink-0" />
            <span>Hydration Reminder</span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss reminder"
            className="min-h-[40px] min-w-[40px] -mt-2 -mr-2 flex items-center justify-center rounded-lg text-sky-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <h2
            id="tide-alert-heading"
            className="font-display text-2xl font-bold tracking-tight text-white"
          >
            Time to Drink Water!
          </h2>
          <p className="text-sm text-sky-100/90 leading-relaxed">
            You&apos;re at{' '}
            <span className="font-mono font-semibold tabular-nums text-white">
              {intakeMl.toLocaleString()} / {goalMl.toLocaleString()} ml
            </span>{' '}
            today.{' '}
            {remainingMl > 0
              ? `${remainingMl.toLocaleString()} ml left to hit your daily goal.`
              : 'You reached your goal — keep sipping steadily.'}
          </p>
        </div>

        {summaryParts.length > 0 && (
          <p className="text-xs text-sky-200/80 border-t border-sky-800/80 pt-3">
            {summaryParts.join(' · ')}
          </p>
        )}

        {result?.popupsBlocked && (
          <p className="text-xs text-amber-200 bg-amber-950/50 border border-amber-800/70 rounded-lg px-3 py-2">
            Your browser blocked external popup windows. Allow popups for this site to enable multi-monitor alert windows.
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onLogAndClose}
            className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 active:scale-[0.98] text-slate-950 font-semibold text-sm transition-all cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Log +250ml &amp; Close
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[46px] px-4 py-2.5 rounded-xl border border-sky-700 hover:bg-sky-900 text-sky-100 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
