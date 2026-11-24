import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { WaterGauge } from './WaterGauge';

interface HydrationTrackerProps {
  intakeMl: number;
  goalMl: number;
  entriesCount: number;
  compact: boolean;
  lastAddedTick: number;
  onAddWater: (amountMl: number, source?: 'quick' | 'custom') => void;
  onUndoLast: () => void;
  onUpdateGoal: (newGoalMl: number) => void;
}

const QUICK_AMOUNTS = [
  { amount: 200, label: '+200ml', caption: 'Small glass' },
  { amount: 350, label: '+350ml', caption: 'Mug / tumbler' },
  { amount: 500, label: '+500ml', caption: 'Water bottle' },
];

const GOAL_PRESETS = [2000, 2500, 3000, 3500];

export function HydrationTracker({
  intakeMl,
  goalMl,
  entriesCount,
  compact,
  lastAddedTick,
  onAddWater,
  onUndoLast,
  onUpdateGoal,
}: HydrationTrackerProps) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goalMl));
  const [showCustomAdd, setShowCustomAdd] = useState(false);
  const [customMlInput, setCustomMlInput] = useState('250');

  const handleOpenGoalEdit = () => {
    setGoalInput(String(goalMl));
    setEditingGoal(true);
  };

  const handleSaveGoal = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Math.round(Number(goalInput));
    if (!Number.isNaN(parsed) && parsed >= 500 && parsed <= 10000) {
      onUpdateGoal(parsed);
      setEditingGoal(false);
    }
  };

  const handleCustomSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Math.round(Number(customMlInput));
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 3000) {
      onAddWater(parsed, 'custom');
      setShowCustomAdd(false);
    }
  };

  return (
    <section
      aria-labelledby="daily-hydration-heading"
      className="rounded-2xl bg-white dark:bg-[#0e1b2a] border border-slate-200 dark:border-slate-800/90 p-5 sm:p-6 flex flex-col justify-between gap-5"
    >
      {/* Header row with inline goal editor */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2
            id="daily-hydration-heading"
            className="font-display text-base font-semibold text-slate-900 dark:text-white"
          >
            Daily Hydration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Resets automatically at midnight
          </p>
        </div>

        {!editingGoal ? (
          <button
            type="button"
            onClick={handleOpenGoalEdit}
            className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span className="font-mono tabular-nums">
              Goal: {goalMl.toLocaleString()} ml
            </span>
            <Pencil className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditingGoal(false)}
            aria-label="Cancel goal edit"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Inline goal adjustment bar */}
      {editingGoal && (
        <form
          onSubmit={handleSaveGoal}
          className="border-y border-slate-200/80 dark:border-slate-800 py-3.5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <label htmlFor="daily-goal-input" className="sr-only">
              Daily goal in milliliters
            </label>
            <input
              id="daily-goal-input"
              type="number"
              min={500}
              max={10000}
              step={50}
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="flex-1 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#08121e] px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
            />
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              ml
            </span>
            <button
              type="submit"
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
          <div className="flex items-center flex-wrap gap-1.5">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setGoalInput(String(preset));
                  onUpdateGoal(preset);
                  setEditingGoal(false);
                }}
                className={`px-2.5 py-1.5 rounded-md text-xs font-mono tabular-nums transition-colors cursor-pointer whitespace-nowrap ${
                  goalMl === preset
                    ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-slate-950 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {preset.toLocaleString()} ml
              </button>
            ))}
          </div>
        </form>
      )}

      {/* Animated water-fill gauge */}
      <WaterGauge
        intakeMl={intakeMl}
        goalMl={goalMl}
        compact={compact}
        lastAddedTick={lastAddedTick}
      />

      {/* Quick-add action buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2.5">
          {QUICK_AMOUNTS.map((item) => (
            <button
              key={item.amount}
              type="button"
              onClick={() => onAddWater(item.amount, 'quick')}
              className="group min-h-[54px] px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.98] dark:bg-sky-500 dark:hover:bg-sky-400 text-white dark:text-slate-950 transition-all cursor-pointer flex flex-col items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            >
              <span className="font-mono text-sm font-semibold tabular-nums whitespace-nowrap">
                {item.label}
              </span>
              {!compact && (
                <span className="text-[11px] text-sky-100 dark:text-sky-950/80 whitespace-nowrap">
                  {item.caption}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Secondary row: custom amount + undo last */}
        <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
          {!showCustomAdd ? (
            <button
              type="button"
              onClick={() => setShowCustomAdd(true)}
              className="min-h-[36px] px-2.5 py-1.5 -ml-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Custom amount
            </button>
          ) : (
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
              <label htmlFor="custom-water-input" className="sr-only">
                Custom water amount in ml
              </label>
              <input
                id="custom-water-input"
                type="number"
                min={10}
                max={3000}
                step={10}
                value={customMlInput}
                onChange={(e) => setCustomMlInput(e.target.value)}
                className="w-20 min-h-[36px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#08121e] px-2.5 py-1 text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                Add ml
              </button>
              <button
                type="button"
                onClick={() => setShowCustomAdd(false)}
                aria-label="Close custom amount"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={onUndoLast}
            disabled={entriesCount === 0}
            className="min-h-[36px] px-2.5 py-1.5 -mr-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Undo last
          </button>
        </div>
      </div>
    </section>
  );
}
