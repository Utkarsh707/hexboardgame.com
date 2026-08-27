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
        name: 'Cosmic Arena',
        stageTitle: 'COSMIC ARENA',
        subtitle: 'Ruby Crystals & Pearl Spheres',
        icon: '💎',
        badge: 'CLASSIC',
        bgmTrack: 'space_invaders',
        themeClass: 'theme-space-invaders',
        tagline: 'Cosmic Ruby & Pearl',
        colors: {
            bg: '#0b1021',
            cellFill: '#121a32',
            cellStroke: '#253358',
            cellHover: '#1c2a52',
            aura: 'radial-gradient(circle at center, rgba(0, 229, 255, 0.08) 0%, rgba(255, 45, 96, 0.05) 45%, transparent 70%)',
            primaryAccent: '#00e5ff',
            secondaryAccent: '#ff2d60'
        },
        players: {
            ruby: {
                name: 'Ruby',
                color: '#ff2d60',
                glowColor: '#ff0055',
                icon: '💎',
                grad: ['#ff7b96', '#ff0844', '#ba002c', '#680018', '#240008'],
                markerColor: '#ff2d60'
            },
            pearl: {
                name: 'Pearl',
                color: '#00e5ff',
                glowColor: '#00b0ff',
                icon: '🔮',
                grad: ['#ffffff', '#e0f2fe', '#38bdf8', '#0284c7', '#082f49'],
                markerColor: '#00e5ff'
            },
            emerald: {
                name: 'Emerald',
                color: '#10b981',
                glowColor: '#059669',
                icon: '🟢',
                grad: ['#a7f3d0', '#10b981', '#059669', '#064e3b', '#022c22'],
                markerColor: '#10b981'
            }
        }
    },

    kirby_mario: {
        id: 'kirby_mario',
        stageNumber: 2,
        name: 'Sunset Horizon',
        stageTitle: 'SUNSET HORIZON',
        subtitle: 'Warm Sunset Glow & Star Gems',
        icon: '🌅',
        badge: 'SUNSET',
        bgmTrack: 'kirby_mario',
        themeClass: 'theme-kirby-mario',
        tagline: 'Sunset Horizon',
        colors: {
            bg: '#0f1026',
            cellFill: '#19183b',
            cellStroke: '#383369',
            cellHover: '#2a275e',
            aura: 'radial-gradient(circle at center, rgba(244, 114, 182, 0.12) 0%, rgba(56, 189, 248, 0.08) 45%, transparent 70%)',
            primaryAccent: '#f472b6',
            secondaryAccent: '#38bdf8'
        },
        players: {
            ruby: {
                name: 'Solar Star',
                color: '#f43f5e',
                glowColor: '#e11d48',
                icon: '⭐',
                grad: ['#fda4af', '#f43f5e', '#be123c', '#881337', '#4c0519'],
                markerColor: '#f43f5e'
            },
            pearl: {
                name: 'Sky Crystal',
                color: '#38bdf8',
                glowColor: '#0284c7',
                icon: '🔷',
                grad: ['#ffffff', '#bae6fd', '#38bdf8', '#0284c7', '#082f49'],
                markerColor: '#38bdf8'
            },
            emerald: {
                name: 'Sunstone',
                color: '#fbbf24',
                glowColor: '#d97706',
                icon: '🟡',
                grad: ['#fef08a', '#fbbf24', '#d97706', '#92400e', '#451a03'],
                markerColor: '#fbbf24'
            }
        }
    },

    cyberpunk: {
        id: 'cyberpunk',
        stageNumber: 3,
        name: 'Cyber Neon',
        stageTitle: 'CYBER NEON',
        subtitle: 'Electric Synth & Laser Waves',
        icon: '⚡',
        badge: 'NEON',
        bgmTrack: 'cyberpunk',
        themeClass: 'theme-cyberpunk',
        tagline: 'Cyber Neon',
        colors: {
            bg: '#09081a',
            cellFill: '#151130',
            cellStroke: '#312560',
            cellHover: '#261b52',
            aura: 'radial-gradient(circle at center, rgba(0, 240, 255, 0.12) 0%, rgba(244, 63, 94, 0.08) 45%, transparent 70%)',
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
                name: 'Matrix Core',
                color: '#10b981',
                glowColor: '#059669',
                icon: '🟩',
                grad: ['#a7f3d0', '#10b981', '#059669', '#064e3b', '#022c22'],
                markerColor: '#10b981'
            }
        }
    },

    tetris: {
        id: 'tetris',
        stageNumber: 4,
        name: 'Ocean Depths',
        stageTitle: 'OCEAN DEPTHS',
        subtitle: 'Deep Azure & Coral Pearls',
        icon: '🌊',
        badge: 'OCEAN',
        bgmTrack: 'tetris',
        themeClass: 'theme-tetris',
        tagline: 'Ocean Depths',
        colors: {
            bg: '#060c1c',
            cellFill: '#0e1832',
            cellStroke: '#1f3465',
            cellHover: '#182b54',
            aura: 'radial-gradient(circle at center, rgba(56, 189, 248, 0.12) 0%, rgba(245, 158, 11, 0.06) 45%, transparent 70%)',
            primaryAccent: '#38bdf8',
            secondaryAccent: '#f43f5e'
        },
        players: {
            ruby: {
                name: 'Coral Gem',
                color: '#f43f5e',
                glowColor: '#e11d48',
                icon: '🪸',
                grad: ['#fda4af', '#f43f5e', '#be123c', '#881337', '#4c0519'],
                markerColor: '#f43f5e'
            },
            pearl: {
                name: 'Azure Pearl',
                color: '#06b6d4',
                glowColor: '#0891b2',
                icon: '💎',
                grad: ['#cffafe', '#22d3ee', '#06b6d4', '#0e7490', '#164e63'],
                markerColor: '#06b6d4'
            },
            emerald: {
                name: 'Seafoam',
                color: '#10b981',
                glowColor: '#059669',
                icon: '🌊',
                grad: ['#a7f3d0', '#10b981', '#059669', '#064e3b', '#022c22'],
                markerColor: '#10b981'
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
        name: 'Classic Hexxagon (58 Cells)',
        shortName: 'Classic (58)',
        description: 'The authentic 1993 hexagonal arena with 3 central void holes: Rubies vs Pearls.',
        radius: 4,
        cellsCount: 58,
        players: ['ruby', 'pearl'],
        generate: () => {
            const cells = new Set();
            const obstacles = new Set();
            const radius = 4;

            // Authentic 1993 3-Hole Triangular Void in Center
            const centerVoids = new Set([
                HexMath.key(0, -1),
                HexMath.key(-1, 1),
                HexMath.key(1, 0)
            ]);

            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    const key = HexMath.key(q, r);
                    if (centerVoids.has(key)) {
                        obstacles.add(key);
                    } else {
                        cells.add(key);
                    }
                }
            }

            // Authentic starting pieces at 6 corners (3 Rubies, 3 Pearls)
            const initialPieces = {
                // Rubies (Player 1) - Top-Left, Top-Right, Bottom-Center
                [HexMath.key(-4, 0)]: 'ruby',
                [HexMath.key(4, -4)]: 'ruby',
                [HexMath.key(0, 4)]: 'ruby',

                // Pearls (Player 2 / AI) - Top-Center, Bottom-Left, Bottom-Right
                [HexMath.key(0, -4)]: 'pearl',
                [HexMath.key(-4, 4)]: 'pearl',
                [HexMath.key(4, 0)]: 'pearl'
            };

            return { cells: Array.from(cells), initialPieces, obstacles: Array.from(obstacles) };
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

    triforce: {
        id: 'triforce',
        mazeNumber: 4,
        name: 'Tri-Nexus (49 Cells)',
        shortName: 'Tri-Nexus (49)',
        description: '3 distinct battle chambers linked through 3 triangular choke points.',
        radius: 4,
        cellsCount: 49,
        players: ['ruby', 'pearl'],
        generate: () => {
            const cells = new Set();
            const obstacles = new Set();
            const radius = 4;

            // Cutouts creating 3 pods
            const voidKeys = new Set([
                HexMath.key(0, 0), HexMath.key(0, -2), HexMath.key(-2, 0), HexMath.key(2, -2),
                HexMath.key(0, 2), HexMath.key(2, 0), HexMath.key(-2, 2),
                HexMath.key(-1, -1), HexMath.key(1, 1), HexMath.key(1, -2), HexMath.key(-1, 2), HexMath.key(-2, 1)
            ]);

            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    const key = HexMath.key(q, r);
                    if (voidKeys.has(key)) {
                        obstacles.add(key);
                    } else {
                        cells.add(key);
                    }
                }
            }

            const initialPieces = {
                [HexMath.key(0, -4)]: 'ruby',
                [HexMath.key(-4, 0)]: 'ruby',
                [HexMath.key(4, -4)]: 'ruby',

                [HexMath.key(0, 4)]: 'pearl',
                [HexMath.key(4, 0)]: 'pearl',
                [HexMath.key(-4, 4)]: 'pearl'
            };

            return { cells: Array.from(cells), initialPieces, obstacles: Array.from(obstacles) };
        }
    },

    trio: {
        id: 'trio',
        mazeNumber: 5,
        name: 'Tri-Chamber (61 Cells • 3 Players)',
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
    },

    // ==========================================
    // TUTORIAL SPECIFIC BOARD PRESETS
    // ==========================================
    tutorial_clone: {
        id: 'tutorial_clone',
        name: 'Lesson 1: Duplication (Clone)',
        shortName: 'CLONE TUTORIAL',
        description: 'Learn 1-step duplication move',
        cellsCount: 19,
        cellSize: 46,
        players: ['ruby', 'pearl'],
        generate: () => {
            const cells = new Set();
            const radius = 2;
            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    cells.add(HexMath.key(q, r));
                }
            }
            return {
                cells: Array.from(cells),
                initialPieces: {
                    [HexMath.key(0, 0)]: 'ruby'
                },
                obstacles: [],
                specialTiles: {}
            };
        }
    },

    tutorial_jump: {
        id: 'tutorial_jump',
        name: 'Lesson 2: Leap (Jump)',
        shortName: 'JUMP TUTORIAL',
        description: 'Learn 2-step jumping leap',
        cellsCount: 19,
        cellSize: 46,
        players: ['ruby', 'pearl'],
        generate: () => {
            const cells = new Set();
            const radius = 2;
            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    cells.add(HexMath.key(q, r));
                }
            }
            return {
                cells: Array.from(cells),
                initialPieces: {
                    [HexMath.key(-2, 0)]: 'ruby'
                },
                obstacles: [],
                specialTiles: {}
            };
        }
    },

    tutorial_infect: {
        id: 'tutorial_infect',
        name: 'Lesson 3: Conversion Attack',
        shortName: 'INFECTION TUTORIAL',
        description: 'Learn neighboring opponent capture',
        cellsCount: 19,
        cellSize: 46,
        players: ['ruby', 'pearl'],
        generate: () => {
            const cells = new Set();
            const radius = 2;
            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    cells.add(HexMath.key(q, r));
                }
            }
            return {
                cells: Array.from(cells),
                initialPieces: {
                    [HexMath.key(-2, 0)]: 'ruby',
                    [HexMath.key(0, -1)]: 'pearl',
                    [HexMath.key(0, 0)]: 'pearl',
                    [HexMath.key(0, 1)]: 'pearl'
                },
                obstacles: [],
                specialTiles: {}
            };
        }
    },

    tutorial_defense: {
        id: 'tutorial_defense',
        name: 'Lesson 4: Tactical Wall & Defense',
        shortName: 'TACTICS TUTORIAL',
        description: 'Learn cloning for safe defense walls',
        cellsCount: 19,
        cellSize: 46,
        players: ['ruby', 'pearl'],
        generate: () => {
            const cells = new Set();
            const radius = 2;
            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    cells.add(HexMath.key(q, r));
                }
            }
            return {
                cells: Array.from(cells),
                initialPieces: {
                    [HexMath.key(-1, 0)]: 'ruby',
                    [HexMath.key(-1, 1)]: 'ruby',
                    [HexMath.key(1, -1)]: 'pearl',
                    [HexMath.key(2, -2)]: 'pearl'
                },
                obstacles: [],
                specialTiles: {}
            };
        }
    },

    tutorial_mini: {
        id: 'tutorial_mini',
        name: 'Lesson 5: Practice Arena',
        shortName: 'PRACTICE ARENA',
        description: 'Mini live match against Training Bot',
        cellsCount: 19,
        cellSize: 46,
        players: ['ruby', 'pearl'],
        generate: () => {
            const cells = new Set();
            const radius = 2;
            for (let q = -radius; q <= radius; q++) {
                const r1 = Math.max(-radius, -q - radius);
                const r2 = Math.min(radius, -q + radius);
                for (let r = r1; r <= r2; r++) {
                    cells.add(HexMath.key(q, r));
                }
            }
            return {
                cells: Array.from(cells),
                initialPieces: {
                    [HexMath.key(-2, 0)]: 'ruby',
                    [HexMath.key(0, 2)]: 'ruby',
                    [HexMath.key(2, 0)]: 'pearl',
                    [HexMath.key(0, -2)]: 'pearl'
                },
                obstacles: [],
                specialTiles: {}
            };
        }
    }
};

export const MAZE_PRESETS = BOARD_PRESETS;

