/**
 * Web Audio API Sound Synthesizer
 * High quality procedural audio for Hexxagon without external asset dependencies.
 */

export class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('hexxagon_muted') === 'true';
        this.volume = parseFloat(localStorage.getItem('hexxagon_volume') || '0.7');
    }

    init() {
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
        localStorage.setItem('hexxagon_muted', String(this.muted));
        return this.muted;
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        localStorage.setItem('hexxagon_volume', String(this.volume));
    }

    // Play tone helper
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
            console.warn('Audio playback error:', e);
        }
    }

    // Sound: Piece Selected
    playSelect() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

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
    }

    // Sound: Deselect
    playDeselect() {
        this.playTone(320, 'sine', 0.06, 0.15, -80);
    }

    // Sound: Duplicate / Clone
    playClone() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

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
    }

    // Sound: Jump (Teleport / Leap)
    playJump() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(940, now + 0.16);

        // Lowpass filter for smooth whoosh
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
    }

    // Sound: Capture / Conversion Zaps (Staggered chimes for each captured piece)
    playCapture(count = 1) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

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

            gain.gain.setValueAtTime(0.22 * this.volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.16);
        }
    }

    // Sound: Turn Pass (Trapped)
    playPass() {
        this.playTone(280, 'sine', 0.25, 0.2, -100);
    }

    // Sound: Game Win / Victory Fanfare
    playVictory() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

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
    }

    // Sound: Game Defeat Fanfare
    playDefeat() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

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
    }
}

export const sound = new SoundEngine();
