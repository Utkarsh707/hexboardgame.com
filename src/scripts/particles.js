/**
 * Lightweight, High-Performance Particle Engine for Hexxagon
 * - Precision 1:1 SVG coordinate matching (0..700 space)
 * - On-demand requestAnimationFrame loop (0% idle CPU/GPU consumption)
 * - Hardware-accelerated composite rendering
 */

export class ParticleEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;
        this.particles = [];
        this.shockwaves = [];
        this.animId = null;
        this.isRunning = false;
        this.width = 700;
        this.height = 700;
        this.dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

        this.resize();

        this.onResize = () => this.resize();
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this.onResize, { passive: true });
        }
        if (typeof ResizeObserver !== 'undefined' && canvas) {
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(canvas);
        }
        this.loop = this.loop.bind(this);
    }

    setViewBox(vx = 0, vy = 0, vw = 700, vh = 700) {
        this.vx = vx;
        this.vy = vy;
        this.vw = vw;
        this.vh = vh;
        this.resize();
    }

    resize() {
        if (!this.canvas || !this.ctx) return;
        this.dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width || 700;
        const displayHeight = rect.height || 700;

        const targetW = Math.round(displayWidth * this.dpr);
        const targetH = Math.round(displayHeight * this.dpr);
        if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
            this.canvas.width = targetW;
            this.canvas.height = targetH;
        }

        const vw = this.vw || 700;
        const vh = this.vh || 700;
        const vx = this.vx || 0;
        const vy = this.vy || 0;

        const scaleX = (displayWidth * this.dpr) / vw;
        const scaleY = (displayHeight * this.dpr) / vh;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(scaleX, scaleY);
        this.ctx.translate(-vx, -vy);
        this.width = vw;
        this.height = vh;
    }

    startLoop() {
        if (!this.isRunning && this.ctx) {
            this.isRunning = true;
            this.animId = requestAnimationFrame(this.loop);
        }
    }

    createShockwave(x, y, color = '#ff3366', maxRadius = 45) {
        this.shockwaves.push({
            x, y,
            radius: 8,
            maxRadius,
            color,
            alpha: 0.85,
            speed: 3.2,
            lineWidth: 2.5
        });
        this.startLoop();
    }

    createCaptureBurst(x, y, color = '#ff3366') {
        // 1. Expanding conversion shockwave ring
        this.shockwaves.push({
            x, y,
            radius: 6,
            maxRadius: 36,
            color,
            alpha: 1.0,
            speed: 2.8,
            lineWidth: 3.0
        });

        // 2. Radiating conversion gem sparks
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const speed = Math.random() * 2.5 + 2.0;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                alpha: 1.0,
                size: Math.random() * 2.5 + 2.0,
                decay: 0.04,
                drag: 0.93
            });
        }

        // 3. Central bright flash sparkle
        this.particles.push({
            x, y,
            vx: 0,
            vy: 0,
            color: '#ffffff',
            alpha: 0.9,
            size: 6,
            decay: 0.08,
            drag: 1.0
        });

        this.startLoop();
    }

    createSparks(x, y, color = '#ff3366', count = 8, speedMult = 1) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.random() * 3 + 1.5) * speedMult;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                alpha: 0.95,
                size: Math.random() * 2 + 1.5,
                decay: 0.045,
                drag: 0.94
            });
        }
        this.startLoop();
    }

    createJumpTrail(fromX, fromY, toX, toY, color = '#00e5ff', count = 10) {
        for (let i = 0; i < count; i++) {
            const t = Math.random();
            const x = fromX + (toX - fromX) * t + (Math.random() - 0.5) * 14;
            const y = fromY + (toY - fromY) * t + (Math.random() - 0.5) * 14;
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                color,
                alpha: 0.8,
                size: Math.random() * 2 + 1.2,
                decay: 0.045,
                drag: 0.95
            });
        }
        this.startLoop();
    }

    createVictoryConfetti() {
        const colors = ['#ff3366', '#00e5ff', '#10b981', '#f59e0b', '#a855f7'];
        for (let i = 0; i < 45; i++) {
            const x = this.width * Math.random();
            const y = this.height * 0.3 + (Math.random() - 0.5) * 80;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                size: Math.random() * 3.5 + 2,
                decay: 0.015,
                drag: 0.98,
                gravity: 0.1
            });
        }
        this.startLoop();
    }

    spawnVictoryFireworks(winningColor = '#ff2d60') {
        const bursts = [
            { x: this.width * 0.35, y: this.height * 0.35, delay: 0 },
            { x: this.width * 0.65, y: this.height * 0.30, delay: 180 },
            { x: this.width * 0.50, y: this.height * 0.60, delay: 360 },
            { x: this.width * 0.25, y: this.height * 0.70, delay: 540 },
            { x: this.width * 0.75, y: this.height * 0.75, delay: 720 }
        ];

        const palette = [winningColor, '#ffd000', '#00e5ff', '#ffffff', '#ff2d60', '#10b981'];

        bursts.forEach(b => {
            setTimeout(() => {
                this.createShockwave(b.x, b.y, winningColor, 75);
                const count = 28;
                for (let i = 0; i < count; i++) {
                    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
                    const speed = Math.random() * 4.5 + 2;
                    this.particles.push({
                        x: b.x,
                        y: b.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 1.5,
                        color: palette[Math.floor(Math.random() * palette.length)],
                        alpha: 1,
                        size: Math.random() * 3.5 + 2,
                        decay: 0.018,
                        drag: 0.97,
                        gravity: 0.08
                    });
                }
                this.startLoop();
            }, b.delay);
        });
    }

    loop() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. Render Shockwaves
        let activeShockwaves = 0;
        for (let i = 0; i < this.shockwaves.length; i++) {
            const sw = this.shockwaves[i];
            sw.radius += sw.speed;
            sw.alpha *= 0.90;
            sw.lineWidth = Math.max(0.5, sw.lineWidth * 0.94);

            if (sw.radius < sw.maxRadius && sw.alpha > 0.02) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                this.ctx.strokeStyle = sw.color;
                this.ctx.globalAlpha = Math.max(0, sw.alpha);
                this.ctx.lineWidth = sw.lineWidth;
                this.ctx.stroke();
                this.ctx.restore();

                this.shockwaves[activeShockwaves++] = sw;
            }
        }
        this.shockwaves.length = activeShockwaves;

        // 2. Render Particles
        let activeParticles = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= p.drag;
            p.vy *= p.drag;
            if (p.gravity) p.vy += p.gravity;
            p.alpha -= p.decay;

            if (p.alpha > 0) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fillStyle = p.color;
                this.ctx.globalAlpha = Math.max(0, p.alpha);
                this.ctx.fill();
                this.ctx.restore();

                this.particles[activeParticles++] = p;
            }
        }
        this.particles.length = activeParticles;

        // Stop loop when all effects have settled
        if (this.shockwaves.length === 0 && this.particles.length === 0) {
            this.ctx.clearRect(0, 0, this.width, this.height);
            this.isRunning = false;
            this.animId = null;
            return;
        }

        this.animId = requestAnimationFrame(this.loop);
    }

    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.onResize);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.isRunning = false;
    }
}
