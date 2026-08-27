/**
 * Board Layout Definitions (Maze Types) & Stage Themes
 */

import { HexMath } from './hex-math.js';

export const PLAYERS = {
    ruby: { id: 'ruby', name: 'Ruby', color: '#ff3366', glowColor: '#ff0055', icon: '💎', secondaryColor: '#ff8fab' },
    pearl: { id: 'pearl', name: 'Pearl', color: '#00e5ff', glowColor: '#00b0ff', icon: '🔮', secondaryColor: '#e0f7fa' },
    emerald: { id: 'emerald', name: 'Emerald', color: '#10b981', glowColor: '#059669', icon: '🟢', secondaryColor: '#a7f3d0' }
};

/**
 * 4 Distinct Retro Stage Themes inspired by legendary gaming eras:
 * 1. Space Invaders (1978 Taito / Phosphor Green & Alien Radar)
 * 2. Kirby / Mario NES (8-Bit Joyful Nintendo Pastel & Stars)
 * 3. Cyberpunk 2099 (Synthwave Neon Pink & Electric Cyan Grid)
 * 4. Tetris Matrix (1989 Tetromino RGB & Korobeiniki Arcade)
 */
export const STAGE_THEMES = {
    space_invaders: {
        id: 'space_invaders',
        stageNumber: 1,
        name: 'Space Invaders',
        stageTitle: 'STAGE 1 // SPACE INVADERS',
        subtitle: '1978 Arcade • Phosphor Radar & Alien Lasers',
        icon: '👾',
        badge: 'ARCADE 1978',
        bgmTrack: 'space_invaders',
        themeClass: 'theme-space-invaders',
        tagline: 'Alien Invasion & Laser Radar Grid',
        colors: {
            bg: '#020906',
            cellFill: '#04140d',
            cellStroke: '#0d3824',
            cellHover: '#134e32',
            aura: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.16) 0%, rgba(255, 0, 128, 0.06) 45%, transparent 70%)',
            primaryAccent: '#00ff88',
            secondaryAccent: '#ff007f'
        },
        players: {
            ruby: {
                name: 'Invader Alpha',
                color: '#ff007f',
                glowColor: '#ff0055',
                icon: '👾',
                grad: ['#ff77b4', '#ff007f', '#b80058', '#5e002c', '#20000e'],
                markerColor: '#ff007f'
            },
            pearl: {
                name: 'Laser Saucer',
                color: '#00ff88',
                glowColor: '#00cc6a',
                icon: '🛸',
                grad: ['#ffffff', '#a7f3d0', '#00ff88', '#059669', '#022c22'],
                markerColor: '#00ff88'
            },
            emerald: {
                name: 'Alien Scout',
                color: '#76ff03',
                glowColor: '#64dd17',
                icon: '👾',
                grad: ['#e4ff99', '#76ff03', '#43a047', '#1b5e20', '#0a270c'],
                markerColor: '#76ff03'
            }
        }
    },

    kirby_mario: {
        id: 'kirby_mario',
        stageNumber: 2,
        name: '8-Bit Odyssey',
        stageTitle: 'STAGE 2 // 8-BIT ODYSSEY',
        subtitle: 'Joyful NES • Kirby Star & Mario Power-Ups',
        icon: '🍄',
        badge: 'NES 8-BIT',
        bgmTrack: 'kirby_mario',
        themeClass: 'theme-kirby-mario',
        tagline: 'Dreamy Kirby Pink & Super Mario Skies',
        colors: {
            bg: '#0a0718',
            cellFill: '#140e2b',
            cellStroke: '#33235d',
            cellHover: '#493085',
            aura: 'radial-gradient(circle at center, rgba(244, 114, 182, 0.16) 0%, rgba(56, 189, 248, 0.10) 45%, transparent 70%)',
            primaryAccent: '#f472b6',
            secondaryAccent: '#38bdf8'
        },
        players: {
            ruby: {
                name: 'Kirby Star',
                color: '#ff69b4',
                glowColor: '#f472b6',
                icon: '⭐',
                grad: ['#ffd1e3', '#ff69b4', '#db2777', '#831843', '#3d071e'],
                markerColor: '#ff69b4'
            },
            pearl: {
                name: 'Super Mario',
                color: '#38bdf8',
                glowColor: '#0284c7',
                icon: '🍄',
                grad: ['#ffffff', '#bae6fd', '#38bdf8', '#0284c7', '#082f49'],
                markerColor: '#38bdf8'
            },
            emerald: {
                name: '1-Up Yoshi',
                color: '#4ade80',
                glowColor: '#16a34a',
                icon: '🟢',
                grad: ['#bbf7d0', '#4ade80', '#16a34a', '#14532d', '#052e16'],
                markerColor: '#4ade80'
            }
        }
    },

    cyberpunk: {
        id: 'cyberpunk',
        stageNumber: 3,
        name: 'Cyberpunk 2099',
        stageTitle: 'STAGE 3 // CYBERPUNK 2099',
        subtitle: 'High-Tech Synthwave • Neon Pink & Cyber Cyan',
        icon: '⚡',
        badge: 'SYNTHWAVE',
        bgmTrack: 'cyberpunk',
        themeClass: 'theme-cyberpunk',
        tagline: 'Futuristic Chrome Grid & Electric Netrunners',
        colors: {
            bg: '#06020f',
            cellFill: '#100524',
            cellStroke: '#2f125a',
            cellHover: '#49198c',
            aura: 'radial-gradient(circle at center, rgba(0, 240, 255, 0.15) 0%, rgba(244, 63, 94, 0.09) 45%, transparent 70%)',
            primaryAccent: '#00f0ff',
            secondaryAccent: '#ff0055'
        },
        players: {
            ruby: {
                name: 'Cyber Core',
                color: '#ff0055',
                glowColor: '#f43f5e',
                icon: '⚡',
                grad: ['#ff7b96', '#ff0055', '#ba002c', '#5a0014', '#240008'],
                markerColor: '#ff0055'
            },
            pearl: {
                name: 'Netrunner Mesh',
                color: '#00f0ff',
                glowColor: '#00b0ff',
                icon: '🌐',
                grad: ['#ffffff', '#bdf7ff', '#00f0ff', '#0284c7', '#082f49'],
                markerColor: '#00f0ff'
            },
            emerald: {
                name: 'Matrix Daemon',
                color: '#00ff66',
                glowColor: '#059669',
                icon: '🟩',
                grad: ['#a7f3d0', '#00ff66', '#059669', '#064e3b', '#022c22'],
                markerColor: '#00ff66'
            }
        }
    },

    tetris: {
        id: 'tetris',
        stageNumber: 4,
        name: 'Tetris Matrix',
        stageTitle: 'STAGE 4 // TETRIS MATRIX',
        subtitle: '1989 Block Arcade • Tetromino RGB & Korobeiniki',
        icon: '🧱',
        badge: 'TETRIS 1989',
        bgmTrack: 'tetris',
        themeClass: 'theme-tetris',
        tagline: 'Iconic Russian Arcade Folk & Tetromino Blocks',
        colors: {
            bg: '#050713',
            cellFill: '#0a0f24',
            cellStroke: '#1b2853',
            cellHover: '#273c7e',
            aura: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.16) 0%, rgba(245, 158, 11, 0.09) 45%, transparent 70%)',
            primaryAccent: '#3b82f6',
            secondaryAccent: '#ef4444'
        },
        players: {
            ruby: {
                name: 'Tetromino Z/T',
                color: '#ef4444',
                glowColor: '#dc2626',
                icon: '🧱',
                grad: ['#fca5a5', '#ef4444', '#b91c1c', '#7f1d1d', '#450a0a'],
                markerColor: '#ef4444'
            },
            pearl: {
                name: 'Tetromino I/O',
                color: '#06b6d4',
                glowColor: '#0891b2',
                icon: '💎',
                grad: ['#cffafe', '#22d3ee', '#06b6d4', '#0e7490', '#164e63'],
                markerColor: '#06b6d4'
            },
            emerald: {
                name: 'Tetromino S',
                color: '#22c55e',
                glowColor: '#16a34a',
                icon: '🧩',
                grad: ['#bbf7d0', '#22c55e', '#16a34a', '#14532d', '#052e16'],
                markerColor: '#22c55e'
            }
        }
    }
};

/**
 * Maze Types / Arena Presets
 */
export const BOARD_PRESETS = {
    classic: {
        id: 'classic',
        mazeNumber: 1,
        name: 'Classic Hexagon (58 Cells)',
        shortName: 'Classic (58)',
        description: 'The authentic 1993 hexagonal arena: Rubies vs Pearls in tactical duplication.',
        radius: 4,
        cellsCount: 58,
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
        mazeNumber: 2,
        name: 'The Donut Void (48 Cells)',
        shortName: 'Donut Void (48)',
        description: 'A circular battle ring with an impassable cosmic void in the center.',
        radius: 4,
        cellsCount: 48,
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
        mazeNumber: 3,
        name: 'Quantum Hourglass (40 Cells)',
        shortName: 'Hourglass (40)',
        description: 'Two battle zones connected by a perilous central bottleneck bridge.',
        radius: 4,
        cellsCount: 40,
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
        mazeNumber: 4,
        name: 'Tri-Chamber (61 Cells)',
        shortName: 'Tri-Chamber (61)',
        description: '3-Player free-for-all: Rubies vs Pearls vs Emeralds in a tactical battle.',
        radius: 4,
        cellsCount: 61,
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
        mazeNumber: 5,
        name: 'Warp Nexus (84 Cells • Dynamic Wormholes)',
        shortName: 'Warp Nexus (84)',
        description: 'An expansive cosmic arena with shifting Quantum Wormholes that spawn and despawn dynamically across the rift!',
        radius: 5,
        cellsCount: 84,
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

            return {
                cells: Array.from(cells),
                initialPieces,
                obstacles: Array.from(obstacles),
                specialTiles: {}
            };
        }
    }
};

export const MAZE_PRESETS = BOARD_PRESETS;
