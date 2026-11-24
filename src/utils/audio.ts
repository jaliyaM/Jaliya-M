import type { SoundTone } from '../types/hydration';

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

/**
 * Plays a clear, pleasant synthesized water-drop & harmonic chime sound via Web Audio API.
 */
export async function playHydrationSound(
  volume: number,
  muted: boolean,
  tone: SoundTone = 'droplet'
): Promise<boolean> {
  if (muted || volume <= 0.005) return false;

  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.min(1, Math.max(0.01, volume)), now);
    masterGain.connect(ctx.destination);

    if (tone === 'droplet') {
      // 1) Crisp water-drop "bloop" (fast upward pitch bend)
      const dropOsc = ctx.createOscillator();
      const dropGain = ctx.createGain();
      dropOsc.type = 'sine';
      dropOsc.frequency.setValueAtTime(520, now);
      dropOsc.frequency.exponentialRampToValueAtTime(1260, now + 0.085);
      dropGain.gain.setValueAtTime(0.001, now);
      dropGain.gain.linearRampToValueAtTime(0.45, now + 0.012);
      dropGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      dropOsc.connect(dropGain);
      dropGain.connect(masterGain);
      dropOsc.start(now);
      dropOsc.stop(now + 0.16);

      // 2) Second gentle droplet ripple
      const drop2Osc = ctx.createOscillator();
      const drop2Gain = ctx.createGain();
      drop2Osc.type = 'sine';
      drop2Osc.frequency.setValueAtTime(740, now + 0.14);
      drop2Osc.frequency.exponentialRampToValueAtTime(1580, now + 0.22);
      drop2Gain.gain.setValueAtTime(0.001, now + 0.14);
      drop2Gain.gain.linearRampToValueAtTime(0.32, now + 0.155);
      drop2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
      drop2Osc.connect(drop2Gain);
      drop2Gain.connect(masterGain);
      drop2Osc.start(now + 0.14);
      drop2Osc.stop(now + 0.32);

      // 3) Warm crystalline harmonic chime (E5 -> B5)
      const chimeNotes = [
        { freq: 659.25, start: 0.24, dur: 0.9, peak: 0.24 },
        { freq: 987.77, start: 0.34, dur: 1.05, peak: 0.2 },
      ];
      for (const note of chimeNotes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, now + note.start);
        gain.gain.setValueAtTime(0.001, now + note.start);
        gain.gain.linearRampToValueAtTime(note.peak, now + note.start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + note.start + note.dur);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + note.start);
        osc.stop(now + note.start + note.dur + 0.05);
      }
    } else if (tone === 'chime') {
      // Three-note bright glass arpeggio (C5 - E5 - G5)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const t = now + idx * 0.11;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.28, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.85);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.9);
      });
    } else {
      // Soft ocean swell chord (D5 + A5)
      const notes = [
        { freq: 587.33, start: 0, dur: 1.2 },
        { freq: 880.0, start: 0.16, dur: 1.3 },
      ];
      notes.forEach(({ freq, start, dur }) => {
        const t = now + start;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.26, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      });
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Plays a crisp, quiet feedback bloop when logging water manually.
 */
export async function playLogSipSound(volume: number, muted: boolean): Promise<void> {
  if (muted || volume <= 0.005) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.065);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.22, volume * 0.25), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch {
    // Ignore autoplay errors on secondary feedback
  }
}
