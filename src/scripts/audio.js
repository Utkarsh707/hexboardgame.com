/**
 * Procedural Web Audio API Sound Synthesizer for Hexxagon
 * Click-free exponential envelopes, master gain routing, and seamless autoplay unlock.
 */

export class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.muted = typeof window !== 'undefined' && localStorage.getItem('hexxagon_muted') === 'true';
        this.volume = typeof window !== 'undefined' ? parseFloat(localStorage.getItem('hexxagon_volume') || '0.7') : 0.7;

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
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
                this.masterGain.connect(this.ctx.destination);
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
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

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        if (typeof window !== 'undefined') {
            localStorage.setItem('hexxagon_volume', String(this.volume));
        }
        if (this.masterGain && this.ctx && !this.muted) {
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        }
    }

    playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.3, pitchDrop = 0) {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            if (pitchDrop !== 0) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + pitchDrop), now + duration);
            }

            gain.gain.setValueAtTime(gainVal, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + duration + 0.01);
        } catch (e) { }
    }

    playSelect() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.09);
        } catch (e) { }
    }

    playDeselect() {
        this.playTone(320, 'sine', 0.06, 0.15, -80);
    }

    playClone() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        try {
            const now = this.ctx.currentTime;
            const freqs = [587.33, 880, 1174.66];
            for (let i = 0; i < freqs.length; i++) {
                const startTime = now + i * 0.035;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freqs[i], startTime);

                gain.gain.setValueAtTime(0.22, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start(startTime);
                osc.stop(startTime + 0.17);
            }
        } catch (e) { }
    }

    playJump() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(940, now + 0.16);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.frequency.exponentialRampToValueAtTime(2800, now + 0.16);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.21);
        } catch (e) { }
    }

    playCapture(count = 1) {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        try {
            const baseFreqs = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
            const numPieces = Math.min(count, baseFreqs.length);

            for (let i = 0; i < numPieces; i++) {
                const startTime = this.ctx.currentTime + i * 0.05;
                const osc = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(baseFreqs[i], startTime);
                osc.frequency.exponentialRampToValueAtTime(baseFreqs[i] * 1.5, startTime + 0.12);

                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(baseFreqs[i] * 1.8, startTime);
                filter.Q.value = 3;

                gain.gain.setValueAtTime(0.18, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.masterGain);

                osc.start(startTime);
                osc.stop(startTime + 0.17);
            }
        } catch (e) { }
    }

    playPass() {
        this.playTone(280, 'sine', 0.25, 0.2, -100);
    }

    playSweepPop(stepIndex, totalSteps = 20) {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        try {
            const now = this.ctx.currentTime;
            const baseFreq = 280;
            const pentatonic = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
            const semitone = pentatonic[stepIndex % pentatonic.length] + Math.floor(stepIndex / pentatonic.length) * 12;
            const freq = baseFreq * Math.pow(2, semitone / 12);

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + 0.07);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.08);
        } catch (e) { }
    }

    playVictory() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        try {
            const notes = [
                { f: 523.25, d: 0.12, t: 0 },
                { f: 659.25, d: 0.12, t: 0.12 },
                { f: 783.99, d: 0.12, t: 0.24 },
                { f: 1046.50, d: 0.45, t: 0.36 }
            ];

            for (let i = 0; i < notes.length; i++) {
                const note = notes[i];
                const now = this.ctx.currentTime + note.t;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.f, now);

                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.d);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start(now);
                osc.stop(now + note.d + 0.01);
            }
        } catch (e) { }
    }

    playDefeat() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || !this.masterGain) return;

        try {
            const notes = [
                { f: 440.00, d: 0.18, t: 0 },
                { f: 415.30, d: 0.18, t: 0.18 },
                { f: 392.00, d: 0.18, t: 0.36 },
                { f: 329.63, d: 0.50, t: 0.54 }
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
                filter.frequency.value = 600;

                gain.gain.setValueAtTime(0.22, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.d);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.masterGain);

                osc.start(now);
                osc.stop(now + note.d + 0.01);
            }
        } catch (e) { }
    }
}

export const sound = new SoundEngine();

