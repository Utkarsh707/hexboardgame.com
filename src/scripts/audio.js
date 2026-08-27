/**
 * Retro Arcade Chiptune Synthesizer & Sound Engine for Hexxagon
 * - Inspired by classic 80s/90s arcade legends (Space Invaders, Street Fighter, Galaga)
 * - Rock-solid lookahead Web Audio sequencer for jitter-free 128/138 BPM retro game music
 * - Crunchy noise-layer impacts, laser jumps, resonant square-wave combos, and victory fanfares
 */

export class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;

        this.muted = typeof window !== 'undefined' && localStorage.getItem('hexxagon_muted') === 'true';
        this.musicMuted = typeof window !== 'undefined' && localStorage.getItem('hexxagon_music_muted') === 'true';
        this.volume = typeof window !== 'undefined' ? parseFloat(localStorage.getItem('hexxagon_volume') || '0.7') : 0.7;

        // Music Sequencer State
        this.currentTrack = null;
        this.isPlayingMusic = false;
        this.schedulerTimer = null;
        this.currentStep = 0;
        this.nextStepTime = 0;
        this.tempo = 132; // BPM

        // Noise Buffer Cache for Arcade Drums & Impact Crunches
        this.noiseBuffer = null;

        if (typeof window !== 'undefined') {
            const unlock = () => {
                this.init();
                window.removeEventListener('pointerdown', unlock);
                window.removeEventListener('keydown', unlock);
                window.removeEventListener('touchstart', unlock);
            };
            window.addEventListener('pointerdown', unlock, { passive: true, once: true });
            window.addEventListener('keydown', unlock, { passive: true, once: true });
            window.addEventListener('touchstart', unlock, { passive: true, once: true });

            // Automatically pause audio when tab is minimized, switched, or phone is locked
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    if (this.ctx && this.ctx.state === 'running') {
                        this.ctx.suspend().catch(() => {});
                    }
                } else {
                    if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
                        this.ctx.resume().then(() => {
                            if (this.isPlayingMusic && this.ctx) {
                                this.nextStepTime = this.ctx.currentTime + 0.05;
                            }
                        }).catch(() => {});
                    }
                }
            });

            window.addEventListener('pagehide', () => {
                if (this.ctx && this.ctx.state === 'running') {
                    this.ctx.suspend().catch(() => {});
                }
            });

            window.addEventListener('pageshow', () => {
                if (!document.hidden && this.ctx && this.ctx.state === 'suspended' && !this.muted) {
                    this.ctx.resume().then(() => {
                        if (this.isPlayingMusic && this.ctx) {
                            this.nextStepTime = this.ctx.currentTime + 0.05;
                        }
                    }).catch(() => {});
                }
            });
        }
    }

    init() {
        if (typeof window === 'undefined') return;
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();

                // Master Bus
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
                this.masterGain.connect(this.ctx.destination);

                // SFX Sub-bus
                this.sfxGain = this.ctx.createGain();
                this.sfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
                this.sfxGain.connect(this.masterGain);

                // Music Sub-bus
                this.musicGain = this.ctx.createGain();
                this.musicGain.gain.setValueAtTime(this.musicMuted ? 0 : 0.38, this.ctx.currentTime);
                this.musicGain.connect(this.masterGain);

                // Precompute 1-second white noise buffer for retro percussion and impact crunch
                this.generateNoiseBuffer();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    generateNoiseBuffer() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (typeof window !== 'undefined') {
            localStorage.setItem('hexxagon_muted', String(this.muted));
        }
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
        }
        return this.muted;
    }

    toggleMusic() {
        this.musicMuted = !this.musicMuted;
        if (typeof window !== 'undefined') {
            localStorage.setItem('hexxagon_music_muted', String(this.musicMuted));
        }
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setValueAtTime(this.musicMuted ? 0 : 0.38, this.ctx.currentTime);
        }
        return this.musicMuted;
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        if (typeof window !== 'undefined') {
            localStorage.setItem('hexxagon_volume', String(this.volume));
        }
        if (this.masterGain && this.ctx && !this.muted) {
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        }
    }

    /* =========================================================================
       RETRO CHIPTUNE BGM TRACKER (Street Fighter / Space Invaders Inspired)
       ========================================================================= */

    startMusic(trackName = 'game') {
        this.init();
        if (this.currentTrack === trackName && this.isPlayingMusic) return;

        this.stopMusic();
        this.currentTrack = trackName;
        this.isPlayingMusic = true;
        this.currentStep = 0;

        if (!this.ctx) return;
        this.nextStepTime = this.ctx.currentTime + 0.05;
        this.tempo = trackName === 'menu' ? 122 : 136;

        this.scheduler();
    }

    stopMusic() {
        this.isPlayingMusic = false;
        if (this.schedulerTimer) {
            clearTimeout(this.schedulerTimer);
            this.schedulerTimer = null;
        }
    }

    scheduler() {
        if (!this.isPlayingMusic || !this.ctx) return;

        // If audio is muted, idle the scheduler lightly
        if (this.musicMuted || this.muted) {
            this.schedulerTimer = setTimeout(() => this.scheduler(), 200);
            return;
        }

        // Catch up if context was suspended or thread throttled to avoid note pile-up
        if (this.nextStepTime < this.ctx.currentTime) {
            this.nextStepTime = this.ctx.currentTime + 0.02;
        }

        const secondsPerStep = 60 / (this.tempo * 4); // 16th note duration
        const scheduleAheadTime = 0.25;

        while (this.nextStepTime < this.ctx.currentTime + scheduleAheadTime) {
            this.playStep(this.currentStep, this.nextStepTime);
            this.nextStepTime += secondsPerStep;
            this.currentStep = (this.currentStep + 1) % 32; // 2-bar 32-step loop
        }

        this.schedulerTimer = setTimeout(() => this.scheduler(), 60);
    }

    playStep(step, time) {
        if (!this.ctx || this.musicMuted || this.muted) return;

        if (this.currentTrack === 'menu') {
            this.playMenuTrackStep(step, time);
        } else if (this.currentTrack === 'space_invaders') {
            this.playSpaceInvadersTrackStep(step, time);
        } else if (this.currentTrack === 'kirby_mario') {
            this.playKirbyMarioTrackStep(step, time);
        } else if (this.currentTrack === 'tetris') {
            this.playTetrisTrackStep(step, time);
        } else if (this.currentTrack === 'cyberpunk' || this.currentTrack === 'game') {
            this.playCyberpunkTrackStep(step, time);
        } else {
            this.playCyberpunkTrackStep(step, time);
        }
    }

    // MENU BGM: Atmospheric Cyberpunk Arcade Select Screen (D Minor)
    playMenuTrackStep(step, time) {
        const step16 = step % 16;

        // 1. Hypnotic 8-bit Pulse Bassline (D minor / Bb / C)
        const bassNotes = [
            146.83, 0, 146.83, 0, 116.54, 0, 130.81, 146.83, // D3, Bb2, C3, D3
            146.83, 0, 174.61, 0, 130.81, 0, 116.54, 130.81  // D3, F3, C3, Bb2
        ];
        const bassFreq = bassNotes[step16];
        if (bassFreq > 0) {
            this.playChiptuneNote(bassFreq, 'sawtooth', time, 0.12, 0.18, 500);
        }

        // 2. Arpeggiated Space Chime (Pentatonic Celestial Echo)
        const arpNotes = [
            293.66, 349.23, 440.00, 523.25, 587.33, 440.00, 349.23, 293.66,
            349.23, 440.00, 523.25, 659.25, 587.33, 523.25, 440.00, 349.23
        ];
        const arpFreq = arpNotes[step16];
        if (arpFreq && step % 2 === 0) {
            this.playChiptuneNote(arpFreq, 'triangle', time, 0.10, 0.14, 1800);
        }

        // 3. Crisp Chiptune Hi-Hat Tick
        if (step % 2 === 0) {
            this.playRetroNoise(time, 0.03, 0.08, 6000);
        }
        // Soft kick on beat 1 and 3
        if (step16 === 0 || step16 === 8) {
            this.playRetroKick(time, 0.22);
        }
    }

    // THEME 1: SPACE INVADERS (1978 Arcade • 4-tone descending alien march & laser pulses)
    playSpaceInvadersTrackStep(step, time) {
        const step16 = step % 16;
        const beat4 = Math.floor(step16 / 4); // 0, 1, 2, 3

        // Iconic 4-Note Descending Alien Pulse: D2 -> C#2 -> C2 -> B1
        const marchNotes = [146.83, 138.59, 130.81, 123.47];
        if (step16 % 4 === 0) {
            const marchFreq = marchNotes[beat4];
            this.playChiptuneNote(marchFreq, 'square', time, 0.14, 0.28, 450);
            this.playRetroKick(time, 0.24);
        }

        // Space Laser Arpeggios & Radar Blips
        const laserArp = [
            0, 587.33, 0, 880.00, 0, 587.33, 0, 1174.66,
            0, 523.25, 0, 783.99, 0, 659.25, 880.00, 0
        ];
        const laserFreq = laserArp[step16];
        if (laserFreq > 0) {
            this.playChiptuneNote(laserFreq, 'sawtooth', time, 0.07, 0.13, 3200);
        }

        // Retro Arcade Crisp Noise Ticks
        if (step16 % 2 === 0) {
            this.playRetroNoise(time, 0.02, 0.07, 9000);
        }
        if (step16 === 4 || step16 === 12) {
            this.playRetroSnare(time, 0.20);
        }
    }

    // THEME 2: 8-BIT ODYSSEY (Kirby & Mario NES • Upbeat joyful bouncy chiptune arpeggio)
    playKirbyMarioTrackStep(step, time) {
        const step16 = step % 16;
        const bar = Math.floor(step / 16);

        // Bouncy Walking Bass in C Major / F Major
        const bassLine = (bar === 0) ? [
            130.81, 0, 164.81, 0, 196.00, 0, 220.00, 0, // C3, E3, G3, A3
            174.61, 0, 220.00, 0, 196.00, 0, 164.81, 0  // F3, A3, G3, E3
        ] : [
            174.61, 0, 220.00, 0, 261.63, 0, 220.00, 0, // F3, A3, C4, A3
            196.00, 0, 246.94, 0, 261.63, 0, 196.00, 0  // G3, B3, C4, G3
        ];
        const bassFreq = bassLine[step16];
        if (bassFreq > 0) {
            this.playChiptuneNote(bassFreq, 'triangle', time, 0.11, 0.26, 1200);
        }

        // Cheerful Bouncy Mario/Kirby 8-bit Lead Arpeggio
        const leadNotes = (bar === 0) ? [
            523.25, 0, 659.25, 783.99, 1046.50, 0, 783.99, 0,
            880.00, 0, 659.25, 0, 783.99, 659.25, 523.25, 0
        ] : [
            698.46, 0, 880.00, 1046.50, 1318.51, 0, 1046.50, 0,
            987.77, 0, 783.99, 0, 1046.50, 0, 1318.51, 1046.50
        ];
        const leadFreq = leadNotes[step16];
        if (leadFreq > 0) {
            this.playChiptuneNote(leadFreq, 'square', time, 0.08, 0.18, 3000);
        }

        // Playful Percussion
        this.playRetroNoise(time, 0.02, 0.05, 7000);
        if (step16 === 4 || step16 === 12) {
            this.playRetroSnare(time, 0.22);
        }
        if (step16 === 0 || step16 === 6 || step16 === 10) {
            this.playRetroKick(time, 0.24);
        }
    }

    // THEME 3: CYBERPUNK 2099 (Synthwave / Outrun • Driving 136 BPM cyberpunk bassline)
    playCyberpunkTrackStep(step, time) {
        const step16 = step % 16;
        const bar = Math.floor(step / 16);

        // Driving Slap-Bass Pulse (A1 -> C2 -> D2 -> F2 -> E2)
        const bassLine = [
            110.00, 110.00, 0, 110.00, 130.81, 0, 146.83, 110.00, // A2, C3, D3
            110.00, 110.00, 0, 174.61, 164.81, 0, 130.81, 146.83  // F3, E3, C3
        ];
        const bassFreq = bassLine[step16];
        if (bassFreq > 0) {
            this.playChiptuneNote(bassFreq, 'square', time, 0.09, 0.22, 900);
        }

        // High-Energy Arcade Melody & Arpeggio (Pulse Wave)
        const leadNotes = (bar === 0) ? [
            440.00, 0, 523.25, 0, 659.25, 0, 880.00, 0,
            783.99, 0, 659.25, 0, 587.33, 523.25, 440.00, 0
        ] : [
            523.25, 0, 659.25, 0, 783.99, 0, 1046.50, 0,
            880.00, 0, 783.99, 0, 659.25, 587.33, 523.25, 659.25
        ];

        const leadFreq = leadNotes[step16];
        if (leadFreq > 0) {
            this.playChiptuneNote(leadFreq, 'sawtooth', time, 0.08, 0.16, 2600);
        }

        // Arcade Percussion (Kick, Snare, Hi-Hat)
        this.playRetroNoise(time, 0.025, 0.06, 8000);
        if (step16 === 4 || step16 === 12) {
            this.playRetroSnare(time, 0.26);
        }
        if (step16 === 0 || step16 === 8 || step16 === 14) {
            this.playRetroKick(time, 0.28);
        }
    }

    // THEME 4: TETRIS MATRIX (1989 Block Arcade • Iconic Korobeiniki folk melody)
    playTetrisTrackStep(step, time) {
        const step16 = step % 16;
        const bar = Math.floor(step / 16);

        // Authentic Russian Folk Korobeiniki 8-Bit Lead Melody
        // Bar 1: E4, B3, C4, D4, C4, B3, A3, A3, C4, E4, D4, C4, B3
        // Bar 2: C4, D4, E4, C4, A3, A3, D4, F4, A4, G4, F4, E4
        const korobeinikiNotes = (bar === 0) ? [
            659.25, 0, 493.88, 523.25, 587.33, 0, 523.25, 493.88, // E5, B4, C5, D5, C5, B4
            440.00, 0, 440.00, 523.25, 659.25, 0, 587.33, 523.25  // A4, A4, C5, E5, D5, C5
        ] : [
            493.88, 0, 523.25, 587.33, 659.25, 0, 523.25, 0,      // B4, C5, D5, E5, C5
            440.00, 0, 440.00, 0, 587.33, 698.46, 880.00, 783.99  // A4, A4, D5, F5, A5, G5
        ];

        const leadFreq = korobeinikiNotes[step16];
        if (leadFreq > 0) {
            this.playChiptuneNote(leadFreq, 'square', time, 0.09, 0.20, 2200);
        }

        // Iconic Russian Folk Polka Bassline (A2 -> E2 -> D2 -> G#2)
        const tetrisBass = (bar === 0) ? [
            110.00, 0, 82.41, 0, 146.83, 0, 82.41, 0,  // A2, E2, D3, E2
            110.00, 0, 82.41, 0, 103.83, 0, 82.41, 0   // A2, E2, G#2, E2
        ] : [
            103.83, 0, 82.41, 0, 110.00, 0, 130.81, 0, // G#2, E2, A2, C3
            110.00, 0, 82.41, 0, 146.83, 0, 164.81, 0  // A2, E2, D3, E3
        ];
        const bassFreq = tetrisBass[step16];
        if (bassFreq > 0) {
            this.playChiptuneNote(bassFreq, 'triangle', time, 0.10, 0.25, 800);
        }

        // Crisp Arcade Percussion
        this.playRetroNoise(time, 0.02, 0.05, 8500);
        if (step16 === 4 || step16 === 12) {
            this.playRetroSnare(time, 0.24);
        }
        if (step16 === 0 || step16 === 8) {
            this.playRetroKick(time, 0.26);
        }
    }

    playChiptuneNote(freq, type, time, duration, gainVal, filterFreq = 2000) {
        if (!this.ctx || !this.musicGain) return;
        try {
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, time);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(filterFreq, time);

            gain.gain.setValueAtTime(gainVal, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);

            osc.start(time);
            osc.stop(time + duration + 0.02);
        } catch (e) { }
    }

    playRetroKick(time, gainVal = 0.3) {
        if (!this.ctx || !this.musicGain) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140, time);
            osc.frequency.exponentialRampToValueAtTime(32, time + 0.12);

            gain.gain.setValueAtTime(gainVal, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

            osc.connect(gain);
            gain.connect(this.musicGain);

            osc.start(time);
            osc.stop(time + 0.14);
        } catch (e) { }
    }

    playRetroSnare(time, gainVal = 0.25) {
        if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
        try {
            // Noise component (crunch)
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2200, time);
            filter.Q.value = 1.5;

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(gainVal, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.musicGain);

            // Tonal snap component
            const osc = this.ctx.createOscillator();
            const toneGain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(240, time);
            osc.frequency.exponentialRampToValueAtTime(80, time + 0.08);

            toneGain.gain.setValueAtTime(gainVal * 0.7, time);
            toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

            osc.connect(toneGain);
            toneGain.connect(this.musicGain);

            noise.start(time);
            noise.stop(time + 0.15);
            osc.start(time);
            osc.stop(time + 0.09);
        } catch (e) { }
    }

    playRetroNoise(time, duration, gainVal, filterFreq = 5000) {
        if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
        try {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(filterFreq, time);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(gainVal, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);

            noise.start(time);
            noise.stop(time + duration + 0.01);
        } catch (e) { }
    }

    /* =========================================================================
       RETRO ARCADE SFX (Space Invaders, Street Fighter, Galaga Inspired)
       ========================================================================= */

    // 1. SELECT PIECE: Classic Street Fighter / Galaga crisp 2-tone cursor chirp
    playSelect() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880.00, now + 0.035); // A5

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now);
            osc.stop(now + 0.09);
        } catch (e) { }
    }

    // 2. DESELECT: Retro down-blip
    playDeselect() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);

            gain.gain.setValueAtTime(0.14, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now);
            osc.stop(now + 0.07);
        } catch (e) { }
    }

    // 3. CLONE MOVE: Space Invaders laser-pulse & crystal duplicate pop
    playClone() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        try {
            const now = this.ctx.currentTime;

            // Retro laser chirp
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'square';
            osc1.frequency.setValueAtTime(880, now);
            osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.07);

            gain1.gain.setValueAtTime(0.24, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc1.connect(gain1);
            gain1.connect(this.sfxGain);

            // Resonant body ping
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1174.66, now + 0.03); // D6
            osc2.frequency.exponentialRampToValueAtTime(1480, now + 0.14);

            gain2.gain.setValueAtTime(0.20, now + 0.03);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

            osc2.connect(gain2);
            gain2.connect(this.sfxGain);

            osc1.start(now);
            osc1.stop(now + 0.13);
            osc2.start(now + 0.03);
            osc2.stop(now + 0.17);
        } catch (e) { }
    }

    // 4. JUMP MOVE: Street Fighter Hadouken / Galaga tractor leap whoosh
    playJump() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        try {
            const now = this.ctx.currentTime;

            // Pitch-bend saw sweep
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(1100, now + 0.12);
            osc.frequency.exponentialRampToValueAtTime(320, now + 0.22);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, now);
            filter.frequency.exponentialRampToValueAtTime(3200, now + 0.12);
            filter.frequency.exponentialRampToValueAtTime(800, now + 0.22);
            filter.Q.value = 4;

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now);
            osc.stop(now + 0.24);

            // Background whoosh noise burst
            if (this.noiseBuffer) {
                const noise = this.ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;

                const nFilter = this.ctx.createBiquadFilter();
                nFilter.type = 'bandpass';
                nFilter.frequency.setValueAtTime(1200, now);
                nFilter.frequency.exponentialRampToValueAtTime(3800, now + 0.12);

                const nGain = this.ctx.createGain();
                nGain.gain.setValueAtTime(0.18, now);
                nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

                noise.connect(nFilter);
                nFilter.connect(nGain);
                nGain.connect(this.sfxGain);

                noise.start(now);
                noise.stop(now + 0.19);
            }
        } catch (e) { }
    }

    // 4.5. QUANTUM WARP: Cosmic Teleport Frequency Sweep & Crystal Dispersal
    playWarp() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        try {
            const now = this.ctx.currentTime;

            // 1. Ascending & Descending Frequency Rift Sweep
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(1840, now + 0.12);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.28);

            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(800, now);
            filter.frequency.exponentialRampToValueAtTime(3600, now + 0.12);
            filter.frequency.exponentialRampToValueAtTime(900, now + 0.28);
            filter.Q.value = 5.0;

            gain.gain.setValueAtTime(0.28, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now);
            osc.stop(now + 0.30);

            // 2. Crystal Harmonic Chime Ring
            const chime = this.ctx.createOscillator();
            const chimeGain = this.ctx.createGain();
            chime.type = 'triangle';
            chime.frequency.setValueAtTime(1318.51, now + 0.08); // E6
            chime.frequency.exponentialRampToValueAtTime(1760, now + 0.25);

            chimeGain.gain.setValueAtTime(0.20, now + 0.08);
            chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);

            chime.connect(chimeGain);
            chimeGain.connect(this.sfxGain);

            chime.start(now + 0.08);
            chime.stop(now + 0.31);
        } catch (e) { }
    }

    // 5. CAPTURE / INFECTION: Authentic 8-Bit Explosion Sound Effects (Multi-Variation)
    // Inspired by classic 8-Bit Explosions (Laser chirp, filtered noise crunch, sub thump & harmonic ringout)
    playCapture(count = 1) {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        // Choose explosion style based on capture count (single pop, double boom, or mega explosion)
        if (count === 1) {
            this.play8BitExplosionPop(0);
        } else if (count === 2) {
            this.play8BitArcadeBoom(0);
        } else {
            this.play8BitMegaExplosion(count);
        }
    }

    // Capture Chain Step Explosion (with crescendo harmonic pitch scaling)
    playCaptureStep(stepIndex = 0, totalCaptures = 1) {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        // Ascending harmonic major scale: C4, E4, G4, C5, E5, G5, C6
        const musicalScale = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        const pitchFreq = musicalScale[stepIndex % musicalScale.length] * Math.pow(1.25, Math.floor(stepIndex / musicalScale.length));

        // Musical harmonic overtone chime
        try {
            const now = this.ctx.currentTime;
            const harmonic = this.ctx.createOscillator();
            const harmGain = this.ctx.createGain();
            harmonic.type = 'triangle';
            harmonic.frequency.setValueAtTime(pitchFreq, now);
            harmonic.frequency.exponentialRampToValueAtTime(pitchFreq * 1.08, now + 0.14);

            harmGain.gain.setValueAtTime(0.20, now);
            harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

            harmonic.connect(harmGain);
            harmGain.connect(this.sfxGain);
            harmonic.start(now);
            harmonic.stop(now + 0.18);
        } catch (e) { }

        if (totalCaptures >= 3 && stepIndex === totalCaptures - 1) {
            // Climax explosion on final piece of a combo
            this.play8BitMegaExplosion(totalCaptures, stepIndex);
        } else if (stepIndex >= 1) {
            this.play8BitArcadeBoom(stepIndex);
        } else {
            this.play8BitExplosionPop(stepIndex);
        }
    }

    // Play Combo Announcement Power Chime (Double, Triple, Mega, Domination)
    playComboCallout(comboCount = 2) {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        try {
            const now = this.ctx.currentTime;

            if (comboCount === 2) {
                // Tier 1: Double Strike - Crisp, clean 2-tone melodic chime + mini sub
                const notes = [523.25, 659.25]; // C5, E5
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    const noteTime = now + idx * 0.05;

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, noteTime);
                    osc.frequency.exponentialRampToValueAtTime(freq * 1.03, noteTime + 0.28);

                    gain.gain.setValueAtTime(0.18, noteTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.32);

                    osc.connect(gain);
                    gain.connect(this.sfxGain);
                    osc.start(noteTime);
                    osc.stop(noteTime + 0.34);
                });

                // Soft sub kick
                const sub = this.ctx.createOscillator();
                const subGain = this.ctx.createGain();
                sub.type = 'sine';
                sub.frequency.setValueAtTime(65, now);
                sub.frequency.exponentialRampToValueAtTime(32, now + 0.12);
                subGain.gain.setValueAtTime(0.22, now);
                subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                sub.connect(subGain);
                subGain.connect(this.sfxGain);
                sub.start(now);
                sub.stop(now + 0.15);

            } else if (comboCount === 3) {
                // Tier 2: Triple Capture - Bright 3-note major arpeggio + resonant arcade bass
                const notes = [523.25, 783.99, 1046.50]; // C5, G5, C6
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    const noteTime = now + idx * 0.055;

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, noteTime);
                    osc.frequency.exponentialRampToValueAtTime(freq * 1.02, noteTime + 0.35);

                    gain.gain.setValueAtTime(0.22, noteTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.40);

                    osc.connect(gain);
                    gain.connect(this.sfxGain);
                    osc.start(noteTime);
                    osc.stop(noteTime + 0.42);
                });

                // Warm resonant sub boom
                const sub = this.ctx.createOscillator();
                const subGain = this.ctx.createGain();
                sub.type = 'triangle';
                sub.frequency.setValueAtTime(90, now);
                sub.frequency.exponentialRampToValueAtTime(35, now + 0.18);
                subGain.gain.setValueAtTime(0.30, now);
                subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
                sub.connect(subGain);
                subGain.connect(this.sfxGain);
                sub.start(now);
                sub.stop(now + 0.22);

            } else if (comboCount === 4) {
                // Tier 3: Mega Combo - Brassy synth fanfare arpeggio + noise swell + deep bass drop
                const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const filter = this.ctx.createBiquadFilter();
                    const gain = this.ctx.createGain();
                    const noteTime = now + idx * 0.05;

                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, noteTime);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(3200, noteTime);
                    filter.frequency.exponentialRampToValueAtTime(600, noteTime + 0.45);
                    filter.Q.value = 3.0;

                    gain.gain.setValueAtTime(0.20, noteTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.48);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.sfxGain);
                    osc.start(noteTime);
                    osc.stop(noteTime + 0.50);
                });

                // Heavy sub drop
                const sub = this.ctx.createOscillator();
                const subGain = this.ctx.createGain();
                sub.type = 'sawtooth';
                sub.frequency.setValueAtTime(120, now);
                sub.frequency.exponentialRampToValueAtTime(28, now + 0.26);
                subGain.gain.setValueAtTime(0.35, now);
                subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
                sub.connect(subGain);
                subGain.connect(this.sfxGain);
                sub.start(now);
                sub.stop(now + 0.30);

            } else {
                // Tier 4: Domination (5+) - Epic victory fanfare, seismic sub blast & crystal chime cascade
                const chordNotes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00]; // Full grand major stack
                chordNotes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const filter = this.ctx.createBiquadFilter();
                    const gain = this.ctx.createGain();
                    const noteTime = now + idx * 0.045;

                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, noteTime);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(4500, noteTime);
                    filter.frequency.exponentialRampToValueAtTime(800, noteTime + 0.65);
                    filter.Q.value = 4.0;

                    gain.gain.setValueAtTime(0.24, noteTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.68);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.sfxGain);
                    osc.start(noteTime);
                    osc.stop(noteTime + 0.70);
                });

                // Crystalline High Chimes Shower
                [2093.00, 2637.02, 3135.96, 4186.01].forEach((freq, idx) => {
                    const chime = this.ctx.createOscillator();
                    const cGain = this.ctx.createGain();
                    const chimeTime = now + 0.20 + idx * 0.06;

                    chime.type = 'sine';
                    chime.frequency.setValueAtTime(freq, chimeTime);
                    chime.frequency.exponentialRampToValueAtTime(freq * 1.05, chimeTime + 0.35);

                    cGain.gain.setValueAtTime(0.14, chimeTime);
                    cGain.gain.exponentialRampToValueAtTime(0.001, chimeTime + 0.38);

                    chime.connect(cGain);
                    cGain.connect(this.sfxGain);
                    chime.start(chimeTime);
                    chime.stop(chimeTime + 0.40);
                });

                // Seismic Sub-Bass Blast
                const sub = this.ctx.createOscillator();
                const subGain = this.ctx.createGain();
                sub.type = 'triangle';
                sub.frequency.setValueAtTime(150, now);
                sub.frequency.exponentialRampToValueAtTime(24, now + 0.38);
                subGain.gain.setValueAtTime(0.45, now);
                subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
                sub.connect(subGain);
                subGain.connect(this.sfxGain);
                sub.start(now);
                sub.stop(now + 0.45);
            }
        } catch (e) { }
    }

    // Variation A: Crisp 8-Bit Laser Pop & Crackle (Single target blast)
    play8BitExplosionPop(pitchStep = 0) {
        if (!this.ctx || !this.sfxGain) return;
        try {
            const now = this.ctx.currentTime;
            const pitchMult = Math.pow(1.12, pitchStep);

            // 1. Initial Fast 8-Bit Laser Chirp
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(1400 * pitchMult, now);
            osc.frequency.exponentialRampToValueAtTime(160 * pitchMult, now + 0.045);

            oscGain.gain.setValueAtTime(0.25, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc.connect(oscGain);
            oscGain.connect(this.sfxGain);

            osc.start(now);
            osc.stop(now + 0.07);

            // 2. 8-Bit Filtered Noise Sizzle Crunch
            if (this.noiseBuffer) {
                const noise = this.ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(2600 * pitchMult, now);
                filter.frequency.exponentialRampToValueAtTime(300, now + 0.11);
                filter.Q.value = 2.4;

                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(0.30, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

                noise.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(this.sfxGain);

                noise.start(now);
                noise.stop(now + 0.13);
            }

            // 3. Sub Impact Punch
            const sub = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            sub.type = 'triangle';
            sub.frequency.setValueAtTime(120 * pitchMult, now);
            sub.frequency.exponentialRampToValueAtTime(35, now + 0.07);

            subGain.gain.setValueAtTime(0.24, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            sub.connect(subGain);
            subGain.connect(this.sfxGain);

            sub.start(now);
            sub.stop(now + 0.09);
        } catch (e) { }
    }

    // Variation B: Deep 8-Bit Arcade Boom & Shockwave (Heavy double blast)
    play8BitArcadeBoom(pitchStep = 0) {
        if (!this.ctx || !this.sfxGain) return;
        try {
            const now = this.ctx.currentTime;
            const pitchMult = Math.pow(1.10, pitchStep);

            // 1. Dual-Sawtooth Power Sweep
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const oscGain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1100 * pitchMult, now);
            osc.frequency.exponentialRampToValueAtTime(75, now + 0.12);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3400 * pitchMult, now);
            filter.frequency.exponentialRampToValueAtTime(180, now + 0.14);
            filter.Q.value = 3.8;

            oscGain.gain.setValueAtTime(0.28, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(filter);
            filter.connect(oscGain);
            oscGain.connect(this.sfxGain);

            osc.start(now);
            osc.stop(now + 0.16);

            // 2. Deep 8-Bit Crunchy Noise Rumble
            if (this.noiseBuffer) {
                const noise = this.ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;

                const nFilter = this.ctx.createBiquadFilter();
                nFilter.type = 'lowpass';
                nFilter.frequency.setValueAtTime(2000 * pitchMult, now);
                nFilter.frequency.exponentialRampToValueAtTime(120, now + 0.18);
                nFilter.Q.value = 2.8;

                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(0.35, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

                noise.connect(nFilter);
                nFilter.connect(noiseGain);
                noiseGain.connect(this.sfxGain);

                noise.start(now);
                noise.stop(now + 0.20);
            }

            // 3. Sub Kick Punch
            const sub = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            sub.type = 'triangle';
            sub.frequency.setValueAtTime(95, now);
            sub.frequency.exponentialRampToValueAtTime(28, now + 0.11);

            subGain.gain.setValueAtTime(0.30, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            sub.connect(subGain);
            subGain.connect(this.sfxGain);

            sub.start(now);
            sub.stop(now + 0.13);
        } catch (e) { }
    }

    // Variation C: Heavy 8-Bit Super Explosion (3+ piece Mega Combo)
    play8BitMegaExplosion(comboCount = 3, pitchStep = 0) {
        if (!this.ctx || !this.sfxGain) return;
        try {
            const now = this.ctx.currentTime;
            const pitchMult = Math.pow(1.12, pitchStep);

            // 1. Initial 8-Bit Laser Crack
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(1800 * pitchMult, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.10);

            oscGain.gain.setValueAtTime(0.32, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(oscGain);
            oscGain.connect(this.sfxGain);

            osc.start(now);
            osc.stop(now + 0.13);

            // 2. Roaring Multi-Band 8-Bit Noise Detonation
            if (this.noiseBuffer) {
                const noise = this.ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;

                const nFilter = this.ctx.createBiquadFilter();
                nFilter.type = 'bandpass';
                nFilter.frequency.setValueAtTime(4200 * pitchMult, now);
                nFilter.frequency.exponentialRampToValueAtTime(160, now + 0.25);
                nFilter.Q.value = 3.2;

                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(0.40, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

                noise.connect(nFilter);
                nFilter.connect(noiseGain);
                noiseGain.connect(this.sfxGain);

                noise.start(now);
                noise.stop(now + 0.27);
            }

            // 3. Resonant Harmonic Ringout (Triumphant Arcade Chime)
            const ringOsc = this.ctx.createOscillator();
            const ringGain = this.ctx.createGain();
            ringOsc.type = 'triangle';
            ringOsc.frequency.setValueAtTime(587.33 * pitchMult, now + 0.04);
            ringOsc.frequency.exponentialRampToValueAtTime(880 * pitchMult, now + 0.22);

            ringGain.gain.setValueAtTime(0.22, now + 0.04);
            ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

            ringOsc.connect(ringGain);
            ringGain.connect(this.sfxGain);

            ringOsc.start(now + 0.04);
            ringOsc.stop(now + 0.25);

            // 4. Heavy Sub Boom
            const sub = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(110, now);
            sub.frequency.exponentialRampToValueAtTime(24, now + 0.16);

            subGain.gain.setValueAtTime(0.35, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            sub.connect(subGain);
            subGain.connect(this.sfxGain);

            sub.start(now);
            sub.stop(now + 0.19);
        } catch (e) { }
    }

    // 6. PASS TURN: Retro arcade warning buzzer
    playPass() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        try {
            const now = this.ctx.currentTime;
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc1.type = 'sawtooth';
            osc2.type = 'sawtooth';
            osc1.frequency.setValueAtTime(220, now);
            osc2.frequency.setValueAtTime(228, now); // Detuned for authentic buzzer beat

            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.sfxGain);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.23);
            osc2.stop(now + 0.23);
        } catch (e) { }
    }

    // 7. BOARD SWEEP POP: Ascending arcade arpeggio cascade
    playSweepPop(stepIndex, totalSteps = 20) {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        try {
            const now = this.ctx.currentTime;
            const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
            const freq = pentatonic[stepIndex % pentatonic.length] * Math.pow(1.5, Math.floor(stepIndex / pentatonic.length));

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + 0.06);

            gain.gain.setValueAtTime(0.24, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now);
            osc.stop(now + 0.08);
        } catch (e) { }
    }

    // 8. VICTORY FANFARE: 8-bar triumphant Street Fighter arcade victory stinger
    playVictory() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        try {
            const notes = [
                { f: 440.00, d: 0.10, t: 0 },
                { f: 440.00, d: 0.10, t: 0.10 },
                { f: 440.00, d: 0.10, t: 0.20 },
                { f: 554.37, d: 0.28, t: 0.30 }, // C#5
                { f: 493.88, d: 0.14, t: 0.58 }, // B4
                { f: 554.37, d: 0.14, t: 0.72 }, // C#5
                { f: 659.25, d: 0.45, t: 0.86 }, // E5
                { f: 880.00, d: 0.70, t: 1.30 }  // A5
            ];

            for (let i = 0; i < notes.length; i++) {
                const note = notes[i];
                const now = this.ctx.currentTime + note.t;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(note.f, now);

                gain.gain.setValueAtTime(0.26, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.d);

                osc.connect(gain);
                gain.connect(this.sfxGain);

                osc.start(now);
                osc.stop(now + note.d + 0.02);
            }
        } catch (e) { }
    }

    // 9. DEFEAT: Classic 8-bit minor descent
    playDefeat() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        try {
            const notes = [
                { f: 440.00, d: 0.20, t: 0 },
                { f: 415.30, d: 0.20, t: 0.20 },
                { f: 392.00, d: 0.20, t: 0.40 },
                { f: 329.63, d: 0.55, t: 0.60 }
            ];

            for (let i = 0; i < notes.length; i++) {
                const note = notes[i];
                const now = this.ctx.currentTime + note.t;
                const osc = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(note.f, now);

                filter.type = 'lowpass';
                filter.frequency.value = 650;

                gain.gain.setValueAtTime(0.24, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.d);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.sfxGain);

                osc.start(now);
                osc.stop(now + note.d + 0.02);
            }
        } catch (e) { }
    }
}

export const sound = new SoundEngine();
