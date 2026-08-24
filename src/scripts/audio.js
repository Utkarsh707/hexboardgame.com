/**
 * Procedural Web Audio API Sound Synthesizer for Hexxagon
 */

export class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = typeof window !== 'undefined' && localStorage.getItem('hexxagon_muted') === 'true';
        this.volume = typeof window !== 'undefined' ? parseFloat(localStorage.getItem('hexxagon_volume') || '0.7') : 0.7;
    }

    init() {
        if (typeof window === 'undefined') return;
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (typeof window !== 'undefined') {
            localStorage.setItem('hexxagon_muted', String(this.muted));
        }
        return this.muted;
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        if (typeof window !== 'undefined') {
            localStorage.setItem('hexxagon_volume', String(this.volume));
        }
    }

    playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.3, pitchDrop = 0) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            if (pitchDrop !== 0) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + pitchDrop), now + duration);
            }

            const masterGain = gainVal * this.volume;
            gain.gain.setValueAtTime(masterGain, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {
            // Audio context policy guard
        }
    }

    playSelect() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);

            gain.gain.setValueAtTime(0.2 * this.volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.08);
        } catch (e) { }
    }

    playDeselect() {
        this.playTone(320, 'sine', 0.06, 0.15, -80);
    }

    playClone() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            [587.33, 880, 1174.66].forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, now + i * 0.04);

                gain.gain.setValueAtTime(0.25 * this.volume, now + i * 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.18);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now + i * 0.04);
                osc.stop(now + i * 0.04 + 0.18);
            });
        } catch (e) { }
    }

    playJump() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(940, now + 0.16);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.frequency.exponentialRampToValueAtTime(2800, now + 0.16);

            gain.gain.setValueAtTime(0.2 * this.volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.2);
        } catch (e) { }
    }

    playCapture(count = 1) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const baseFreqs = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
            const numPieces = Math.min(count, baseFreqs.length);

            for (let i = 0; i < numPieces; i++) {
                const delay = i * 0.06;
                const now = this.ctx.currentTime + delay;

                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(baseFreqs[i], now);
                osc.frequency.exponentialRampToValueAtTime(baseFreqs[i] * 1.5, now + 0.12);

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(baseFreqs[i] * 1.8, now);
                filter.Q.value = 3;

                gain.gain.setValueAtTime(0.2 * this.volume, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now);
                osc.stop(now + 0.16);
            }
        } catch (e) { }
    }

    playPass() {
        this.playTone(280, 'sine', 0.25, 0.2, -100);
    }

    playSweepPop(stepIndex, totalSteps = 20) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            // Pentatonic scale arpeggio for high-energy crystal pop sound
            const baseFreq = 280;
            const pentatonic = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
            const semitone = pentatonic[stepIndex % pentatonic.length] + Math.floor(stepIndex / pentatonic.length) * 12;
            const freq = baseFreq * Math.pow(2, semitone / 12);

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + 0.07);

            const vol = 0.28 * this.volume;
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.07);
        } catch (e) { }
    }

    playVictory() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const notes = [
                { f: 523.25, d: 0.12, t: 0 },
                { f: 659.25, d: 0.12, t: 0.12 },
                { f: 783.99, d: 0.12, t: 0.24 },
                { f: 1046.50, d: 0.45, t: 0.36 }
            ];

            notes.forEach(note => {
                const now = this.ctx.currentTime + note.t;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.f, now);

                gain.gain.setValueAtTime(0.35 * this.volume, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.d);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now);
                osc.stop(now + note.d);
            });
        } catch (e) { }
    }

    playDefeat() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const notes = [
                { f: 440.00, d: 0.18, t: 0 },
                { f: 415.30, d: 0.18, t: 0.18 },
                { f: 392.00, d: 0.18, t: 0.36 },
                { f: 329.63, d: 0.50, t: 0.54 }
            ];

            notes.forEach(note => {
                const now = this.ctx.currentTime + note.t;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(note.f, now);

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 600;

                gain.gain.setValueAtTime(0.25 * this.volume, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.d);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now);
                osc.stop(now + note.d);
            });
        } catch (e) {}
    }

    playPortal() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(1400, now + 0.18);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.35);

            gain.gain.setValueAtTime(0.35 * this.volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.35);
        } catch (e) {}
    }

    playSupernova() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const subOsc = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            subOsc.type = 'triangle';
            subOsc.frequency.setValueAtTime(160, now);
            subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.45);
            subGain.gain.setValueAtTime(0.5 * this.volume, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            subOsc.connect(subGain);
            subGain.connect(this.ctx.destination);
            subOsc.start(now);
            subOsc.stop(now + 0.45);

            [587.33, 880, 1174.66, 1760].forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 1600;

                osc.frequency.setValueAtTime(f, now + i * 0.05);
                gain.gain.setValueAtTime(0.3 * this.volume, now + i * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.3);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now + i * 0.05);
                osc.stop(now + i * 0.05 + 0.3);
            });
        } catch (e) {}
    }
}

export const sound = new SoundEngine();
