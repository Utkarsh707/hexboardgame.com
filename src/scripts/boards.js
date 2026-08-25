/**
 * Board Layout Definitions & Preset Arenas
 */

import { HexMath } from './hex-math.js';

export const PLAYERS = {
    ruby: { id: 'ruby', name: 'Ruby', color: '#ff3366', glowColor: '#ff0055', icon: '💎', secondaryColor: '#ff8fab' },
    pearl: { id: 'pearl', name: 'Pearl', color: '#00e5ff', glowColor: '#00b0ff', icon: '🔮', secondaryColor: '#e0f7fa' },
    emerald: { id: 'emerald', name: 'Emerald', color: '#10b981', glowColor: '#059669', icon: '🟢', secondaryColor: '#a7f3d0' }
};

export const BOARD_PRESETS = {
    classic: {
        id: 'classic',
        stageNumber: 1,
        stageTitle: 'STAGE 1 // ORBITAL VOID',
        name: 'Hexagon Classic (58 Cells)',
        description: 'The authentic 1993 hexagonal arena: Rubies vs Pearls in tactical duplication.',
        radius: 4,
        players: ['ruby', 'pearl'],
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
        stageNumber: 2,
        stageTitle: 'STAGE 2 // THE DONUT VOID',
        name: 'The Donut Void (48 Cells)',
        description: 'A circular battle ring with an impassable cosmic void in the center.',
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

    hourglass: {
        id: 'hourglass',
        stageNumber: 3,
        stageTitle: 'STAGE 3 // QUANTUM HOURGLASS',
        name: 'Quantum Hourglass (40 Cells)',
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
    },

    trio: {
        id: 'trio',
        stageNumber: 4,
        stageTitle: 'STAGE 4 // TRI-CHAMBER 3P',
        name: 'Tri-Chamber (61 Cells)',
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

    warp: {
        id: 'warp',
        stageNumber: 5,
        stageTitle: 'STAGE 5 // WARP NEXUS',
        name: 'Stage 5: Warp Nexus (84 Cells • Dynamic Wormholes)',
        description: 'An expansive cosmic arena with shifting Quantum Wormholes that spawn and despawn dynamically across the rift!',
        radius: 5,
        cellSize: 31,
        players: ['ruby', 'pearl'],
        generate: () => {
            const cells = new Set();
            const obstacles = new Set();
            const radius = 5;

            // Cosmic void rift channels
            const voidTiles = new Set([
                HexMath.key(0, 0),
                HexMath.key(1, -1),
                HexMath.key(-1, 1),
                HexMath.key(2, -2),
                HexMath.key(-2, 2),
                HexMath.key(0, -2),
                HexMath.key(0, 2)
            ]);

            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    const key = HexMath.key(q, r);
                    if (voidTiles.has(key)) {
                        obstacles.add(key);
                    } else {
                        cells.add(key);
                    }
                }
            }

            // 4 Starting Pieces per side across the outer wings and flanks
            const initialPieces = {
                // Rubies (Player 1)
                [HexMath.key(0, -5)]: 'ruby',
                [HexMath.key(-5, 5)]: 'ruby',
                [HexMath.key(5, 0)]: 'ruby',
                [HexMath.key(-2, -3)]: 'ruby',

                // Pearls (AI / Player 2)
                [HexMath.key(0, 5)]: 'pearl',
                [HexMath.key(5, -5)]: 'pearl',
                [HexMath.key(-5, 0)]: 'pearl',
                [HexMath.key(2, 3)]: 'pearl'
            };

            // Dynamic wormhole pairs will be spawned on initialization and periodically
            return {
                cells: Array.from(cells),
                initialPieces,
                obstacles: Array.from(obstacles),
                specialTiles: {}
            };
        }
    }
};
