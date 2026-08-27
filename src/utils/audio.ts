// Audio manager using Web Audio API to synthesize realistic radar sounds and VHF communications
class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMutedState: boolean = false;

  constructor() {
    // Audio context is initialized on first user interaction
  }

  private init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = this.isMutedState ? 0 : 0.15;
  }

  setMuted(muted: boolean) {
    this.isMutedState = muted;
    if (!this.ctx) return;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.15, this.ctx.currentTime, 0.05);
    }
  }

  // Sutil blip de barrido radar (profesional, suave)
  playBlip() {
    if (this.isMutedState) return;
    this.playSound(1046.5, 'sine', 0.03, 0.06); // C6 tone
  }

  // Beep de selección de aeronave / botón
  playSelect() {
    if (this.isMutedState) return;
    this.playSound(1318.5, 'sine', 0.04, 0.04); // E6 short click
  }

  // VHF Radio PTT click & squelch al transmitir comandos
  playRadio() {
    if (this.isMutedState) return;
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    
    // 1. Initial Mic Click
    this.playSound(2400, 'square', 0.05, 0.02, 0);

    // 2. Radio static noise burst
    const duration = 0.22;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(2.5, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    
    noise.start(now + 0.01);

    // 3. Trailing Mic Release Click
    setTimeout(() => {
      if (!this.isMutedState) {
        this.playSound(1800, 'triangle', 0.04, 0.02);
      }
    }, 220);
  }

  // Alerta de ILS capturado (Localizer Intercept)
  playIlsCapture() {
    if (this.isMutedState) return;
    this.playSound(880, 'sine', 0.06, 0.08, 0);
    this.playSound(1174.66, 'sine', 0.08, 0.12, 0.08); // D6
  }

  // Alerta de proximidad y conflicto STCA (Short Term Conflict Alert)
  playWarning() {
    if (this.isMutedState) return;
    this.playSound(750, 'square', 0.08, 0.1, 0);
    this.playSound(550, 'square', 0.08, 0.1, 0.12);
  }

  // Éxito al completar aterrizaje / salida
  playSuccess() {
    if (this.isMutedState) return;
    this.playSound(523.25, 'sine', 0.08, 0.08, 0);      // C5
    this.playSound(659.25, 'sine', 0.08, 0.08, 0.08);   // E5
    this.playSound(783.99, 'sine', 0.08, 0.08, 0.16);   // G5
    this.playSound(1046.5, 'sine', 0.12, 0.25, 0.24);   // C6
  }

  // Error o accidente (Alarma grave)
  playCrash() {
    if (this.isMutedState) return;
    this.playSound(160, 'sawtooth', 0.2, 0.35, 0);
    this.playSound(110, 'sawtooth', 0.25, 0.45, 0.08);
  }

  private playSound(freq: number, type: OscillatorType, volume: number, duration: number, delay: number = 0) {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);
      
      gain.gain.setValueAtTime(0, this.ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + delay + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + duration);
    } catch {
      // Ignore audio synthesis errors on suspended context
    }
  }
}

export const audioManager = new AudioManager();

