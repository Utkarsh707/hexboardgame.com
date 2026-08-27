/**
 * Hexagonal Mathematics Module (Pointy-topped Axial & Cube Coordinates)
 * Highly optimized with precomputed trigonometry and zero-allocation coordinate helpers.
 */

const SQRT_3 = Math.sqrt(3);
const SQRT_3_DIV_2 = SQRT_3 / 2;

// Precomputed unit hex corner angles (pointy-topped: 60 * i - 30 deg)
const HEX_CORNER_COS = new Float64Array(6);
const HEX_CORNER_SIN = new Float64Array(6);
for (let i = 0; i < 6; i++) {
    const rad = ((60 * i - 30) * Math.PI) / 180;
    HEX_CORNER_COS[i] = Math.cos(rad);
    HEX_CORNER_SIN[i] = Math.sin(rad);
}

// 6 Axial Hexagonal Direction Vectors
const HEX_DIRECTIONS = Object.freeze([
    Object.freeze({ q: 1, r: 0, s: -1 }),
    Object.freeze({ q: 1, r: -1, s: 0 }),
    Object.freeze({ q: 0, r: -1, s: 1 }),
    Object.freeze({ q: -1, r: 0, s: 1 }),
    Object.freeze({ q: -1, r: 1, s: 0 }),
    Object.freeze({ q: 0, r: 1, s: -1 })
]);

export class HexMath {
    static cube(q, r, s = -q - r) {
        return { q, r, s };
    }

    static key(q, r) {
        return `${q},${r}`;
    }

    static parseKey(key) {
        const commaIdx = key.indexOf(',');
        const q = parseInt(key.substring(0, commaIdx), 10);
        const r = parseInt(key.substring(commaIdx + 1), 10);
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
        return HEX_DIRECTIONS;
    }

    static neighborCache = new Map();
    static reachableCache = new Map();

    static getNeighbors(center) {
        const cacheKey = `${center.q},${center.r}`;
        let cached = HexMath.neighborCache.get(cacheKey);
        if (cached) return cached;

        const cs = center.s !== undefined ? center.s : -center.q - center.r;
        const neighbors = new Array(6);
        for (let i = 0; i < 6; i++) {
            const dir = HEX_DIRECTIONS[i];
            neighbors[i] = Object.freeze({
                q: center.q + dir.q,
                r: center.r + dir.r,
                s: cs + dir.s
            });
        }
        Object.freeze(neighbors);
        HexMath.neighborCache.set(cacheKey, neighbors);
        return neighbors;
    }

    static getReachableHexes(center, maxDistance = 2) {
        const cacheKey = `${center.q},${center.r}_${maxDistance}`;
        let cached = HexMath.reachableCache.get(cacheKey);
        if (cached) return cached;

        const results = [];
        const cs = center.s !== undefined ? center.s : -center.q - center.r;

        for (let dq = -maxDistance; dq <= maxDistance; dq++) {
            const minR = Math.max(-maxDistance, -dq - maxDistance);
            const maxR = Math.min(maxDistance, -dq + maxDistance);
            for (let dr = minR; dr <= maxR; dr++) {
                const ds = -dq - dr;
                const dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
                if (dist > 0 && dist <= maxDistance) {
                    results.push(Object.freeze({
                        q: center.q + dq,
                        r: center.r + dr,
                        s: cs + ds,
                        distance: dist,
                        type: dist === 1 ? 'clone' : 'jump'
                    }));
                }
            }
        }
        Object.freeze(results);
        HexMath.reachableCache.set(cacheKey, results);
        return results;
    }

    static hexToPixel(q, r, size, originX = 0, originY = 0) {
        return {
            x: size * (SQRT_3 * q + SQRT_3_DIV_2 * r) + originX,
            y: size * (1.5 * r) + originY
        };
    }

    static getHexCorners(centerX, centerY, size) {
        const points = new Array(6);
        for (let i = 0; i < 6; i++) {
            points[i] = {
                x: centerX + size * HEX_CORNER_COS[i],
                y: centerY + size * HEX_CORNER_SIN[i]
            };
        }
        return points;
    }

    static getHexPolygonPoints(centerX, centerY, size) {
        let pts = '';
        for (let i = 0; i < 6; i++) {
            const px = (centerX + size * HEX_CORNER_COS[i]).toFixed(1);
            const py = (centerY + size * HEX_CORNER_SIN[i]).toFixed(1);
            pts += (i > 0 ? ' ' : '') + px + ',' + py;
        }
        return pts;
    }
}

