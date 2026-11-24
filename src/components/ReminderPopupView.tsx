import { useEffect, useState } from 'react';
import { Droplets, X } from 'lucide-react';
import { SYNC_CHANNEL_NAME } from '../utils/alerts';
import type { SyncMessage } from '../types/hydration';

export function ReminderPopupView() {
  const params = new URLSearchParams(window.location.search);
  const screenNum = Number(params.get('screen') || '1');
  const screenTotal = Number(params.get('total') || '1');
  const initialIntake = Number(params.get('intake') || '0');
  const initialGoal = Number(params.get('goal') || '2500');
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';

  const [intakeMl, setIntakeMl] = useState(initialIntake);
  const [goalMl, setGoalMl] = useState(initialGoal);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    document.title = 'Time to Drink Water! — Tide';
    document.documentElement.classList.toggle('dark', theme === 'dark');

    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'CLOSE_ALL_POPUPS') {
        window.close();
      } else if (msg.type === 'STATE_SYNC') {
        setIntakeMl(msg.intakeMl);
        setGoalMl(msg.goalMl);
      }
    };
    return () => channel.close();
  }, [theme]);

  const sendMessageToMain = (msg: SyncMessage) => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        channel.postMessage(msg);
        channel.close();
      }
    } catch {
      // Ignore broadcast channel errors
    }

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(msg, window.location.origin);
      }
    } catch {
      // Ignore opener restrictions
    }
  };

  const handleLogAndClose = () => {
    setLogged(true);
    sendMessageToMain({ type: 'LOG_WATER', amountMl: 250, source: 'popup' });
    sendMessageToMain({ type: 'CLOSE_ALL_POPUPS' });
    window.setTimeout(() => {
      window.close();
    }, 120);
  };

  const handleDismiss = () => {
    sendMessageToMain({ type: 'DISMISS_ALERT' });
    sendMessageToMain({ type: 'CLOSE_ALL_POPUPS' });
    window.close();
  };

  const remainingMl = Math.max(0, goalMl - intakeMl);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-sky-950 text-white p-5 select-none">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sky-300 text-xs font-medium">
          <Droplets className="w-4 h-4 shrink-0" />
          <span>Tide Hydration Reminder</span>
          {screenTotal > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Display {screenNum}/{screenTotal}
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close reminder"
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-sky-200/80 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-sky-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* High-contrast prompt */}
      <div className="my-4 space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">
          Time to Drink Water!
        </h1>
        <p className="text-sm text-sky-100/90 leading-relaxed">
          Take a quick sip to stay sharp.{' '}
          <span className="font-mono tabular-nums text-sky-200">
            {intakeMl.toLocaleString()} / {goalMl.toLocaleString()} ml
          </span>
          {remainingMl > 0 && (
            <span className="text-sky-200/80">
              {' '}
              ({remainingMl.toLocaleString()} ml left)
            </span>
          )}
        </p>
      </div>

      {/* Primary action */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleLogAndClose}
          disabled={logged}
          className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 active:scale-[0.98] text-slate-950 font-semibold text-sm transition-all cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {logged ? 'Logged +250 ml' : 'Log +250ml & Close'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="min-h-[46px] px-4 py-2.5 rounded-xl border border-sky-700 hover:bg-sky-900 text-sky-100 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-300"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
