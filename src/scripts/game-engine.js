/**
 * High-Performance Hexxagon Game State Controller & Native Vector VFX Board
 * - Native SVG vector infection beams, expanding rings, diamond sparks, and score pops
 * - 100% precision coordinate locking (zero canvas desync or DPI scaling drift)
 * - Incremental 60/120 FPS piece updates and authentic arcade game-feel
 */

import { HexMath } from './hex-math.js';
import { PLAYERS, BOARD_PRESETS, STAGE_THEMES } from './boards.js';
import { sound } from './audio.js';
import { HexxagonAI } from './ai.js';
import { ParticleEngine } from './particles.js';

export class HexxagonGame {
    constructor(options = {}) {
        this.svgContainer = document.getElementById('board-svg');
        this.particleCanvas = document.getElementById('particle-canvas');
        this.particleEngine = this.particleCanvas ? new ParticleEngine(this.particleCanvas) : null;
        this.ai = new HexxagonAI('medium');

        this.presetId = options.presetId || 'classic';
        this.themeId = options.themeId || 'space_invaders';
        this.gameMode = options.gameMode || 'pve-medium';
        this.isTutorialMode = false;

        this.state = null;
        this.history = [];
        this.selectedCell = null;
        this.validMoves = [];
        this.isAiTurn = false;
        this.isGameOver = false;
        this.cellSize = 38;
        this.originX = 350;
        this.originY = 350;

        // Cached DOM Elements for instantaneous O(1) lookups
        this.cellElements = new Map();
        this.pieceElements = new Map();
        this.activeThreatPieceElements = [];
        this.activeThreatCellElements = [];
        this.currentHoveredKey = null;

        this.listeners = {
            turnChange: [],
            scoreChange: [],
            gameOver: [],
            aiThinking: [],
            moveMade: [],
            soundToggle: []
        };

        this.initGame();
    }

    on(event, cb) {
        if (this.listeners[event]) {
            this.listeners[event].push(cb);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            const list = this.listeners[event];
            for (let i = 0; i < list.length; i++) {
                list[i](data);
            }
        }
    }

    initGame(presetId = this.presetId) {
        this.clearCapturePreviews();
        this.presetId = presetId;
        const preset = BOARD_PRESETS[presetId] || BOARD_PRESETS.classic;
        this.cellSize = preset.cellSize || 38;
        const boardData = preset.generate();

        this.state = {
            cells: boardData.cells,
            cellSet: new Set(boardData.cells),
            board: { ...boardData.initialPieces },
            obstacles: new Set(boardData.obstacles || []),
            specialTiles: { ...(boardData.specialTiles || {}) },
            players: preset.players,
            currentTurnIndex: 0,
            scores: this.calculateScores(boardData.initialPieces, preset.players),
            moveCount: 0
        };

        this.history = [];
        this.selectedCell = null;
        this.validMoves = [];
        this.lastMove = null;
        this.isGameOver = false;
        this.isAiTurn = false;

        if (this.gameMode.startsWith('pve-')) {
            const diff = this.gameMode.replace('pve-', '');
            this.ai.setDifficulty(diff);
        }

        this.warpCooldown = 0;
        this.renderBoard();

        // Spawn 1 initial dynamic wormhole pair on Warp Nexus
        if (this.presetId === 'warp') {
            this.spawnWormholePair(false);
        }

        this.notifyState();
    }

    setGameMode(mode) {
        this.gameMode = mode;
        if (mode === 'trio') {
            this.initGame('trio');
        } else {
            if (mode.startsWith('pve-')) {
                this.ai.setDifficulty(mode.replace('pve-', ''));
            }
            this.initGame(this.presetId === 'trio' ? 'classic' : this.presetId);
        }
    }

    setPreset(presetId) {
        this.initGame(presetId);
    }

    setTutorialMode(active) {
        this.isTutorialMode = !!active;
    }

    getTheme() {
        return STAGE_THEMES[this.themeId] || STAGE_THEMES.space_invaders;
    }

    getPlayerColor(player) {
        const theme = this.getTheme();
        return theme.players[player]?.color || PLAYERS[player]?.color || '#00e5ff';
    }

    setTheme(themeId) {
        if (STAGE_THEMES[themeId]) {
            this.themeId = themeId;
            this.renderBoard();
        }
    }

    calculateScores(board = this.state.board, players = this.state.players) {
        const scores = {};
        for (let i = 0; i < players.length; i++) {
            scores[players[i]] = 0;
        }
        for (const key in board) {
            const p = board[key];
            if (scores[p] !== undefined) {
                scores[p]++;
            }
        }
        return scores;
    }

    notifyState() {
        const currentTurn = this.getCurrentPlayer();
        const scores = this.calculateScores();
        this.state.scores = scores;

        this.emit('scoreChange', { scores, totalCells: this.state.cells.length });
        this.emit('turnChange', {
            currentPlayer: currentTurn,
            playerInfo: PLAYERS[currentTurn],
            moveCount: this.state.moveCount,
            isAi: this.isCurrentPlayerAi(),
            canUndo: this.canUndo()
        });
    }

    canUndo() {
        return !this.isGameOver && !this.isAiTurn && this.history && this.history.length > 0;
    }

    undo() {
        if (!this.canUndo()) return;

        // In PvE vs Computer, undo both the AI move and the player's last move so it's the player's turn again
        const isPvE = this.gameMode.startsWith('pve');
        let stepsToUndo = 1;
        if (isPvE && this.history.length >= 2) {
            stepsToUndo = 2;
        }

        let snapshot = null;
        for (let i = 0; i < stepsToUndo; i++) {
            if (this.history.length > 0) {
                snapshot = this.history.pop();
            }
        }

        if (!snapshot) return;

        this.state.board = { ...snapshot.board };
        this.state.currentTurnIndex = snapshot.currentTurnIndex;
        this.state.moveCount = snapshot.moveCount;
        if (snapshot.specialTiles) {
            this.state.specialTiles = JSON.parse(JSON.stringify(snapshot.specialTiles));
        }
        this.lastMove = snapshot.lastMove || null;
        this.selectedCell = null;
        this.validMoves = [];
        this.state.scores = this.calculateScores(this.state.board, this.state.players);

        sound.playSelect();
        this.renderBoard();
        this.notifyState();
    }

    getCurrentPlayer() {
        return this.state.players[this.state.currentTurnIndex];
    }

    isCurrentPlayerAi() {
        if (this.gameMode === 'pvp' || this.gameMode === 'tutorial') return false;
        if (this.gameMode.startsWith('pve-')) {
            return this.getCurrentPlayer() === 'pearl';
        }
        return false;
    }

    renderBoard() {
        if (!this.svgContainer) return;
        this.svgContainer.innerHTML = '';
        this.cellElements.clear();
        this.pieceElements.clear();
        this.activeThreatPieceElements = [];
        this.activeThreatCellElements = [];
        this.currentHoveredKey = null;

        const theme = this.getTheme();

        // Update Theme Attributes for CSS Styling
        if (this.svgContainer) {
            this.svgContainer.setAttribute('data-theme', this.themeId);
        }
        const boardViewport = document.getElementById('board-viewport');
        if (boardViewport) {
            boardViewport.setAttribute('data-theme', this.themeId);
        }
        const arenaContainer = document.querySelector('.board-arena-container');
        if (arenaContainer) {
            arenaContainer.setAttribute('data-theme', this.themeId);
        }

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        let gradsHtml = '';
        for (const [pId, pData] of Object.entries(theme.players)) {
            gradsHtml += `
                <!-- 3D ${pData.name} Radial Gradient -->
                <radialGradient id="grad-${pId}" cx="30%" cy="26%" r="72%">
                    <stop offset="0%" stop-color="${pData.grad[0]}"/>
                    <stop offset="22%" stop-color="${pData.grad[1]}"/>
                    <stop offset="60%" stop-color="${pData.grad[2]}"/>
                    <stop offset="90%" stop-color="${pData.grad[3]}"/>
                    <stop offset="100%" stop-color="${pData.grad[4]}"/>
                </radialGradient>
            `;
        }
        defs.innerHTML = gradsHtml;
        this.svgContainer.appendChild(defs);

        const cellsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        cellsGroup.setAttribute('id', 'hex-cells-group');

        const warpsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        warpsGroup.setAttribute('id', 'hex-warps-group');

        const piecesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        piecesGroup.setAttribute('id', 'hex-pieces-group');

        const movesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        movesGroup.setAttribute('id', 'hex-moves-group');

        const effectsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        effectsGroup.setAttribute('id', 'hex-effects-group');

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        const cells = this.state.cells;
        for (let i = 0; i < cells.length; i++) {
            const key = cells[i];
            const { q, r } = HexMath.parseKey(key);
            const { x, y } = HexMath.hexToPixel(q, r, this.cellSize, this.originX, this.originY);

            minX = Math.min(minX, x - this.cellSize);
            maxX = Math.max(maxX, x + this.cellSize);
            minY = Math.min(minY, y - this.cellSize);
            maxY = Math.max(maxY, y + this.cellSize);

            const points = HexMath.getHexPolygonPoints(x, y, this.cellSize - 1.2);
            const innerPoints = HexMath.getHexPolygonPoints(x, y, this.cellSize * 0.72);

            const cellGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            cellGroup.setAttribute('class', 'hex-cell-socket-group');

            // 1. Outer Beveled Socket Facet Rim
            const socketRim = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            socketRim.setAttribute('points', points);
            socketRim.setAttribute('class', 'hex-cell-rim');
            cellGroup.appendChild(socketRim);

            // 2. Inner Recessed Jewel Bed
            const innerBed = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            innerBed.setAttribute('points', innerPoints);
            innerBed.setAttribute('class', 'hex-cell-bed');
            cellGroup.appendChild(innerBed);

            // 3. Interactive Hex Cell Hit & Highlight Layer
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', points);
            polygon.setAttribute('data-key', key);
            polygon.setAttribute('class', 'hex-cell hex-cell-empty');
            polygon.setAttribute('role', 'button');
            polygon.setAttribute('aria-label', `Hex cell ${key}`);
            polygon.style.outline = 'none';

            if (this.lastMove) {
                if (key === this.lastMove.toKey) {
                    polygon.classList.add('hex-cell-last-dest');
                    const playerColor = this.getPlayerColor(this.lastMove.player);
                    polygon.style.stroke = playerColor;
                } else if (this.lastMove.type === 'jump' && key === this.lastMove.fromKey) {
                    polygon.classList.add('hex-cell-last-origin');
                }
            }

            polygon.addEventListener('click', () => this.handleCellClick(key));
            polygon.addEventListener('mouseenter', () => this.previewCaptures(key));
            polygon.addEventListener('mouseleave', () => this.clearCapturePreviews());

            this.cellElements.set(key, polygon);
            cellGroup.appendChild(polygon);
            cellsGroup.appendChild(cellGroup);

            // Render Piece if present
            const pieceOwner = this.state.board[key];
            if (pieceOwner) {
                const pieceEl = this.createPieceElement(key, pieceOwner, x, y);
                this.pieceElements.set(key, pieceEl);
                piecesGroup.appendChild(pieceEl);
            }
        }

        // Tight-fit Dynamic ViewBox: Eliminates dead black margin borders, expands hex cells by ~25%-55% on mobile screens
        const pad = 16;
        const boxWidth = (maxX - minX) + pad * 2;
        const boxHeight = (maxY - minY) + pad * 2;
        const squareSize = Math.max(boxWidth, boxHeight);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const viewBoxX = Math.round(centerX - squareSize / 2);
        const viewBoxY = Math.round(centerY - squareSize / 2);
        const viewBoxSize = Math.round(squareSize);

        this.svgContainer.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxSize} ${viewBoxSize}`);

        if (this.particleEngine) {
            this.particleEngine.setViewBox(viewBoxX, viewBoxY, viewBoxSize, viewBoxSize);
        }

        this.svgContainer.appendChild(cellsGroup);
        this.svgContainer.appendChild(warpsGroup);
        this.svgContainer.appendChild(piecesGroup);
        this.svgContainer.appendChild(movesGroup);
        this.svgContainer.appendChild(effectsGroup);

        this.renderWarpPortals();
        this.updateHighlights();
    }

    renderWarpPortals() {
        const warpsGroup = document.getElementById('hex-warps-group');
        if (!warpsGroup) return;
        warpsGroup.innerHTML = '';

        // Reset warp class on all cells
        this.cellElements.forEach(poly => poly.classList.remove('hex-cell-warp'));

        const specialTiles = this.state.specialTiles || {};
        for (const key in specialTiles) {
            const warp = specialTiles[key];
            if (warp && warp.type === 'warp') {
                const poly = this.cellElements.get(key);
                if (poly) poly.classList.add('hex-cell-warp');

                const { q, r } = HexMath.parseKey(key);
                const { x, y } = HexMath.hexToPixel(q, r, this.cellSize, this.originX, this.originY);

                const warpGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                warpGroup.setAttribute('class', 'warp-portal-glyph');
                warpGroup.style.pointerEvents = 'none';

                // Spinning dashed vortex ring
                const vortex = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                vortex.setAttribute('cx', x);
                vortex.setAttribute('cy', y);
                vortex.setAttribute('r', this.cellSize * 0.38);
                vortex.setAttribute('fill', 'none');
                vortex.setAttribute('stroke', warp.color || '#a855f7');
                vortex.setAttribute('stroke-width', '2');
                vortex.setAttribute('stroke-dasharray', '5 3');
                vortex.setAttribute('class', 'warp-vortex-ring');

                // Inner core dot
                const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                core.setAttribute('cx', x);
                core.setAttribute('cy', y);
                core.setAttribute('r', this.cellSize * 0.14);
                core.setAttribute('fill', warp.color || '#a855f7');

                warpGroup.appendChild(vortex);
                warpGroup.appendChild(core);
                warpsGroup.appendChild(warpGroup);
            }
        }
    }

    spawnWormholePair(animate = true) {
        if (this.presetId !== 'warp' || this.isGameOver) return;
        if (!this.state.specialTiles) this.state.specialTiles = {};

        // Maintain exactly 1 active linked wormhole pair at a time for high-stakes tactical focus
        if (Object.keys(this.state.specialTiles).length >= 2) return;

        // Find free, unoccupied cells that do not already have a piece or special tile
        const freeCells = this.state.cells.filter(key => 
            !this.state.board[key] && 
            !this.state.specialTiles[key]
        );

        if (freeCells.length < 2) return;

        // Pick cell A at random from free cells
        const idxA = Math.floor(Math.random() * freeCells.length);
        const keyA = freeCells[idxA];
        const posA = HexMath.parseKey(keyA);

        // Pick cell B across the rift (distance >= 4 for great cross-board jumps, fallback to >= 3)
        let candidatesB = freeCells.filter(key => {
            if (key === keyA) return false;
            const posB = HexMath.parseKey(key);
            return HexMath.distance(posA, posB) >= 4;
        });

        if (candidatesB.length === 0) {
            candidatesB = freeCells.filter(key => {
                if (key === keyA) return false;
                const posB = HexMath.parseKey(key);
                return HexMath.distance(posA, posB) >= 3;
            });
        }

        const poolB = candidatesB.length > 0 ? candidatesB : freeCells.filter(k => k !== keyA);
        if (poolB.length === 0) return;

        const keyB = poolB[Math.floor(Math.random() * poolB.length)];
        const posB = HexMath.parseKey(keyB);

        // Assign linked pair: Portal α (Purple) & Portal β (Cyan)
        const pairId = 'warp_' + Math.random().toString(36).substr(2, 9);
        const colorAlpha = '#c084fc';
        const colorBeta = '#38bdf8';

        this.state.specialTiles[keyA] = { type: 'warp', target: keyB, pairId, color: colorAlpha, label: 'WARP α' };
        this.state.specialTiles[keyB] = { type: 'warp', target: keyA, pairId, color: colorBeta, label: 'WARP β' };

        this.renderWarpPortals();

        if (animate) {
            const coordsA = HexMath.hexToPixel(posA.q, posA.r, this.cellSize, this.originX, this.originY);
            const coordsB = HexMath.hexToPixel(posB.q, posB.r, this.cellSize, this.originX, this.originY);
            this.triggerWarpSpawnVFX(coordsA.x, coordsA.y, colorAlpha);
            this.triggerWarpSpawnVFX(coordsB.x, coordsB.y, colorBeta);
        }
    }

    despawnWormholePair(pairId) {
        if (!this.state.specialTiles || !pairId) return;

        // Animate cosmic collapse at both portals before removing
        for (const key in this.state.specialTiles) {
            const warp = this.state.specialTiles[key];
            if (warp?.pairId === pairId) {
                const { q, r } = HexMath.parseKey(key);
                const coords = HexMath.hexToPixel(q, r, this.cellSize, this.originX, this.originY);
                this.triggerWarpCollapseVFX(coords.x, coords.y, warp.color || '#c084fc');
                delete this.state.specialTiles[key];
            }
        }

        // 1-turn cooldown before a new pair opens on a different rift location
        this.warpCooldown = 1;
        this.renderWarpPortals();
    }

    triggerWarpSpawnVFX(x, y, color = '#c084fc') {
        const effectsGroup = document.getElementById('hex-effects-group');
        if (!effectsGroup) return;

        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', x);
        ring.setAttribute('cy', y);
        ring.setAttribute('r', '6');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', color);
        ring.setAttribute('stroke-width', '3');
        ring.setAttribute('class', 'svg-capture-ring');
        effectsGroup.appendChild(ring);

        for (let i = 0; i < 6; i++) {
            const angle = (i * 60) * Math.PI / 180;
            const tx = Math.cos(angle) * 18;
            const ty = Math.sin(angle) * 18;
            const spark = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const s = 3;
            spark.setAttribute('points', `${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`);
            spark.setAttribute('fill', color);
            spark.setAttribute('class', 'svg-gem-spark');
            spark.style.setProperty('--tx', `${tx}px`);
            spark.style.setProperty('--ty', `${ty}px`);
            effectsGroup.appendChild(spark);
            setTimeout(() => spark.remove(), 450);
        }

        setTimeout(() => ring.remove(), 480);
    }

    triggerWarpCollapseVFX(x, y, color = '#c084fc') {
        const effectsGroup = document.getElementById('hex-effects-group');
        if (!effectsGroup) return;

        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', x);
        ring.setAttribute('cy', y);
        ring.setAttribute('r', this.cellSize * 0.4);
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', color);
        ring.setAttribute('stroke-width', '2.5');
        ring.setAttribute('class', 'svg-warp-collapse');
        effectsGroup.appendChild(ring);

        setTimeout(() => ring.remove(), 400);
    }

    createPieceElement(key, owner, x, y) {
        const theme = this.getTheme();
        const playerData = theme.players[owner] || PLAYERS[owner];
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('data-piece-key', key);
        group.setAttribute('data-owner', owner);
        group.setAttribute('class', 'hex-piece');
        group.style.cursor = (owner === this.getCurrentPlayer() && !this.isAiTurn) ? 'pointer' : 'default';
        group.style.transformOrigin = `${x}px ${y}px`;
        group.style.transformBox = 'view-box';
        group.style.outline = 'none';
        group.style.userSelect = 'none';
        group.style.webkitUserSelect = 'none';

        // 1. Soft Ambient Drop Shadow
        const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        shadow.setAttribute('cx', x);
        shadow.setAttribute('cy', y + this.cellSize * 0.38);
        shadow.setAttribute('rx', this.cellSize * 0.42);
        shadow.setAttribute('ry', this.cellSize * 0.14);
        shadow.setAttribute('fill', 'rgba(0, 0, 0, 0.55)');

        // 2. 3D Spherical Crystal Gem Body
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'gem-circle-body');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', this.cellSize * 0.54);
        circle.setAttribute('fill', `url(#grad-${owner})`);
        circle.setAttribute('stroke', playerData?.color || 'rgba(255, 255, 255, 0.45)');
        circle.setAttribute('stroke-width', '1.4');

        // 3. Crisp Specular Glass Highlight
        const glossHighlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        glossHighlight.setAttribute('cx', x - this.cellSize * 0.18);
        glossHighlight.setAttribute('cy', y - this.cellSize * 0.18);
        glossHighlight.setAttribute('r', this.cellSize * 0.14);
        glossHighlight.setAttribute('fill', 'rgba(255, 255, 255, 0.7)');

        const glossCore = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        glossCore.setAttribute('cx', x - this.cellSize * 0.20);
        glossCore.setAttribute('cy', y - this.cellSize * 0.20);
        glossCore.setAttribute('r', this.cellSize * 0.06);
        glossCore.setAttribute('fill', '#ffffff');

        // 4. Subtle Theme Retro Icon Glyph
        const iconText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        iconText.setAttribute('x', x);
        iconText.setAttribute('y', y + this.cellSize * 0.05);
        iconText.setAttribute('text-anchor', 'middle');
        iconText.setAttribute('dominant-baseline', 'central');
        iconText.setAttribute('alignment-baseline', 'central');
        iconText.setAttribute('font-size', `${this.cellSize * 0.44}px`);
        iconText.setAttribute('fill', '#ffffff');
        iconText.setAttribute('class', 'piece-glyph-icon select-none pointer-events-none');
        iconText.style.pointerEvents = 'none';
        iconText.style.userSelect = 'none';
        iconText.textContent = playerData?.icon || '';

        group.appendChild(shadow);
        group.appendChild(circle);
        group.appendChild(glossHighlight);
        group.appendChild(glossCore);
        group.appendChild(iconText);

        group.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleCellClick(key);
        });

        return group;
    }

    triggerCloneVFX(x, y, color) {
        const effectsGroup = document.getElementById('hex-effects-group');
        if (!effectsGroup) return;

        // 1. Dual Concentric Vector Shockwave Rings
        const innerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerRing.setAttribute('cx', x);
        innerRing.setAttribute('cy', y);
        innerRing.setAttribute('r', '24');
        innerRing.setAttribute('fill', 'none');
        innerRing.setAttribute('stroke', color);
        innerRing.setAttribute('class', 'svg-shockwave-ring');
        effectsGroup.appendChild(innerRing);

        const outerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        outerRing.setAttribute('cx', x);
        outerRing.setAttribute('cy', y);
        outerRing.setAttribute('r', '20');
        outerRing.setAttribute('fill', 'none');
        outerRing.setAttribute('stroke', color);
        outerRing.setAttribute('class', 'svg-shockwave-ring-outer');
        effectsGroup.appendChild(outerRing);

        // 2. 8 Directional Diamond Sparks
        for (let i = 0; i < 8; i++) {
            const angle = (i * 45) * Math.PI / 180;
            const dist = 24 + (i % 2 === 0 ? 8 : 0);
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;

            const spark = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const s = 3;
            spark.setAttribute('points', `${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`);
            spark.setAttribute('fill', color);
            spark.setAttribute('class', 'svg-gem-spark');
            spark.style.setProperty('--tx', `${tx}px`);
            spark.style.setProperty('--ty', `${ty}px`);
            effectsGroup.appendChild(spark);
            setTimeout(() => spark.remove(), 450);
        }

        setTimeout(() => {
            innerRing.remove();
            outerRing.remove();
        }, 500);
    }

    triggerJumpVFX(fromX, fromY, toX, toY, color) {
        const effectsGroup = document.getElementById('hex-effects-group');
        if (!effectsGroup) return;

        // 1. Trajectory Laser Arc
        const trail = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        trail.setAttribute('x1', fromX);
        trail.setAttribute('y1', fromY);
        trail.setAttribute('x2', toX);
        trail.setAttribute('y2', toY);
        trail.setAttribute('stroke', color);
        trail.setAttribute('class', 'svg-jump-trail');
        effectsGroup.appendChild(trail);

        // 2. Origin Departure Pulse Ring
        const originRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        originRing.setAttribute('cx', fromX);
        originRing.setAttribute('cy', fromY);
        originRing.setAttribute('r', '18');
        originRing.setAttribute('fill', 'none');
        originRing.setAttribute('stroke', color);
        originRing.setAttribute('class', 'svg-shockwave-ring');
        effectsGroup.appendChild(originRing);

        // 3. Landing Impact Dual Shockwave
        const landingRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        landingRing.setAttribute('cx', toX);
        landingRing.setAttribute('cy', toY);
        landingRing.setAttribute('r', '28');
        landingRing.setAttribute('fill', 'none');
        landingRing.setAttribute('stroke', color);
        landingRing.setAttribute('class', 'svg-shockwave-ring');
        effectsGroup.appendChild(landingRing);

        const outerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        outerRing.setAttribute('cx', toX);
        outerRing.setAttribute('cy', toY);
        outerRing.setAttribute('r', '22');
        outerRing.setAttribute('fill', 'none');
        outerRing.setAttribute('stroke', color);
        outerRing.setAttribute('class', 'svg-shockwave-ring-outer');
        effectsGroup.appendChild(outerRing);

        // 4. Landing Impact Diamond Gem Sparks (10 rays)
        for (let i = 0; i < 10; i++) {
            const angle = (i * 36 + (Math.random() - 0.5) * 12) * Math.PI / 180;
            const dist = 28 + Math.random() * 8;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;

            const spark = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const s = 3.2;
            spark.setAttribute('points', `${toX},${toY - s} ${toX + s},${toY} ${toX},${toY + s} ${toX - s},${toY}`);
            spark.setAttribute('fill', color);
            spark.setAttribute('class', 'svg-gem-spark');
            spark.style.setProperty('--tx', `${tx}px`);
            spark.style.setProperty('--ty', `${ty}px`);
            effectsGroup.appendChild(spark);
            setTimeout(() => spark.remove(), 450);
        }

        setTimeout(() => {
            trail.remove();
            originRing.remove();
            landingRing.remove();
            outerRing.remove();
        }, 520);
    }

    triggerCaptureVFX(fromX, fromY, toX, toY, color) {
        const effectsGroup = document.getElementById('hex-effects-group');
        if (!effectsGroup) return;

        // 1. Infection Arc Energy Beam from Landing Piece to Converted Piece
        const beam = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        beam.setAttribute('x1', fromX);
        beam.setAttribute('y1', fromY);
        beam.setAttribute('x2', toX);
        beam.setAttribute('y2', toY);
        beam.setAttribute('stroke', color);
        beam.setAttribute('stroke-linecap', 'round');
        beam.setAttribute('class', 'svg-infection-beam');
        effectsGroup.appendChild(beam);

        // 2. Vector Shockwave Expanding Ring at Converted Piece
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', toX);
        ring.setAttribute('cy', toY);
        ring.setAttribute('r', '24');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', color);
        ring.setAttribute('class', 'svg-capture-ring');
        effectsGroup.appendChild(ring);

        // 3. Symmetrical Diamond Gem Sparks Bursting Outward
        for (let i = 0; i < 6; i++) {
            const angle = (i * 60 + (Math.random() - 0.5) * 20) * Math.PI / 180;
            const dist = 24 + Math.random() * 8;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;

            const spark = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const s = 3.2;
            spark.setAttribute('points', `${toX},${toY - s} ${toX + s},${toY} ${toX},${toY + s} ${toX - s},${toY}`);
            spark.setAttribute('fill', color);
            spark.setAttribute('class', 'svg-gem-spark');
            spark.style.setProperty('--tx', `${tx}px`);
            spark.style.setProperty('--ty', `${ty}px`);
            effectsGroup.appendChild(spark);

            setTimeout(() => spark.remove(), 450);
        }

        // 4. Floating +1 Score Pop
        const scoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        scoreText.setAttribute('x', toX);
        scoreText.setAttribute('y', toY - 6);
        scoreText.setAttribute('text-anchor', 'middle');
        scoreText.setAttribute('fill', color);
        scoreText.setAttribute('font-size', '13');
        scoreText.setAttribute('class', 'svg-score-pop');
        scoreText.textContent = '+1';
        effectsGroup.appendChild(scoreText);

        // Clean up DOM after animations complete
        setTimeout(() => {
            beam.remove();
            ring.remove();
            scoreText.remove();
        }, 580);
    }

    triggerWarpBeam(fromX, fromY, toX, toY, color = '#a855f7') {
        const effectsGroup = document.getElementById('hex-effects-group');
        if (!effectsGroup) return;

        // 1. Quantum Lightning Warp Line
        const beam = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        beam.setAttribute('x1', fromX);
        beam.setAttribute('y1', fromY);
        beam.setAttribute('x2', toX);
        beam.setAttribute('y2', toY);
        beam.setAttribute('stroke', color);
        beam.setAttribute('stroke-linecap', 'round');
        beam.setAttribute('class', 'svg-warp-beam');
        effectsGroup.appendChild(beam);

        // 2. Expanding Rings at Entry and Exit
        [{ x: fromX, y: fromY }, { x: toX, y: toY }].forEach(pt => {
            const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            ring.setAttribute('cx', pt.x);
            ring.setAttribute('cy', pt.y);
            ring.setAttribute('r', '24');
            ring.setAttribute('fill', 'none');
            ring.setAttribute('stroke', color);
            ring.setAttribute('class', 'svg-capture-ring');
            effectsGroup.appendChild(ring);
            setTimeout(() => ring.remove(), 480);
        });

        setTimeout(() => beam.remove(), 520);
    }

    triggerLandingShockwave(x, y, color = '#00e5ff', captureCount = 1) {
        const effectsGroup = document.getElementById('hex-effects-group');
        if (!effectsGroup) return;

        const shockwave = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        shockwave.setAttribute('cx', x);
        shockwave.setAttribute('cy', y);
        shockwave.setAttribute('r', '12');
        shockwave.setAttribute('stroke', color);
        shockwave.setAttribute('class', 'svg-landing-shockwave');
        effectsGroup.appendChild(shockwave);

        if (captureCount >= 3) {
            setTimeout(() => {
                const secondWave = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                secondWave.setAttribute('cx', x);
                secondWave.setAttribute('cy', y);
                secondWave.setAttribute('r', '12');
                secondWave.setAttribute('stroke', color);
                secondWave.setAttribute('class', 'svg-landing-shockwave');
                effectsGroup.appendChild(secondWave);
                setTimeout(() => secondWave.remove(), 490);
            }, 80);
        }

        setTimeout(() => shockwave.remove(), 490);
    }

    triggerComboCallout(pixelX, pixelY, captureCount) {
        if (captureCount < 2) return;
        const overlay = document.getElementById('combo-callout-overlay');
        if (!overlay) return;

        // Convert SVG coordinates to container percentage
        const pctX = (pixelX / 700) * 100;
        const pctY = (pixelY / 700) * 100;

        const badge = document.createElement('div');
        let text = 'DOUBLE STRIKE!';
        let cls = 'combo-badge-double';

        if (captureCount === 3) {
            text = 'TRIPLE CAPTURE!';
            cls = 'combo-badge-triple';
        } else if (captureCount === 4) {
            text = 'MEGA COMBO!';
            cls = 'combo-badge-mega';
        } else if (captureCount >= 5) {
            text = 'DOMINATION!';
            cls = 'combo-badge-domination';
        }

        badge.className = `combo-badge ${cls}`;
        badge.style.left = `${pctX}%`;
        badge.style.top = `${pctY}%`;
        badge.textContent = `${text} +${captureCount}`;

        overlay.appendChild(badge);
        setTimeout(() => badge.remove(), 880);
    }

    triggerBoardShake(intensity = 'medium') {
        if (typeof window !== 'undefined' && localStorage.getItem('hexxagon_shake') === 'false') return;
        const boardViewport = document.getElementById('board-viewport');
        if (boardViewport) {
            boardViewport.classList.remove('board-rumble-light', 'board-rumble-medium', 'board-rumble-heavy', 'board-rumble-mega', 'board-rumble');
            // Force reflow to reliably restart CSS keyframe animation
            void boardViewport.offsetWidth;
            const cls = intensity === 'mega' ? 'board-rumble-mega' : 
                        (intensity === 'heavy' ? 'board-rumble-heavy' : 
                        (intensity === 'medium' ? 'board-rumble-medium' : 'board-rumble-light'));
            const duration = intensity === 'mega' ? 580 : (intensity === 'heavy' ? 460 : (intensity === 'medium' ? 350 : 220));
            boardViewport.classList.add(cls);
            setTimeout(() => {
                boardViewport.classList.remove('board-rumble-light', 'board-rumble-medium', 'board-rumble-heavy', 'board-rumble-mega', 'board-rumble');
            }, duration);
        }
    }

    previewCaptures(targetKey) {
        if (!this.selectedCell || !targetKey || this.currentHoveredKey === targetKey) return;
        this.clearCapturePreviews();
        this.currentHoveredKey = targetKey;

        const move = this.validMoves.find(m => m.toKey === targetKey);
        if (move) {
            // Highlight exit portal if move is a Quantum Warp
            if (move.warpToKey) {
                const exitCell = this.cellElements.get(move.warpToKey);
                if (exitCell) {
                    exitCell.classList.add('hex-cell-capture-threat');
                    this.activeThreatCellElements.push(exitCell);
                }
            }

            if (move.captures && move.captures.length > 0) {
                for (let i = 0; i < move.captures.length; i++) {
                    const capKey = move.captures[i];
                    const pieceEl = this.pieceElements.get(capKey);
                    if (pieceEl) {
                        pieceEl.classList.add('piece-capture-threat');
                        this.activeThreatPieceElements.push(pieceEl);
                    }

                    const cellEl = this.cellElements.get(capKey);
                    if (cellEl) {
                        cellEl.classList.add('hex-cell-capture-threat');
                        this.activeThreatCellElements.push(cellEl);
                    }
                }
            }
        }
    }

    clearCapturePreviews() {
        this.currentHoveredKey = null;
        if (this.activeThreatPieceElements.length > 0) {
            for (let i = 0; i < this.activeThreatPieceElements.length; i++) {
                this.activeThreatPieceElements[i].classList.remove('piece-capture-threat');
            }
            this.activeThreatPieceElements.length = 0;
        }
        if (this.activeThreatCellElements.length > 0) {
            for (let i = 0; i < this.activeThreatCellElements.length; i++) {
                this.activeThreatCellElements[i].classList.remove('hex-cell-capture-threat');
            }
            this.activeThreatCellElements.length = 0;
        }
    }

    showValidMoves(fromKey) {
        this.validMoves = HexxagonAI.getLegalMoves(this.state, this.getCurrentPlayer())
            .filter(m => m.fromKey === fromKey);

        this.updateHighlights();
    }

    handleCellClick(key) {
        if (this.isGameOver || this.isAiTurn) return;

        const player = this.getCurrentPlayer();
        const owner = this.state.board[key];

        if (owner === player) {
            // Select Piece
            this.selectedCell = key;
            sound.playSelect();
            this.showValidMoves(key);
        } else if (this.selectedCell) {
            // Try move to target cell
            const move = this.validMoves.find(m => m.toKey === key);
            if (move) {
                this.executeMove(move);
            } else {
                // Deselect
                this.selectedCell = null;
                this.validMoves = [];
                sound.playDeselect();
                this.updateHighlights();
            }
        }
    }

    updateHighlights() {
        this.clearCapturePreviews();
        const movesGroup = document.getElementById('hex-moves-group');
        if (!movesGroup) return;
        movesGroup.innerHTML = '';

        // Update Cell polygon highlights
        this.cellElements.forEach((poly, key) => {
            poly.setAttribute('class', 'hex-cell hex-cell-empty');
            if (this.state.specialTiles && this.state.specialTiles[key]?.type === 'warp') {
                poly.classList.add('hex-cell-warp');
            }

            if (key === this.selectedCell) {
                poly.classList.add('hex-cell-selected');
                const owner = this.state.board[key];
                poly.style.stroke = this.getPlayerColor(owner) || '#ffffff';
            } else if (this.lastMove && key === this.lastMove.toKey) {
                poly.classList.add('hex-cell-last-dest');
                const playerColor = this.getPlayerColor(this.lastMove.player);
                poly.style.stroke = playerColor;
            } else if (this.lastMove && this.lastMove.type === 'jump' && key === this.lastMove.fromKey) {
                poly.classList.add('hex-cell-last-origin');
            } else {
                poly.style.stroke = '';
            }
        });

        if (!this.selectedCell) return;

        // Render Hexxagon-style Target Move Rings
        this.validMoves.forEach(move => {
            const { x, y } = HexMath.hexToPixel(move.to.q, move.to.r, this.cellSize, this.originX, this.originY);
            const isClone = move.type === 'clone';
            const color = move.warpToKey ? '#c084fc' : (isClone ? '#00e676' : '#ffab00');
            const fillColor = move.warpToKey ? 'rgba(192, 132, 252, 0.28)' : (isClone ? 'rgba(0, 230, 118, 0.22)' : 'rgba(255, 171, 0, 0.22)');

            const markerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            markerGroup.style.cursor = 'pointer';

            // Outer pulse ring
            const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            outerCircle.setAttribute('cx', x);
            outerCircle.setAttribute('cy', y);
            outerCircle.setAttribute('r', this.cellSize * 0.38);
            outerCircle.setAttribute('fill', fillColor);
            outerCircle.setAttribute('stroke', color);
            outerCircle.setAttribute('stroke-width', '2');
            outerCircle.setAttribute('class', isClone ? 'hex-cell-clone-target' : 'hex-cell-jump-target');

            // Inner core dot
            const innerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            innerDot.setAttribute('cx', x);
            innerDot.setAttribute('cy', y);
            innerDot.setAttribute('r', isClone ? this.cellSize * 0.16 : this.cellSize * 0.12);
            innerDot.setAttribute('fill', color);
            innerDot.setAttribute('stroke', '#ffffff');
            innerDot.setAttribute('stroke-width', '1.2');

            markerGroup.appendChild(outerCircle);
            markerGroup.appendChild(innerDot);

            markerGroup.addEventListener('click', (e) => {
                e.stopPropagation();
                this.executeMove(move);
            });
            markerGroup.addEventListener('mouseenter', () => this.previewCaptures(move.toKey));
            markerGroup.addEventListener('mouseleave', () => this.clearCapturePreviews());

            movesGroup.appendChild(markerGroup);
        });
    }

    async executeMove(move) {
        const player = this.getCurrentPlayer();
        this.selectedCell = null;
        this.validMoves = [];
        this.clearCapturePreviews();

        // Clear active markers
        const movesGroup = document.getElementById('hex-moves-group');
        if (movesGroup) movesGroup.innerHTML = '';

        // Save history for Undo
        this.history.push({
            board: { ...this.state.board },
            currentTurnIndex: this.state.currentTurnIndex,
            moveCount: this.state.moveCount,
            specialTiles: JSON.parse(JSON.stringify(this.state.specialTiles || {})),
            lastMove: this.lastMove ? { ...this.lastMove } : null
        });

        // Exact SVG Coordinate Calculation
        const toCoords = HexMath.hexToPixel(move.to.q, move.to.r, this.cellSize, this.originX, this.originY);
        const fromCoords = HexMath.hexToPixel(move.from.q, move.from.r, this.cellSize, this.originX, this.originY);
        const playerColor = this.getPlayerColor(player);

        const piecesGroup = document.getElementById('hex-pieces-group');

        if (move.warpToKey) {
            const usedPairId = this.state.specialTiles?.[move.toKey]?.pairId;

            // Quantum Warp Move
            sound.playWarp();
            const warpPos = HexMath.parseKey(move.warpToKey);
            const warpCoords = HexMath.hexToPixel(warpPos.q, warpPos.r, this.cellSize, this.originX, this.originY);

            // Animate quantum lightning connection
            this.triggerWarpBeam(toCoords.x, toCoords.y, warpCoords.x, warpCoords.y, '#a855f7');

            if (move.type === 'jump') {
                const jumpingPiece = this.pieceElements.get(move.fromKey);
                this.pieceElements.delete(move.fromKey);
                if (jumpingPiece && piecesGroup) jumpingPiece.remove();
            }

            const newPiece = this.createPieceElement(move.warpToKey, player, warpCoords.x, warpCoords.y);
            newPiece.classList.add('piece-popping-in');
            this.pieceElements.set(move.warpToKey, newPiece);
            if (piecesGroup) piecesGroup.appendChild(newPiece);

            // Despawn used wormhole pair immediately
            if (usedPairId) {
                this.despawnWormholePair(usedPairId);
            }

        } else {
            // If piece lands on a wormhole tile directly, despawn the pair so no piece covers it
            if (this.state.specialTiles?.[move.toKey]?.pairId) {
                const pairId = this.state.specialTiles[move.toKey].pairId;
                this.despawnWormholePair(pairId);
            }

            if (move.type === 'clone') {
                sound.playClone();
                this.triggerCloneVFX(toCoords.x, toCoords.y, playerColor);

                // Create cloned piece element with juicy elastic spring animation
                const newPiece = this.createPieceElement(move.toKey, player, toCoords.x, toCoords.y);
                newPiece.classList.add('piece-cloned');
                this.pieceElements.set(move.toKey, newPiece);
                if (piecesGroup) piecesGroup.appendChild(newPiece);

            } else {
                // Jump move
                sound.playJump();
                this.triggerJumpVFX(fromCoords.x, fromCoords.y, toCoords.x, toCoords.y, playerColor);

                // Move existing piece element
                const jumpingPiece = this.pieceElements.get(move.fromKey);
                this.pieceElements.delete(move.fromKey);

                if (jumpingPiece && piecesGroup) {
                    jumpingPiece.remove();
                }

                const newPiece = this.createPieceElement(move.toKey, player, toCoords.x, toCoords.y);
                newPiece.classList.add('piece-jumped');
                this.pieceElements.set(move.toKey, newPiece);
                if (piecesGroup) piecesGroup.appendChild(newPiece);
            }
        }

        // Apply Move State
        this.lastMove = {
            fromKey: move.fromKey,
            toKey: move.toKey,
            warpToKey: move.warpToKey,
            type: move.type,
            player
        };

        this.state = HexxagonAI.applyMove(this.state, move, player);
        this.state.moveCount++;

        const landingCoords = (move.warpToKey) 
            ? HexMath.hexToPixel(HexMath.parseKey(move.warpToKey).q, HexMath.parseKey(move.warpToKey).r, this.cellSize, this.originX, this.originY)
            : toCoords;

        // Staggered conversion audio & native vector animation
        if (move.captures.length > 0) {
            const capCount = move.captures.length;
            const shakeIntensity = capCount >= 5 ? 'mega' : (capCount === 4 ? 'heavy' : (capCount === 3 ? 'medium' : 'light'));
            this.triggerBoardShake(shakeIntensity);
            this.triggerLandingShockwave(landingCoords.x, landingCoords.y, playerColor, capCount);

            if (capCount >= 2) {
                this.triggerComboCallout(landingCoords.x, landingCoords.y, capCount);
                sound.playComboCallout(capCount);

                // Multi-tiered dynamic canvas shockwaves and spark bursts
                if (this.particleEngine) {
                    if (capCount === 3) {
                        this.particleEngine.createShockwave(landingCoords.x, landingCoords.y, playerColor, 55);
                        this.particleEngine.createSparks(landingCoords.x, landingCoords.y, '#fbbf24', 12, 1.2);
                    } else if (capCount === 4) {
                        this.particleEngine.createShockwave(landingCoords.x, landingCoords.y, playerColor, 75);
                        this.particleEngine.createSparks(landingCoords.x, landingCoords.y, '#f472b6', 22, 1.6);
                    } else if (capCount >= 5) {
                        this.particleEngine.createShockwave(landingCoords.x, landingCoords.y, playerColor, 105);
                        this.particleEngine.createSparks(landingCoords.x, landingCoords.y, '#ff0055', 38, 2.3);
                        setTimeout(() => {
                            this.particleEngine?.createShockwave(landingCoords.x, landingCoords.y, '#ffd700', 85);
                        }, 120);
                    }
                }
            }

            move.captures.forEach((capKey, idx) => {
                setTimeout(() => {
                    const capPos = HexMath.parseKey(capKey);
                    const capCoords = HexMath.hexToPixel(capPos.q, capPos.r, this.cellSize, this.originX, this.originY);

                    // 1. Remove old piece element
                    const oldPiece = this.pieceElements.get(capKey);
                    if (oldPiece) {
                        oldPiece.remove();
                    }

                    // 2. Re-create completely fresh piece element for the new owner (guarantees 100% theme glyph, gradient, and stroke update)
                    const newPiece = this.createPieceElement(capKey, player, capCoords.x, capCoords.y);
                    newPiece.classList.add('piece-converting');
                    this.pieceElements.set(capKey, newPiece);

                    const piecesGroup = document.getElementById('hex-pieces-group');
                    if (piecesGroup) {
                        piecesGroup.appendChild(newPiece);
                    }

                    // 3. Trigger 8-Bit Retro Explosion Sound & VFX
                    sound.playCaptureStep(idx, move.captures.length);
                    this.triggerCaptureVFX(landingCoords.x, landingCoords.y, capCoords.x, capCoords.y, playerColor);
                }, idx * 60);
            });

            await new Promise(resolve => setTimeout(resolve, Math.min(500, move.captures.length * 60 + 180)));
        }

        this.updateHighlights();
        this.emit('moveMade', { move, player });
        this.notifyState();

        // Advance Turn
        await this.advanceTurn();
    }

    async advanceTurn() {
        if (this.isTutorialMode && this.gameMode === 'tutorial') {
            this.notifyState();
            return;
        }

        const totalPlayers = this.state.players.length;
        const scores = this.calculateScores();
        const activePlayersWithPieces = this.state.players.filter(p => (scores[p] || 0) > 0);
        const emptyCells = this.state.cells.filter(k => !this.state.board[k]);

        // 1. If an opponent was completely wiped out and empty spaces remain -> Rapid board sweep
        if (activePlayersWithPieces.length === 1 && emptyCells.length > 0) {
            await this.sweepRemainingCells(activePlayersWithPieces[0]);
            return;
        }

        let nextIndex = (this.state.currentTurnIndex + 1) % totalPlayers;
        let attempts = 0;

        while (attempts < totalPlayers) {
            const nextPlayer = this.state.players[nextIndex];
            const nextMoves = HexxagonAI.getLegalMoves(this.state, nextPlayer);

            if (nextMoves.length > 0) {
                this.state.currentTurnIndex = nextIndex;
                break;
            } else {
                const pieceCount = scores[nextPlayer] || 0;
                if (pieceCount > 0) {
                    sound.playPass();
                }
                nextIndex = (nextIndex + 1) % totalPlayers;
                attempts++;
            }
        }

        const currentMoves = HexxagonAI.getLegalMoves(this.state, this.getCurrentPlayer());

        // 2. If no legal moves remain for anyone OR board is completely full
        if (attempts >= totalPlayers || emptyCells.length === 0 || currentMoves.length === 0) {
            if (emptyCells.length > 0) {
                const playersWithMoves = this.state.players.filter(p => HexxagonAI.getLegalMoves(this.state, p).length > 0);
                if (playersWithMoves.length === 1) {
                    await this.sweepRemainingCells(playersWithMoves[0]);
                    return;
                }
            }
            this.handleGameOver();
            return;
        }

        // Dynamic Wormhole Resupply on Warp Nexus (1 turn cooldown after a pair collapses)
        if (this.presetId === 'warp' && !this.isGameOver) {
            if (this.warpCooldown > 0) {
                this.warpCooldown--;
            } else {
                const activePairs = Object.keys(this.state.specialTiles || {}).length / 2;
                if (activePairs === 0) {
                    this.spawnWormholePair(true);
                }
            }
        }

        this.notifyState();

        if (this.isCurrentPlayerAi() && !this.isGameOver) {
            this.isAiTurn = true;
            this.emit('aiThinking', true);

            try {
                const bestMove = await this.ai.getBestMove(this.state, this.getCurrentPlayer(), this.state.players);
                this.emit('aiThinking', false);

                if (bestMove) {
                    // Visually highlight which piece the CPU picked
                    this.selectedCell = bestMove.fromKey;
                    sound.playSelect();
                    this.updateHighlights();

                    // Render CPU target ring indicator
                    const movesGroup = document.getElementById('hex-moves-group');
                    if (movesGroup) {
                        movesGroup.innerHTML = '';
                        const { x, y } = HexMath.hexToPixel(bestMove.to.q, bestMove.to.r, this.cellSize, this.originX, this.originY);
                        const isClone = bestMove.type === 'clone';
                        const color = isClone ? '#00e676' : '#ffab00';

                        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        ring.setAttribute('cx', x);
                        ring.setAttribute('cy', y);
                        ring.setAttribute('r', this.cellSize * 0.38);
                        ring.setAttribute('fill', isClone ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 171, 0, 0.25)');
                        ring.setAttribute('stroke', color);
                        ring.setAttribute('stroke-width', '2.5');
                        ring.setAttribute('class', isClone ? 'hex-cell-clone-target' : 'hex-cell-jump-target');
                        movesGroup.appendChild(ring);
                    }

                    // Highlight all affected opponent pieces
                    if (bestMove.captures && bestMove.captures.length > 0) {
                        for (let i = 0; i < bestMove.captures.length; i++) {
                            const capKey = bestMove.captures[i];
                            const pieceEl = this.pieceElements.get(capKey);
                            if (pieceEl) {
                                pieceEl.classList.add('piece-capture-threat');
                                this.activeThreatPieceElements.push(pieceEl);
                            }
                            const cellEl = this.cellElements.get(capKey);
                            if (cellEl) {
                                cellEl.classList.add('hex-cell-capture-threat');
                                this.activeThreatCellElements.push(cellEl);
                            }
                        }
                    }

                    // Pacing window
                    await new Promise(resolve => setTimeout(resolve, 400));

                    this.clearCapturePreviews();
                    this.isAiTurn = false;
                    await this.executeMove(bestMove);
                } else {
                    this.isAiTurn = false;
                    await this.advanceTurn();
                }
            } catch (err) {
                this.isAiTurn = false;
                this.emit('aiThinking', false);
            }
        }
    }

    async sweepRemainingCells(winnerPlayer) {
        this.isGameOver = true;
        this.selectedCell = null;
        this.validMoves = [];
        this.updateHighlights();

        const emptyCells = this.state.cells.filter(k => !this.state.board[k]);
        if (emptyCells.length === 0) {
            this.handleGameOver();
            return;
        }

        const piecesGroup = document.getElementById('hex-pieces-group');
        const color = this.getPlayerColor(winnerPlayer);

        for (let i = 0; i < emptyCells.length; i++) {
            const key = emptyCells[i];
            this.state.board[key] = winnerPlayer;

            const { q, r } = HexMath.parseKey(key);
            const { x, y } = HexMath.hexToPixel(q, r, this.cellSize, this.originX, this.originY);

            const pieceEl = this.createPieceElement(key, winnerPlayer, x, y);
            pieceEl.classList.add('piece-popping-in');
            this.pieceElements.set(key, pieceEl);

            if (piecesGroup) {
                piecesGroup.appendChild(pieceEl);
            }

            sound.playSweepPop(i, emptyCells.length);
            if (this.particleEngine) {
                this.particleEngine.createSparks(x, y, color, 4, 0.7);
            }

            this.notifyState();
            await new Promise(r => setTimeout(r, 32));
        }

        await new Promise(r => setTimeout(r, 300));
        this.handleGameOver();
    }

    handleGameOver() {
        this.isGameOver = true;
        const scores = this.calculateScores();

        let maxScore = -1;
        let winner = null;
        let isTie = false;

        Object.entries(scores).forEach(([player, score]) => {
            if (score > maxScore) {
                maxScore = score;
                winner = player;
                isTie = false;
            } else if (score === maxScore) {
                isTie = true;
            }
        });

        if (isTie) {
            winner = 'tie';
        }

        if (!this.isTutorialMode && this.gameMode !== 'tutorial') {
            if (winner === 'ruby' || (winner !== 'pearl' && winner !== 'tie')) {
                sound.playVictory();
                if (this.particleEngine) {
                    const winColor = this.getPlayerColor(winner);
                    this.particleEngine.spawnVictoryFireworks(winColor);
                }
            } else if (winner === 'pearl' && this.gameMode.startsWith('pve-')) {
                sound.playDefeat();
            }

            this.saveStats(winner, scores);
        }

        this.emit('gameOver', {
            winner,
            winnerInfo: PLAYERS[winner] || null,
            isTie,
            scores,
            moveCount: this.state.moveCount
        });
    }

    saveStats(winner, scores) {
        if (typeof window === 'undefined' || this.isTutorialMode || this.gameMode === 'tutorial') return;
        try {
            const raw = localStorage.getItem('hexxagon_stats_v2') || '{}';
            const stats = JSON.parse(raw);
            stats.totalGames = (stats.totalGames || 0) + 1;
            if (winner === 'ruby') stats.rubyWins = (stats.rubyWins || 0) + 1;
            if (winner === 'pearl') stats.pearlWins = (stats.pearlWins || 0) + 1;
            if (winner === 'tie') stats.ties = (stats.ties || 0) + 1;
            stats.highScoreRuby = Math.max(stats.highScoreRuby || 0, scores.ruby || 0);
            stats.highScorePearl = Math.max(stats.highScorePearl || 0, scores.pearl || 0);

            localStorage.setItem('hexxagon_stats_v2', JSON.stringify(stats));
        } catch (e) { }
    }

    undo() {
        if (this.history.length === 0 || this.isAiTurn) return;

        if (this.gameMode.startsWith('pve-') && this.history.length >= 2) {
            this.history.pop();
            const playerState = this.history.pop();
            this.state.board = playerState.board;
            this.state.currentTurnIndex = playerState.currentTurnIndex;
            this.state.moveCount = playerState.moveCount;
        } else {
            const prevState = this.history.pop();
            this.state.board = prevState.board;
            this.state.currentTurnIndex = prevState.currentTurnIndex;
            this.state.moveCount = prevState.moveCount;
        }

        this.isGameOver = false;
        this.selectedCell = null;
        this.validMoves = [];
        this.renderBoard();
        this.notifyState();
        sound.playDeselect();
    }

    destroy() {
        if (this.particleEngine) {
            this.particleEngine.destroy();
        }
    }
}
