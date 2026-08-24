/**
 * High-Performance Particle Engine for Hexxagon
 * Renders glowing energy bursts, shockwaves, cloning sparks, and conversion trails.
 */

export class ParticleEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.shockwaves = [];
        this.animId = null;
        this.resize();

        window.addEventListener('resize', () => this.resize());
        this.loop = this.loop.bind(this);
        this.loop();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.width = rect.width;
        this.height = rect.height;
    }

    createShockwave(x, y, color = '#ff3366', maxRadius = 70) {
        this.shockwaves.push({
            x, y,
            radius: 10,
            maxRadius,
            color,
            alpha: 0.9,
            speed: 3.5,
            lineWidth: 4
        });
    }

    createSparks(x, y, color = '#ff3366', count = 24, speedMult = 1) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.random() * 4 + 2) * speedMult;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                alpha: 1,
                size: Math.random() * 3.5 + 2,
                decay: Math.random() * 0.025 + 0.02,
                drag: 0.94
            });
        }
    }

    createJumpTrail(fromX, fromY, toX, toY, color = '#00e5ff', count = 16) {
        for (let i = 0; i < count; i++) {
            const t = Math.random();
            const x = fromX + (toX - fromX) * t + (Math.random() - 0.5) * 15;
            const y = fromY + (toY - fromY) * t + (Math.random() - 0.5) * 15;
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                color,
                alpha: 0.8,
                size: Math.random() * 3 + 1.5,
                decay: 0.035,
                drag: 0.96
            });
        }
    }

    createVictoryConfetti() {
        const colors = ['#ff3366', '#00e5ff', '#00ff88', '#ffea00', '#d500f9'];
        for (let i = 0; i < 90; i++) {
            const x = this.width * Math.random();
            const y = this.height * 0.4 + (Math.random() - 0.5) * 100;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 3;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                size: Math.random() * 5 + 3,
                decay: 0.012,
                drag: 0.98,
                gravity: 0.12
            });
        }
    }

    loop() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Render & update shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += sw.speed;
            sw.alpha *= 0.92;
            sw.lineWidth = Math.max(0.5, sw.lineWidth * 0.95);

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = sw.color;
            this.ctx.globalAlpha = Math.max(0, sw.alpha);
            this.ctx.lineWidth = sw.lineWidth;
            this.ctx.shadowColor = sw.color;
            this.ctx.shadowBlur = 12;
            this.ctx.stroke();
            this.ctx.restore();

            if (sw.radius >= sw.maxRadius || sw.alpha <= 0.02) {
                this.shockwaves.splice(i, 1);
            }
        }

        // Render & update particles
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
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = 10;
            this.ctx.fill();
            this.ctx.restore();

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }

        this.animId = requestAnimationFrame(this.loop);
    }

    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
    }
}
