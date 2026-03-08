// Audio manager using Web Audio API to synthesize realistic radar sounds
class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Audio context is initialized on first user interaction
  }

  private init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.15; // Global volume
    this.isEnabled = true;
  }

  setMuted(muted: boolean) {
    if (!this.ctx) this.init();
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.15, this.ctx!.currentTime, 0.1);
    }
  }

  // Sutil blip de radar
  playBlip() {
    this.playSound(880, 'sine', 0.05, 0.1);
  }

  // Beep de selección
  playSelect() {
    this.playSound(1200, 'square', 0.03, 0.05);
  }

  // Estática de radio para comandos
  playRadio() {
    if (!this.ctx || !this.masterGain) this.init();
    const duration = 0.3;
    const bufferSize = this.ctx!.sampleRate * duration;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 2;

    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    
    noise.start();
  }

  // Alerta de proximidad (sutil pero perceptible)
  playWarning() {
    this.playSound(440, 'triangle', 0.2, 0.1);
    setTimeout(() => this.playSound(330, 'triangle', 0.2, 0.1), 150);
  }

  // Éxito al aterrizar
  playSuccess() {
    const now = this.ctx?.currentTime || 0;
    this.playSound(660, 'sine', 0.1, 0.1, 0);
    this.playSound(880, 'sine', 0.1, 0.1, 0.1);
    this.playSound(1320, 'sine', 0.2, 0.2, 0.2);
  }

  // Error o accidente
  playCrash() {
    this.playSound(150, 'sawtooth', 0.5, 0.3);
    this.playSound(100, 'sawtooth', 0.5, 0.5, 0.1);
  }

  private playSound(freq: number, type: OscillatorType, volume: number, duration: number, delay: number = 0) {
    if (!this.ctx || !this.masterGain) this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + delay);
    
    gain.gain.setValueAtTime(0, this.ctx!.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, this.ctx!.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(this.ctx!.currentTime + delay);
    osc.stop(this.ctx!.currentTime + delay + duration);
  }
}

export const audioManager = new AudioManager();
