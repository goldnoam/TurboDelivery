

// Simple retro sound synthesizer using Web Audio API

let audioCtx: AudioContext | null = null;

const getCtx = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

export const initAudio = () => {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(e => console.error("Audio resume failed", e));
  }
};

const createOscillator = (type: OscillatorType, freq: number, duration: number, vol: number = 0.1) => {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
  
  return { osc, gain };
};

export const playCollectSound = () => {
  // High pitched "Ding"
  createOscillator('sine', 1200, 0.15, 0.15);
  // Subtle harmonic
  setTimeout(() => createOscillator('triangle', 2400, 0.1, 0.05), 50);
};

export const playPowerupSound = () => {
  const ctx = getCtx();
  if (!ctx) return;
  
  // Ascending major arpeggio
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.2);
  });
};

export const playShieldBreakSound = () => {
    const ctx = getCtx();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.4);
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
};

export const playMagnetSound = () => {
    // Electric hum pulse
    createOscillator('square', 220, 0.4, 0.05);
    createOscillator('sawtooth', 225, 0.4, 0.05);
};

// --- Specific Obstacle Sounds ---

export const playDogBark = () => {
    const ctx = getCtx();
    if (!ctx) return;
    
    // Short burst of noise/sawtooth
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
};

export const playCatScreech = () => {
    const ctx = getCtx();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
};

export const playCarHonk = () => {
     const ctx = getCtx();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
};

export const playGenericCrash = () => {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sawtooth';
  // Slide pitch down
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};

export const playPurchaseSound = () => {
  // "Cha-Ching"
  createOscillator('square', 800, 0.1, 0.1);
  setTimeout(() => createOscillator('square', 1200, 0.2, 0.1), 80);
};

export const playUpgradeSound = () => {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'triangle';
  // Slide pitch up
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);

  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};

export const playBoostSound = () => {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(50, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.5);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, ctx.currentTime);
  filter.frequency.linearRampToValueAtTime(2000, ctx.currentTime + 0.5);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.5);
};