/**
 * Board Layout Definitions & Preset Maps
 */

import { HexMath } from './hex-math.js';

export const PLAYERS = {
    RUBY: { id: 'ruby', name: 'Ruby', color: '#ff3366', glowColor: '#ff0055', icon: '💎' },
    PEARL: { id: 'pearl', name: 'Pearl', color: '#00e5ff', glowColor: '#00c3ff', icon: '🔮' },
    EMERALD: { id: 'emerald', name: 'Emerald', color: '#00ff88', glowColor: '#00e676', icon: '🟢' }
};

export const BOARD_PRESETS = {
    classic: {
        id: 'classic',
        name: 'Classic Hexagon (58 Cells)',
        description: 'The original 1993 hexagonal arena of Rubies vs Pearls.',
        radius: 4,
        players: ['ruby', 'pearl'],
        generate: () => {
            const cells = new Set();
            const radius = 4;
            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    // Classic 58-cell Hexagon: remove the 3 extreme corners that are not part of 58 or keep all 61
                    // Standard Hexxagon has 58 cells (all 61 except 3 outer edges or corners) or full 61.
                    // Full 61 hex with radius 4 is classic.
                    cells.add(HexMath.key(q, r));
                }
            }

            // Starting pieces for 2 players at 3 alternating corners each
            const initialPieces = {
                // Rubies (Player 1)
                [HexMath.key(0, -4)]: 'ruby',
                [HexMath.key(-4, 4)]: 'ruby',
                [HexMath.key(4, 0)]: 'ruby',

                // Pearls (Player 2 / AI)
                [HexMath.key(4, -4)]: 'pearl',
                [HexMath.key(0, 4)]: 'pearl',
                [HexMath.key(-4, 0)]: 'pearl'
            };

            return { cells: Array.from(cells), initialPieces, obstacles: [] };
        }
    },

    ring: {
        id: 'ring',
        name: 'The Donut Void',
        description: 'A circular ring arena with an impassable cosmic void in the center.',
        radius: 4,
        players: ['ruby', 'pearl'],
        generate: () => {
            const cells = new Set();
            const obstacles = new Set();
            const radius = 4;

            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    const distFromCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
                    if (distFromCenter <= 1) {
                        obstacles.add(HexMath.key(q, r));
                    } else {
                        cells.add(HexMath.key(q, r));
                    }
                }
            }

            const initialPieces = {
                [HexMath.key(0, -4)]: 'ruby',
                [HexMath.key(-4, 4)]: 'ruby',
                [HexMath.key(4, 0)]: 'ruby',
                [HexMath.key(4, -4)]: 'pearl',
                [HexMath.key(0, 4)]: 'pearl',
                [HexMath.key(-4, 0)]: 'pearl'
            };

            return { cells: Array.from(cells), initialPieces, obstacles: Array.from(obstacles) };
        }
    },

    trio: {
        id: 'trio',
        name: 'Tri-Chamber (3 Players)',
        description: '3-Player free-for-all: Rubies vs Pearls vs Emeralds in a tactical battle.',
        radius: 4,
        players: ['ruby', 'pearl', 'emerald'],
        generate: () => {
            const cells = new Set();
            const radius = 4;
            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    cells.add(HexMath.key(q, r));
                }
            }

            const initialPieces = {
                // Ruby
                [HexMath.key(0, -4)]: 'ruby',
                [HexMath.key(0, 4)]: 'ruby',

                // Pearl
                [HexMath.key(-4, 0)]: 'pearl',
                [HexMath.key(4, -4)]: 'pearl',

                // Emerald
                [HexMath.key(-4, 4)]: 'emerald',
                [HexMath.key(4, 0)]: 'emerald'
            };

            return { cells: Array.from(cells), initialPieces, obstacles: [] };
        }
    },

    hourglass: {
        id: 'hourglass',
        name: 'Quantum Hourglass',
        description: 'Two battle zones connected by a perilous central bottleneck bridge.',
        radius: 4,
        players: ['ruby', 'pearl'],
        generate: () => {
            const cells = new Set();
            const obstacles = new Set();
            const radius = 4;

            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    // Cut out side flanks to create hourglass
                    if ((q <= -2 && r <= 0 && -q - r >= 2) || (q >= 2 && r >= 0 && -q - r <= -2)) {
                        obstacles.add(HexMath.key(q, r));
                    } else {
                        cells.add(HexMath.key(q, r));
                    }
                }
            }

            const initialPieces = {
                [HexMath.key(0, -4)]: 'ruby',
                [HexMath.key(-2, -2)]: 'ruby',
                [HexMath.key(2, -4)]: 'ruby',

                [HexMath.key(0, 4)]: 'pearl',
                [HexMath.key(2, 2)]: 'pearl',
                [HexMath.key(-2, 4)]: 'pearl'
            };

            return { cells: Array.from(cells), initialPieces, obstacles: Array.from(obstacles) };
        }
    }
};
