/**
 * Hexagonal Mathematics Module (Pointy-topped Axial & Cube Coordinates)
 */

export class HexMath {
    static cube(q, r, s = -q - r) {
        return { q, r, s };
    }

    static key(q, r) {
        return `${q},${r}`;
    }

    static parseKey(key) {
        const [q, r] = key.split(',').map(Number);
        return { q, r, s: -q - r };
    }

    static distance(a, b) {
        const sA = a.s !== undefined ? a.s : -a.q - a.r;
        const sB = b.s !== undefined ? b.s : -b.q - b.r;
        return Math.max(
            Math.abs(a.q - b.q),
            Math.abs(a.r - b.r),
            Math.abs(sA - sB)
        );
    }

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

    static getNeighbors(center) {
        return HexMath.directions.map(dir => ({
            q: center.q + dir.q,
            r: center.r + dir.r,
            s: (center.s !== undefined ? center.s : -center.q - center.r) + dir.s
        }));
    }

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

    static hexToPixel(q, r, size, originX = 0, originY = 0) {
        const x = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r) + originX;
        const y = size * ((3 / 2) * r) + originY;
        return { x, y };
    }

    static getHexCorners(centerX, centerY, size) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angleDeg = 60 * i - 30; // Pointy-topped
            const angleRad = (Math.PI / 180) * angleDeg;
            points.push({
                x: centerX + size * Math.cos(angleRad),
                y: centerY + size * Math.sin(angleRad)
            });
        }
        return points;
    }

    static getHexPolygonPoints(centerX, centerY, size) {
        return HexMath.getHexCorners(centerX, centerY, size)
            .map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
            .join(' ');
    }
}
