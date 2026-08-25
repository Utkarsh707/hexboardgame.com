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

        const secondsPerStep = 60 / (this.tempo * 4); // 16th note duration
        const scheduleAheadTime = 0.12;

        while (this.nextStepTime < this.ctx.currentTime + scheduleAheadTime) {
            this.playStep(this.currentStep, this.nextStepTime);
            this.nextStepTime += secondsPerStep;
            this.currentStep = (this.currentStep + 1) % 32; // 2-bar 32-step loop
        }

        this.schedulerTimer = setTimeout(() => this.scheduler(), 25);
    }

    playStep(step, time) {
        if (!this.ctx || this.musicMuted || this.muted) return;

        if (this.currentTrack === 'menu') {
            this.playMenuTrackStep(step, time);
        } else {
            this.playGameTrackStep(step, time);
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

    // GAME BGM: Fast, Addicting 136 BPM Arcade Tactical Loop (A Minor / Street Fighter Style)
    playGameTrackStep(step, time) {
        const step16 = step % 16;
        const bar = Math.floor(step / 16);

        // 1. Driving Slap-Bass Pulse (A1 -> C2 -> D2 -> F2 -> E2)
        const bassLine = [
            110.00, 110.00, 0, 110.00, 130.81, 0, 146.83, 110.00, // A2, C3, D3
            110.00, 110.00, 0, 174.61, 164.81, 0, 130.81, 146.83  // F3, E3, C3
        ];
        const bassFreq = bassLine[step16];
        if (bassFreq > 0) {
            this.playChiptuneNote(bassFreq, 'square', time, 0.09, 0.22, 900);
        }

        // 2. High-Energy Arcade Melody & Arpeggio (Pulse Wave)
        const leadNotes = (bar === 0) ? [
            440.00, 0, 523.25, 0, 659.25, 0, 880.00, 0,
            783.99, 0, 659.25, 0, 587.33, 523.25, 440.00, 0
        ] : [
            523.25, 0, 659.25, 0, 783.99, 0, 1046.50, 0,
            880.00, 0, 783.99, 0, 659.25, 587.33, 523.25, 659.25
        ];

        const leadFreq = leadNotes[step16];
        if (leadFreq > 0) {
            this.playChiptuneNote(leadFreq, 'square', time, 0.08, 0.16, 2400);
        }

        // 3. Arcade Percussion (Kick, Snare, Hi-Hat)
        // Hi-Hat on every 16th note
        this.playRetroNoise(time, 0.025, 0.06, 8000);

        // Punchy Chiptune Snare on beats 2 and 4 (step 4, 12)
        if (step16 === 4 || step16 === 12) {
            this.playRetroSnare(time, 0.26);
        }

        // 8-bit Pitch-Dropped Kick on beats 1 and 3 (step 0, 8, and syncopated step 14)
        if (step16 === 0 || step16 === 8 || step16 === 14) {
            this.playRetroKick(time, 0.28);
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

    // Capture Chain Step Explosion (for staggered chain conversions)
    playCaptureStep(stepIndex = 0, totalCaptures = 1) {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        if (totalCaptures >= 3 && stepIndex === totalCaptures - 1) {
            // Climax explosion on final piece of a combo
            this.play8BitMegaExplosion(totalCaptures, stepIndex);
        } else if (stepIndex >= 1) {
            this.play8BitArcadeBoom(stepIndex);
        } else {
            this.play8BitExplosionPop(stepIndex);
        }
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
