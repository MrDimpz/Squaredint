// Procedural Web Audio API sound synthesizer for tactile word puzzle feedback

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  constructor() {
    const savedMute = localStorage.getItem('missing_piece_muted');
    if (savedMute === 'true') {
      this.muted = true;
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('missing_piece_muted', String(this.muted));
    return this.muted;
  }

  // Ascending musical scale notes (C major / Lydian warm intervals)
  private readonly scaleNotes = [
    261.63, // C4
    293.66, // D4
    329.63, // E4
    370.00, // F#4
    392.00, // G4
    440.00, // A4
    493.88, // B4
    523.25, // C5
    587.33, // D5
    659.25, // E5
    739.99, // F#5
    783.99, // G5
  ];

  public playTileSelect(stepIndex: number) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freq = this.scaleNotes[Math.min(stepIndex, this.scaleNotes.length - 1)];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.015, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playBacktrack() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playWordFound(length: number, isFeatured: boolean = false) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = isFeatured
      ? [392.0, 493.88, 587.33, 783.99, 987.77] // G major 9th royal chord
      : length >= 6
        ? [329.63, 415.3, 493.88, 659.25] // E major bright
        : [261.63, 329.63, 392.0, 523.25]; // C major warm

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isFeatured ? 'triangle' : 'sine';
      const startTime = now + idx * 0.045;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + 0.34);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  public playBonusWord() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25]; // A major shimmer
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.04;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playInvalid() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(98, now + 0.14);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playAlreadyFound() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [311.13, 277.18].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.06;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.12);
    });
  }

  public playRotate() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.09);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playVictory() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const fanfare = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    fanfare.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.065;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.58);
    });
  }
}

export const soundEngine = new SoundEngine();
