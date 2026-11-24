import { useEffect, useState } from 'react';

interface WaterGaugeProps {
  intakeMl: number;
  goalMl: number;
  compact?: boolean;
  lastAddedTick: number;
}

interface BubbleSpec {
  id: number;
  leftPct: number;
  size: number;
  delayMs: number;
}

export function WaterGauge({
  intakeMl,
  goalMl,
  compact = false,
  lastAddedTick,
}: WaterGaugeProps) {
  const [bubbles, setBubbles] = useState<BubbleSpec[]>([]);

  const rawPercent = goalMl > 0 ? (intakeMl / goalMl) * 100 : 0;
  const clampedPercent = Math.min(100, Math.max(0, rawPercent));
  const displayPercent = Math.round(rawPercent);
  const remainingMl = Math.max(0, goalMl - intakeMl);
  const goalReached = intakeMl >= goalMl && goalMl > 0;

  // Trigger subtle rising bubbles when water is logged
  useEffect(() => {
    if (lastAddedTick === 0) return;
    const batch: BubbleSpec[] = Array.from({ length: 5 }, (_, idx) => ({
      id: lastAddedTick * 10 + idx,
      leftPct: 18 + idx * 16 + ((lastAddedTick + idx * 7) % 9) - 4,
      size: 5 + ((idx * 3 + lastAddedTick) % 5),
      delayMs: idx * 90,
    }));
    setBubbles(batch);
    const timeout = window.setTimeout(() => setBubbles([]), 1700);
    return () => window.clearTimeout(timeout);
  }, [lastAddedTick]);

  // Calculate SVG wave translateY: 0% -> bottom (104%), 100% -> top (-4%)
  const fillTopPercent = 100 - clampedPercent;

  return (
    <div className="space-y-4">
      {/* Main fluid chamber */}
      <div
        className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-sky-50/70 dark:bg-[#0c1c2e] transition-all duration-300 ${
          compact ? 'h-36' : 'h-48'
        }`}
        role="progressbar"
        aria-valuenow={intakeMl}
        aria-valuemin={0}
        aria-valuemax={goalMl}
        aria-label={`Daily water intake: ${intakeMl} of ${goalMl} milliliters`}
      >
        {/* Subtle calibration ticks on right edge */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-3 right-3 z-20 flex flex-col justify-between text-[10px] font-mono tabular-nums text-slate-500/75 dark:text-slate-400/70"
        >
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        {/* Animated fluid fill body */}
        <div
          className="absolute inset-x-0 bottom-0 transition-transform duration-700 ease-out will-change-transform"
          style={{
            height: '100%',
            transform: `translateY(${fillTopPercent}%)`,
          }}
        >
          {/* Back ocean wave crest */}
          <div className="absolute -top-4 left-0 w-[200%] h-6 animate-wave-fast opacity-55">
            <svg
              viewBox="0 0 1200 60"
              preserveAspectRatio="none"
              className="w-full h-full fill-sky-400 dark:fill-sky-500"
            >
              <path d="M0,30 C150,55 300,5 450,30 C600,55 750,5 900,30 C1050,55 1125,18 1200,30 L1200,60 L0,60 Z" />
            </svg>
          </div>

          {/* Front ocean wave crest */}
          <div className="absolute -top-3 left-0 w-[200%] h-6 animate-wave-slow">
            <svg
              viewBox="0 0 1200 60"
              preserveAspectRatio="none"
              className="w-full h-full fill-sky-600 dark:fill-sky-500"
            >
              <path d="M0,24 C180,0 360,52 600,24 C840,-4 1020,48 1200,24 L1200,60 L0,60 Z" />
            </svg>
          </div>

          {/* Solid deep ocean gradient body */}
          <div className="w-full h-full bg-gradient-to-b from-sky-600 via-sky-600 to-cyan-700 dark:from-sky-500 dark:via-sky-600 dark:to-sky-800" />
        </div>

        {/* Rising micro-bubbles when water is added */}
        {bubbles.map((b) => (
          <span
            key={b.id}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 z-10 rounded-full bg-white/55 animate-bubble"
            style={{
              left: `${b.leftPct}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              animationDelay: `${b.delayMs}ms`,
            }}
          />
        ))}

        {/* High-contrast frosted readout centered cleanly for guaranteed legibility at every water height */}
        <div className="relative z-20 flex h-full flex-col items-start justify-between p-4 sm:p-5">
          <div className="rounded-xl bg-white/88 dark:bg-[#08121e]/82 backdrop-blur-sm px-3.5 py-2.5 border border-white/60 dark:border-slate-700/60">
            <div className="flex items-baseline gap-2">
              <span
                className={`font-mono font-bold tracking-tight tabular-nums text-slate-900 dark:text-white ${
                  compact ? 'text-2xl' : 'text-3xl'
                }`}
              >
                {intakeMl.toLocaleString()}
              </span>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                / {goalMl.toLocaleString()} ml
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-mono font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                {displayPercent}%
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {goalReached
                  ? 'Daily goal reached'
                  : `${remainingMl.toLocaleString()} ml remaining`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Crisp linear progress bar with exact numeric markers */}
      <div className="space-y-1.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-sky-600 dark:bg-sky-400 transition-transform duration-500 ease-out origin-left"
            style={{ transform: `scaleX(${clampedPercent / 100})` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          <span>0 ml</span>
          <span>
            {goalReached
              ? `+${(intakeMl - goalMl).toLocaleString()} ml above target`
              : `${Math.round(remainingMl / 250)} glasses left (~250 ml)`}
          </span>
          <span>{goalMl.toLocaleString()} ml</span>
        </div>
      </div>
    </div>
  );
}
