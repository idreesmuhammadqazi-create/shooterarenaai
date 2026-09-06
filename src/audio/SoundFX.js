// SoundFX.js - 100% Procedurally Synthesized Web Audio Engine
// No external audio files required. Produces authentic COD-style gunshots, hitmarkers, explosions, footsteps, and tactical audio.

class SoundFX {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.voiceGain = null;
    
    this.sfxVolume = 0.8;
    this.musicVolume = 0.4;
    this.masterVolume = 1.0;
    
    this.heartbeatOsc = null;
    this.heartbeatInterval = null;
    this.isLowHealth = false;
    
    this.musicPlaying = false;
    this.musicTimer = null;
    this.musicStep = 0;
    
    this.chopperSound = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
      this.voiceGain.connect(this.masterGain);

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio init error:', e);
    }
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  // Helper: Create White Noise Buffer
  createNoiseBuffer(duration = 1.0) {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // --- WEAPON SOUNDS ---

  playGunshot(weaponType = 'm4', isPlayer = true, distance = 0) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const distFactor = isPlayer ? 1 : Math.max(0.1, 1 / (1 + distance * 0.08));
    const pan = isPlayer ? 0 : Math.max(-0.9, Math.min(0.9, (Math.random() - 0.5) * 1.5));

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) panner.pan.setValueAtTime(pan, t);

    const outNode = panner ? panner : this.sfxGain;
    if (panner) panner.connect(this.sfxGain);

    switch (weaponType.toLowerCase()) {
      case 'm4':
      case 'ar': {
        // Assault Rifle: Punchy snap + body crack + low thud
        // 1. Transient noise snap
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.25);
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1400, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(300, t + 0.15);
        noiseFilter.Q.setValueAtTime(2.5, t);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.9 * distFactor, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(outNode);
        noise.start(t);
        noise.stop(t + 0.2);

        // 2. Punch osc (pitch drop)
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.8 * distFactor, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

        osc.connect(oscGain);
        oscGain.connect(outNode);
        osc.start(t);
        osc.stop(t + 0.15);

        // 3. Sub punch
        const sub = this.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, t);
        sub.frequency.exponentialRampToValueAtTime(30, t + 0.18);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(1.0 * distFactor, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        sub.connect(subGain);
        subGain.connect(outNode);
        sub.start(t);
        sub.stop(t + 0.22);
        break;
      }

      case 'vector':
      case 'smg': {
        // SMG: Fast, snappy, high-frequency crack
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.15);
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(1800, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(500, t + 0.09);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.7 * distFactor, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(outNode);
        noise.start(t);
        noise.stop(t + 0.12);

        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(480, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.08);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.6 * distFactor, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc.connect(oscGain);
        oscGain.connect(outNode);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      }

      case 'striker':
      case 'shotgun': {
        // Shotgun: Huge explosive boom + wide spread noise
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.4);
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(3500, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(120, t + 0.35);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(1.2 * distFactor, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(outNode);
        noise.start(t);
        noise.stop(t + 0.4);

        const sub = this.ctx.createOscillator();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(190, t);
        sub.frequency.exponentialRampToValueAtTime(25, t + 0.3);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(1.4 * distFactor, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

        sub.connect(subGain);
        subGain.connect(outNode);
        sub.start(t);
        sub.stop(t + 0.35);
        break;
      }

      case 'vox50':
      case 'sniper': {
        // Sniper: Concussive thunderclap + long resonant tail
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.6);
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(2400, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(180, t + 0.5);
        noiseFilter.Q.setValueAtTime(1.8, t);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(1.5 * distFactor, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(outNode);
        noise.start(t);
        noise.stop(t + 0.6);

        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.35);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(1.2 * distFactor, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        osc.connect(oscGain);
        oscGain.connect(outNode);
        osc.start(t);
        osc.stop(t + 0.45);
        break;
      }

      case 'magnum':
      case 'pistol': {
        // Pistol / Revolver: Sharp metallic crack + punch
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.2);
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(1200, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(200, t + 0.12);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8 * distFactor, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(outNode);
        noise.start(t);
        noise.stop(t + 0.16);

        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(380, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.9 * distFactor, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(oscGain);
        oscGain.connect(outNode);
        osc.start(t);
        osc.stop(t + 0.14);
        break;
      }

      default:
        this.playGunshot('m4', isPlayer, distance);
    }
  }

  // --- HITMARKERS & DAMAGE ---

  playHitmarker(isHeadshot = false, isKill = false) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    if (isHeadshot) {
      // Crisp headshot "dink" chime
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1760, t); // A6
      osc1.frequency.exponentialRampToValueAtTime(2600, t + 0.06);

      const gain1 = this.ctx.createGain();
      gain1.gain.setValueAtTime(0.6, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc1.connect(gain1);
      gain1.connect(this.sfxGain);
      osc1.start(t);
      osc1.stop(t + 0.09);

      // Crunch transient
      const crunch = this.ctx.createBufferSource();
      crunch.buffer = this.createNoiseBuffer(0.05);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, t);
      filter.Q.setValueAtTime(5, t);

      const crunchGain = this.ctx.createGain();
      crunchGain.gain.setValueAtTime(0.4, t);
      crunchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      crunch.connect(filter);
      filter.connect(crunchGain);
      crunchGain.connect(this.sfxGain);
      crunch.start(t);
      crunch.stop(t + 0.06);
    } else {
      // Standard COD tick
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.04);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.06);
    }

    if (isKill) {
      // Confirmation bass thud on kill
      const killOsc = this.ctx.createOscillator();
      killOsc.type = 'sine';
      killOsc.frequency.setValueAtTime(220, t + 0.02);
      killOsc.frequency.exponentialRampToValueAtTime(60, t + 0.15);

      const killGain = this.ctx.createGain();
      killGain.gain.setValueAtTime(0.7, t + 0.02);
      killGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      killOsc.connect(killGain);
      killGain.connect(this.sfxGain);
      killOsc.start(t + 0.02);
      killOsc.stop(t + 0.2);
    }
  }

  playBulletImpact(surface = 'concrete') {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.08);

    const filter = this.ctx.createBiquadFilter();
    if (surface === 'metal') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2800, t);
      filter.Q.setValueAtTime(8, t);

      // Add high ping
      const ping = this.ctx.createOscillator();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(3200, t);
      ping.frequency.exponentialRampToValueAtTime(1800, t + 0.08);
      const pingGain = this.ctx.createGain();
      pingGain.gain.setValueAtTime(0.3, t);
      pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      ping.connect(pingGain);
      pingGain.connect(this.sfxGain);
      ping.start(t);
      ping.stop(t + 0.09);
    } else {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, t);
      filter.frequency.exponentialRampToValueAtTime(200, t + 0.06);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.08);
  }

  playPlayerHurt() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Heavy flesh impact & punch
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  // --- RELOAD & WEAPON ACTIONS ---

  playReloadPart(step = 'out') {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    switch (step) {
      case 'out': {
        // Magazine release click & slide
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.06);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.08);
        break;
      }
      case 'in': {
        // Magazine insert slam
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(90, t + 0.09);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.12);
        break;
      }
      case 'bolt': {
        // Cocking slide / bolt pull
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1100, t);
        osc.frequency.exponentialRampToValueAtTime(500, t + 0.08);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      }
      case 'pump': {
        // Shotgun pump action
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(250, t + 0.1);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.13);
        break;
      }
      case 'switch': {
        // Weapon swap rustle / ready
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.12);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1600, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.13);
        break;
      }
      case 'empty': {
        // Dry fire click
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.03);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
      }
    }
  }

  // --- FOOTSTEPS & MOVEMENT ---

  playFootstep(isSprinting = false, isCrouching = false) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const vol = isCrouching ? 0.08 : (isSprinting ? 0.35 : 0.2);
    const pitch = 90 + Math.random() * 40;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.06);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(pitch * 8, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.05);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.07);
  }

  playJump() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  playLand() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  playMelee() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Whoosh
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.18);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + 0.09);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.2);
  }

  // --- GRENADES & EXPLOSIONS ---

  playGrenadePin() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(1600, t + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playGrenadeBounce() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.05);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  playGrenadeBeep(frequency = 1200) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  playExplosion(distance = 0, isPlayerClose = false) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const distFactor = Math.max(0.1, 1 / (1 + distance * 0.04));

    // 1. Massive Low-end blast
    const sub = this.ctx.createOscillator();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(160, t);
    sub.frequency.exponentialRampToValueAtTime(20, t + 0.8);

    const subFilter = this.ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(300, t);
    subFilter.frequency.exponentialRampToValueAtTime(40, t + 0.8);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(1.8 * distFactor, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    sub.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(t);
    sub.stop(t + 1.3);

    // 2. Fireball rumble noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(1.4);
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2000, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(80, t + 1.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.4 * distFactor, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 1.5);

    // 3. Tinnitus ringing if player is very close (< 6m)
    if (isPlayerClose) {
      const ring = this.ctx.createOscillator();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(3800, t + 0.1);

      const ringGain = this.ctx.createGain();
      ringGain.gain.setValueAtTime(0.4, t + 0.1);
      ringGain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);

      ring.connect(ringGain);
      ringGain.connect(this.sfxGain);
      ring.start(t + 0.1);
      ring.stop(t + 2.6);
    }
  }

  // --- HEALTH & LOW-HP HEARTBEAT ---

  setLowHealthState(active) {
    if (this.isLowHealth === active) return;
    this.isLowHealth = active;

    if (active) {
      this.startHeartbeat();
    } else {
      this.stopHeartbeat();
    }
  }

  startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    const playBeat = () => {
      if (!this.ctx || !this.isLowHealth) return;
      const t = this.ctx.currentTime;
      // Lub-dub
      const beat1 = this.ctx.createOscillator();
      beat1.type = 'sine';
      beat1.frequency.setValueAtTime(90, t);
      beat1.frequency.exponentialRampToValueAtTime(35, t + 0.12);
      const g1 = this.ctx.createGain();
      g1.gain.setValueAtTime(0.8, t);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      beat1.connect(g1);
      g1.connect(this.sfxGain);
      beat1.start(t);
      beat1.stop(t + 0.15);

      const beat2 = this.ctx.createOscillator();
      beat2.type = 'sine';
      beat2.frequency.setValueAtTime(110, t + 0.16);
      beat2.frequency.exponentialRampToValueAtTime(30, t + 0.3);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.9, t + 0.16);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      beat2.connect(g2);
      g2.connect(this.sfxGain);
      beat2.start(t + 0.16);
      beat2.stop(t + 0.34);
    };

    playBeat();
    this.heartbeatInterval = setInterval(playBeat, 650);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // --- KILLSTREAKS & SPECIALS ---

  playUavSweep() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Radar ping
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  playAirstrikeIncoming() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Jet flyby whoosh + falling bomb whistle
    const jet = this.ctx.createBufferSource();
    jet.buffer = this.createNoiseBuffer(2.5);
    const jetFilter = this.ctx.createBiquadFilter();
    jetFilter.type = 'bandpass';
    jetFilter.frequency.setValueAtTime(300, t);
    jetFilter.frequency.exponentialRampToValueAtTime(2200, t + 1.2);
    jetFilter.frequency.exponentialRampToValueAtTime(200, t + 2.4);

    const jetGain = this.ctx.createGain();
    jetGain.gain.setValueAtTime(0.1, t);
    jetGain.gain.linearRampToValueAtTime(0.9, t + 1.0);
    jetGain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);

    jet.connect(jetFilter);
    jetFilter.connect(jetGain);
    jetGain.connect(this.sfxGain);
    jet.start(t);
    jet.stop(t + 2.6);

    // Whistle
    const whistle = this.ctx.createOscillator();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(2400, t + 0.8);
    whistle.frequency.exponentialRampToValueAtTime(450, t + 2.0);

    const whistleGain = this.ctx.createGain();
    whistleGain.gain.setValueAtTime(0.001, t + 0.8);
    whistleGain.gain.linearRampToValueAtTime(0.5, t + 1.4);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

    whistle.connect(whistleGain);
    whistleGain.connect(this.sfxGain);
    whistle.start(t + 0.8);
    whistle.stop(t + 2.1);
  }

  startChopperSound() {
    if (!this.ctx) this.init();
    if (!this.ctx || this.chopperSound) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, t);

    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(14, t); // Rotor blade speed

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(0.5, t);

    const mainGain = this.ctx.createGain();
    mainGain.gain.setValueAtTime(0.35, t);

    lfo.connect(mainGain.gain);
    osc.connect(mainGain);
    mainGain.connect(this.sfxGain);

    osc.start(t);
    lfo.start(t);

    this.chopperSound = { osc, lfo, gain: mainGain };
  }

  stopChopperSound() {
    if (this.chopperSound) {
      try {
        this.chopperSound.osc.stop();
        this.chopperSound.lfo.stop();
        this.chopperSound.gain.disconnect();
      } catch (e) {}
      this.chopperSound = null;
    }
  }

  playNukeAlarm() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Klaxon siren
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.5);
    osc.frequency.linearRampToValueAtTime(440, t + 1.0);
    osc.frequency.linearRampToValueAtTime(880, t + 1.5);
    osc.frequency.linearRampToValueAtTime(440, t + 2.0);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.Q.setValueAtTime(3, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 2.3);
  }

  // --- RADIO ANNOUNCER & VOICE CUES ---

  playVoiceCue(cueType) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Walkie-talkie squelch click
    const squelch = this.ctx.createBufferSource();
    squelch.buffer = this.createNoiseBuffer(0.04);
    const sFilter = this.ctx.createBiquadFilter();
    sFilter.type = 'bandpass';
    sFilter.frequency.setValueAtTime(2500, t);

    const sGain = this.ctx.createGain();
    sGain.gain.setValueAtTime(0.3, t);
    squelch.connect(sFilter);
    sFilter.connect(sGain);
    sGain.connect(this.voiceGain);
    squelch.start(t);

    // Procedural military radio chime/tones based on cue
    const tones = {
      uav: [440, 660, 880],
      airstrike: [330, 440, 550, 660],
      chopper: [220, 330, 440, 550],
      nuke: [880, 880, 880, 1100],
      streakReady: [523.25, 659.25, 783.99],
      roundStart: [261.63, 329.63, 392.00, 523.25],
      victory: [392.00, 523.25, 659.25, 783.99, 1046.50],
      defeat: [440, 392, 349, 311],
      waveClear: [440, 554, 659, 880]
    }[cueType] || [440, 660];

    tones.forEach((freq, i) => {
      const noteStart = t + 0.05 + i * 0.09;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteStart);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 1.5, noteStart);
      filter.Q.setValueAtTime(4, noteStart);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.voiceGain);
      osc.start(noteStart);
      osc.stop(noteStart + 0.13);
    });
  }

  // --- UI SOUNDS ---

  playUIClick() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.03);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playUIHover() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.02);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  playScorePopup() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, t); // B5
    osc.frequency.exponentialRampToValueAtTime(1318.51, t + 0.05); // E6

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // --- PROCEDURAL BACKGROUND SYNTH MUSIC ---

  startMenuMusic() {
    this.stopMusic();
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    this.musicPlaying = true;
    this.musicStep = 0;

    // Dark military synth bassline & arpeggio
    const bassline = [110, 110, 110, 130.81, 110, 110, 98, 123.47];
    const leadNotes = [440, 523.25, 659.25, 587.33, 440, 392, 523.25, 493.88];

    const playStep = () => {
      if (!this.musicPlaying || !this.ctx) return;
      const t = this.ctx.currentTime;
      const step = this.musicStep % 16;
      const bassIndex = Math.floor(step / 2) % bassline.length;

      // Bass note
      if (step % 2 === 0) {
        const bassOsc = this.ctx.createOscillator();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(bassline[bassIndex] / 2, t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, t);
        filter.frequency.exponentialRampToValueAtTime(150, t + 0.22);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

        bassOsc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        bassOsc.start(t);
        bassOsc.stop(t + 0.25);
      }

      // Arpeggio note
      if (step % 4 === 0 || step % 4 === 2) {
        const leadOsc = this.ctx.createOscillator();
        leadOsc.type = 'triangle';
        leadOsc.frequency.setValueAtTime(leadNotes[(step / 2) % leadNotes.length], t);

        const leadGain = this.ctx.createGain();
        leadGain.gain.setValueAtTime(0.08, t);
        leadGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        leadOsc.connect(leadGain);
        leadGain.connect(this.musicGain);
        leadOsc.start(t);
        leadOsc.stop(t + 0.2);
      }

      // Subtle hi-hat tick
      if (step % 2 === 1) {
        const hh = this.ctx.createBufferSource();
        hh.buffer = this.createNoiseBuffer(0.03);
        const hhFilter = this.ctx.createBiquadFilter();
        hhFilter.type = 'highpass';
        hhFilter.frequency.setValueAtTime(7000, t);

        const hhGain = this.ctx.createGain();
        hhGain.gain.setValueAtTime(0.04, t);
        hhGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

        hh.connect(hhFilter);
        hhFilter.connect(hhGain);
        hhGain.connect(this.musicGain);
        hh.start(t);
      }

      this.musicStep++;
    };

    this.musicTimer = setInterval(playStep, 135);
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const soundFX = new SoundFX();
