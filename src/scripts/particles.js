/**
 * Lightweight, High-Performance Particle Engine for Hexxagon
 * - On-demand animation loop (0% idle CPU/GPU consumption)
 * - Zero heavy canvas shadowBlur filters for butter-smooth 60/120 FPS
 */

export class ParticleEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.shockwaves = [];
        this.animId = null;
        this.isRunning = false;
        this.width = 700;
        this.height = 700;
        this.resize();

        window.addEventListener('resize', () => this.resize());
        this.loop = this.loop.bind(this);
    }

    resize() {
        if (!this.canvas) return;
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = 700 * dpr;
        this.canvas.height = 700 * dpr;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
        this.width = 700;
        this.height = 700;
    }

    startLoop() {
        if (!this.isRunning) {
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
            alpha: 0.8,
            speed: 3.0,
            lineWidth: 2.5
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
                alpha: 0.9,
                size: Math.random() * 2 + 1.5,
                decay: 0.04,
                drag: 0.94
            });
        }
        this.startLoop();
    }

    createJumpTrail(fromX, fromY, toX, toY, color = '#00e5ff', count = 8) {
        for (let i = 0; i < count; i++) {
            const t = Math.random();
            const x = fromX + (toX - fromX) * t + (Math.random() - 0.5) * 12;
            const y = fromY + (toY - fromY) * t + (Math.random() - 0.5) * 12;
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                color,
                alpha: 0.75,
                size: Math.random() * 2 + 1,
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

    loop() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. Render Shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += sw.speed;
            sw.alpha *= 0.90;
            sw.lineWidth = Math.max(0.5, sw.lineWidth * 0.94);

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = sw.color;
            this.ctx.globalAlpha = Math.max(0, sw.alpha);
            this.ctx.lineWidth = sw.lineWidth;
            this.ctx.stroke();
            this.ctx.restore();

            if (sw.radius >= sw.maxRadius || sw.alpha <= 0.02) {
                this.shockwaves.splice(i, 1);
            }
        }

        // 2. Render Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= p.drag;
            p.vy *= p.drag;
            if (p.gravity) p.vy += p.gravity;
            p.alpha -= p.decay;

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = Math.max(0, p.alpha);
            this.ctx.fill();
            this.ctx.restore();

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }

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
        this.isRunning = false;
    }
}
