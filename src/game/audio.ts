import { TRACKS } from './content';
import type { SedimentId, ToolId, TrackSpec } from './types';

interface DigProfile {
  filter: BiquadFilterType;
  frequency: number;
  length: number;
  gain: number;
  pitch: number;
  type: OscillatorType;
  taps: number;
}

export const DIG_PROFILES: Record<SedimentId, DigProfile> = {
  sand: { filter: 'highpass', frequency: 1550, length: 0.1, gain: 0.13, pitch: 44, type: 'triangle', taps: 1 },
  'fine-sand': { filter: 'highpass', frequency: 3200, length: 0.13, gain: 0.1, pitch: 58, type: 'sine', taps: 1 },
  'wet-sand': { filter: 'lowpass', frequency: 720, length: 0.16, gain: 0.18, pitch: 33, type: 'triangle', taps: 1 },
  gravel: { filter: 'bandpass', frequency: 2250, length: 0.065, gain: 0.22, pitch: 66, type: 'square', taps: 3 },
  silt: { filter: 'bandpass', frequency: 1900, length: 0.12, gain: 0.11, pitch: 49, type: 'triangle', taps: 2 },
  loam: { filter: 'lowpass', frequency: 1120, length: 0.13, gain: 0.16, pitch: 38, type: 'triangle', taps: 2 },
  clay: { filter: 'lowpass', frequency: 480, length: 0.2, gain: 0.19, pitch: 28, type: 'sine', taps: 1 },
  'wet-clay': { filter: 'lowpass', frequency: 320, length: 0.24, gain: 0.22, pitch: 24, type: 'sine', taps: 2 },
};

export class SandAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private fxGain: GainNode | null = null;
  private nodes = new Set<AudioScheduledSourceNode>();

  public musicEnabled = true;
  public sfxEnabled = true;
  public volume = 0.32;
  private track: TrackSpec | null = TRACKS[0];
  private step = 0;
  private nextTime = 0;

  public unlock(): boolean {
    if (!this.context) {
      const AudioCtx =
        typeof window !== 'undefined'
          ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined;
      if (!AudioCtx) return false;
      try {
        this.context = new AudioCtx();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);

        this.musicGain = this.context.createGain();
        this.musicGain.gain.value = this.musicEnabled ? 1 : 0;
        this.musicGain.connect(this.master);

        this.fxGain = this.context.createGain();
        this.fxGain.connect(this.master);
      } catch {
        return false;
      }
    }
    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }
    return true;
  }

  public setTrack(id: string): void {
    if (this.track?.id === id) return;
    this.stopAll();
    this.track = TRACKS.find((t) => t.id === id) || TRACKS[0];
    this.step = 0;
    this.nextTime = 0;
  }

  public setMusic(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (this.musicGain && this.context) {
      this.musicGain.gain.setTargetAtTime(enabled ? 1 : 0, this.context.currentTime, 0.04);
    }
  }

  public setSfx(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  public setVolume(value: number): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) return;
    this.volume = value;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.03);
    }
  }

  public stopAll(): void {
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        // Already ended
      }
    }
    this.nodes.clear();
  }

  private playNote(
    midi: number,
    time: number,
    length: number,
    gain: number,
    type: OscillatorType = 'sine',
    isFx = false,
  ): void {
    const a = this.context;
    if (!a || a.state !== 'running' || this.nodes.size > 72) return;
    const osc = a.createOscillator();
    const filter = a.createBiquadFilter();
    const env = a.createGain();

    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    filter.type = 'lowpass';
    filter.frequency.value = type === 'square' ? 1400 : 2800;

    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, time + length);

    osc.connect(filter);
    filter.connect(env);
    env.connect(isFx ? this.fxGain! : this.musicGain!);

    osc.start(time);
    osc.stop(time + length + 0.03);
    this.nodes.add(osc);
    osc.onended = () => {
      this.nodes.delete(osc);
      osc.disconnect();
      filter.disconnect();
      env.disconnect();
    };
  }

  private playNoise(
    filterType: BiquadFilterType,
    frequency: number,
    time: number,
    length: number,
    gain: number,
    q = 0.65,
  ): void {
    const a = this.context;
    if (!a || a.state !== 'running' || this.nodes.size > 72) return;
    const samples = Math.max(1, Math.ceil(a.sampleRate * length));
    const buffer = a.createBuffer(1, samples, a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    }

    const src = a.createBufferSource();
    const filter = a.createBiquadFilter();
    const env = a.createGain();
    src.buffer = buffer;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;

    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, time + length);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.fxGain!);

    src.start(time);
    src.stop(time + length + 0.02);
    this.nodes.add(src);
    src.onended = () => {
      this.nodes.delete(src);
      src.disconnect();
      filter.disconnect();
      env.disconnect();
    };
  }

  public tick(active: boolean): void {
    const a = this.context;
    if (!a || a.state !== 'running') return;
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.musicEnabled && active ? 1 : 0, a.currentTime, 0.05);
    }
    if (!this.musicEnabled || !active || !this.track) {
      this.nextTime = 0;
      return;
    }

    const t = this.track;
    const stepTime = 60 / t.bpm / 2;
    if (!this.nextTime || this.nextTime < a.currentTime - 0.25) {
      this.nextTime = a.currentTime + 0.03;
    }

    while (this.nextTime < a.currentTime + 0.14) {
      const idx = this.step % t.notes.length;
      const n = t.notes[idx];
      const bass = t.bass[Math.floor(this.step / 8) % t.bass.length];
      if (n !== null) {
        this.playNote(t.root + n, this.nextTime, stepTime * 0.9, t.voice === 'square' ? 0.06 : 0.14, t.voice);
      }
      if (this.step % 4 === 0) {
        this.playNote(t.root - 24 + bass, this.nextTime, stepTime * 2.8, 0.14, 'triangle');
        this.playNote(t.root - 12 + bass + 7, this.nextTime, stepTime * 1.9, 0.038, 'sine');
        this.playNote(28, this.nextTime, 0.11, 0.2 * (t.drum || 1), 'sine');
      }
      if (this.step % 4 === 2) {
        this.playNote(43, this.nextTime, 0.05, 0.055 * (t.drum || 1), 'triangle');
      }
      this.step++;
      this.nextTime += stepTime;
    }
  }

  public playDig(sediment: SedimentId = 'sand', tool: ToolId = 'finger'): void {
    if (!this.sfxEnabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const p = DIG_PROFILES[sediment] || DIG_PROFILES.sand;
    const scale = tool === 'needle' ? 0.32 : tool === 'toothpick' ? 0.48 : tool === 'bothhands' ? 1.18 : 1;
    const jitter = 0.92 + Math.random() * 0.16;

    for (let i = 0; i < p.taps; i++) {
      this.playNoise(p.filter, p.frequency * jitter, now + i * 0.024, p.length, (p.gain * scale) / p.taps);
    }
    this.playNote(p.pitch + (Math.random() - 0.5) * 1.5, now, p.length, p.gain * 0.3 * scale, p.type, true);
  }

  public playCollapse(movedCount: number): void {
    if (!this.sfxEnabled || !this.context || this.context.state !== 'running' || movedCount <= 0) return;
    const now = this.context.currentTime;
    const intensity = Math.min(1, movedCount / 40);
    this.playNoise('lowpass', 320 + intensity * 420, now, 0.22 + intensity * 0.35, 0.16 + intensity * 0.2, 0.9);
    this.playNote(30, now, 0.25 + intensity * 0.2, 0.12 + intensity * 0.16, 'triangle', true);
  }

  public playDangerCreak(): void {
    if (!this.sfxEnabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    this.playNote(50, now, 0.18, 0.1, 'triangle', true);
    this.playNote(47, now + 0.09, 0.22, 0.08, 'sine', true);
  }

  public playFlagFall(): void {
    if (!this.sfxEnabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    this.playNoise('lowpass', 480, now, 0.55, 0.32, 0.7);
    this.playNote(29, now, 0.65, 0.42, 'triangle', true);
    this.playNote(34, now + 0.06, 0.72, 0.22, 'sine', true);
    this.playNote(24, now + 0.18, 0.5, 0.3, 'triangle', true);
  }

  public playTurnSwitch(): void {
    if (!this.sfxEnabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    this.playNote(72, now, 0.18, 0.15, 'sine', true);
    this.playNote(76, now + 0.09, 0.24, 0.13, 'sine', true);
  }

  public playVictory(): void {
    if (!this.sfxEnabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const chord = [60, 64, 67, 72, 76];
    chord.forEach((m, idx) => {
      this.playNote(m, now + idx * 0.08, 0.42, 0.16, 'triangle', true);
    });
  }
}
