/**
 * Hexagonal Mathematics Module (Axial and Cube Coordinates)
 * Pointy-topped hex orientation.
 */

export class HexMath {
    /**
     * Create cube coordinates (q, r, s) where q + r + s = 0
     */
    static cube(q, r, s = -q - r) {
        return { q, r, s };
    }

    /**
     * Axial to key string
     */
    static key(q, r) {
        return `${q},${r}`;
    }

    /**
     * Key string to axial object {q, r}
     */
    static parseKey(key) {
        const [q, r] = key.split(',').map(Number);
        return { q, r, s: -q - r };
    }

    /**
     * Calculate hex distance between two coordinates
     */
    static distance(a, b) {
        const sA = a.s !== undefined ? a.s : -a.q - a.r;
        const sB = b.s !== undefined ? b.s : -b.q - b.r;
        return Math.max(
            Math.abs(a.q - b.q),
            Math.abs(a.r - b.r),
            Math.abs(sA - sB)
        );
    }

    /**
     * 6 Direction vectors for pointy-topped hexagons
     */
    static get directions() {
        return [
            { q: 1, r: 0, s: -1 },
            { q: 1, r: -1, s: 0 },
            { q: 0, r: -1, s: 1 },
            { q: -1, r: 0, s: 1 },
            { q: -1, r: 1, s: 0 },
            { q: 0, r: 1, s: -1 }
        ];
    }

    /**
     * Get all hexes at exact distance 1 (6 neighbors)
     */
    static getNeighbors(center) {
        return HexMath.directions.map(dir => ({
            q: center.q + dir.q,
            r: center.r + dir.r,
            s: (center.s !== undefined ? center.s : -center.q - center.r) + dir.s
        }));
    }

    /**
     * Get all hexes within distance 1 or 2 (for move calculations)
     */
    static getReachableHexes(center, maxDistance = 2) {
        const results = [];
        for (let dq = -maxDistance; dq <= maxDistance; dq++) {
            for (let dr = Math.max(-maxDistance, -dq - maxDistance); dr <= Math.min(maxDistance, -dq + maxDistance); dr++) {
                const ds = -dq - dr;
                const dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
                if (dist > 0 && dist <= maxDistance) {
                    results.push({
                        q: center.q + dq,
                        r: center.r + dr,
                        s: (center.s !== undefined ? center.s : -center.q - center.r) + ds,
                        distance: dist,
                        type: dist === 1 ? 'clone' : 'jump'
                    });
                }
            }
        }
        return results;
    }

    /**
     * Convert axial coordinates (q, r) to pixel coordinates (x, y)
     * for Pointy-topped hexagons.
     * size = radius of the circumscribed circle (center to vertex)
     */
    static hexToPixel(q, r, size, originX = 0, originY = 0) {
        const x = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r) + originX;
        const y = size * ((3 / 2) * r) + originY;
        return { x, y };
    }

    /**
     * Calculate 6 corner points for SVG polygon rendering
     */
    static getHexCorners(centerX, centerY, size) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angleDeg = 60 * i - 30; // -30 deg produces pointy-topped hex
            const angleRad = (Math.PI / 180) * angleDeg;
            points.push({
                x: centerX + size * Math.cos(angleRad),
                y: centerY + size * Math.sin(angleRad)
            });
        }
        return points;
    }

    /**
     * Convert corner points to SVG polygon points string
     */
    static getHexPolygonPoints(centerX, centerY, size) {
        return HexMath.getHexCorners(centerX, centerY, size)
            .map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
            .join(' ');
    }
}
