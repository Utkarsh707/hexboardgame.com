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
        if (this.particleEngine) {
            this.particleEngine.clearAll();
        }
        const effectsGroup = document.getElementById('hex-effects-group');
        if (effectsGroup) effectsGroup.innerHTML = '';
        const comboOverlay = document.getElementById('combo-callout-overlay');
        if (comboOverlay) comboOverlay.innerHTML = '';
        const movesGroup = document.getElementById('hex-moves-group');
        if (movesGroup) movesGroup.innerHTML = '';

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
        const stageBackdrop = document.getElementById('stage-backdrop');
        if (stageBackdrop) {
            stageBackdrop.setAttribute('data-theme', this.themeId);
        }

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        let gradsHtml = `
            <!-- 3D Hexagon Tile Plate Shading & Lighting Gradients -->
            <linearGradient id="grad-hex-plate" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#2d4170"/>
                <stop offset="28%" stop-color="#1c2a4c"/>
                <stop offset="72%" stop-color="#101a33"/>
                <stop offset="100%" stop-color="#080e20"/>
            </linearGradient>

            <linearGradient id="grad-hex-stroke" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#7dd3fc"/>
                <stop offset="35%" stop-color="#38bdf8"/>
                <stop offset="70%" stop-color="#0f2244"/>
                <stop offset="100%" stop-color="#040814"/>
            </linearGradient>

            <radialGradient id="grad-hex-bed" cx="50%" cy="35%" r="68%">
                <stop offset="0%" stop-color="#0e1b38"/>
                <stop offset="55%" stop-color="#060c1c"/>
                <stop offset="100%" stop-color="#02040b"/>
            </radialGradient>

            <linearGradient id="grad-hex-base" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#091024"/>
                <stop offset="100%" stop-color="#020409"/>
            </linearGradient>
        `;
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

            const basePoints = HexMath.getHexPolygonPoints(x, y + 3.6, this.cellSize - 0.8);
            const points = HexMath.getHexPolygonPoints(x, y, this.cellSize - 1.2);
            const innerPoints = HexMath.getHexPolygonPoints(x, y, this.cellSize * 0.70);

            const cellGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            cellGroup.setAttribute('class', 'hex-cell-socket-group');

            // 0. 3D Extruded Depth Wall / Base Shadow
            const socketBase = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            socketBase.setAttribute('points', basePoints);
            socketBase.setAttribute('class', 'hex-cell-3d-base');
            cellGroup.appendChild(socketBase);

            // 1. Outer Beveled Socket Facet Rim (Top-lit 3D Plate)
            const socketRim = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            socketRim.setAttribute('points', points);
            socketRim.setAttribute('class', 'hex-cell-rim');
            cellGroup.appendChild(socketRim);

            // 2. Inner Recessed Jewel Bed (Dark socket cavity)
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

        // Tight-fit Dynamic ViewBox: Stretches cleanly with tight padding on mobile to maximize board size
        const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || window.innerHeight > window.innerWidth);
        const pad = isMobile ? 6 : 16;
        const boxWidth = Math.round((maxX - minX) + pad * 2);
        const boxHeight = Math.round((maxY - minY) + pad * 2);
        const viewBoxX = Math.round(minX - pad);
        const viewBoxY = Math.round(minY - pad);

        this.svgContainer.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${boxWidth} ${boxHeight}`);
        this.svgContainer.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        if (this.particleEngine) {
            this.particleEngine.setViewBox(viewBoxX, viewBoxY, boxWidth, boxHeight);
        }

        this.svgContainer.appendChild(cellsGroup);
        this.svgContainer.appendChild(warpsGroup);
        this.svgContainer.appendChild(piecesGroup);
        this.svgContainer.appendChild(movesGroup);
        this.svgContainer.appendChild(effectsGroup);

        this.renderWarpPortals();
        this.updateHighlights();
        this.updatePieceEmotions();
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
        group.setAttribute('class', `hex-piece hex-piece-${owner}`);
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

        // 4. Reactive Animated Cartoon Face System (Worms 2D Inspired)
        const faceGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        faceGroup.setAttribute('class', 'orb-face-system select-none pointer-events-none');
        faceGroup.style.pointerEvents = 'none';

        // Staggered Asynchronous Delays so characters don't blink/glance in unison
        const blinkDelay = -(Math.random() * 5).toFixed(2);
        const glanceDelay = -(Math.random() * 7).toFixed(2);

        // Blushing Cheeks
        const blushLeft = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        blushLeft.setAttribute('cx', x - this.cellSize * 0.26);
        blushLeft.setAttribute('cy', y + this.cellSize * 0.10);
        blushLeft.setAttribute('rx', this.cellSize * 0.09);
        blushLeft.setAttribute('ry', this.cellSize * 0.06);
        blushLeft.setAttribute('class', 'orb-blush');

        const blushRight = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        blushRight.setAttribute('cx', x + this.cellSize * 0.26);
        blushRight.setAttribute('cy', y + this.cellSize * 0.10);
        blushRight.setAttribute('rx', this.cellSize * 0.09);
        blushRight.setAttribute('ry', this.cellSize * 0.06);
        blushRight.setAttribute('class', 'orb-blush');

        // Eyebrows Group (Stays steady and expressive during eyelid blinking)
        const eyebrowsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        eyebrowsGroup.setAttribute('class', 'orb-eyebrows');

        const browLeft = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        browLeft.setAttribute('d', `M ${(x - this.cellSize * 0.26).toFixed(1)} ${(y - this.cellSize * 0.18).toFixed(1)} Q ${(x - this.cellSize * 0.18).toFixed(1)} ${(y - this.cellSize * 0.23).toFixed(1)} ${(x - this.cellSize * 0.10).toFixed(1)} ${(y - this.cellSize * 0.18).toFixed(1)}`);
        browLeft.setAttribute('fill', 'none');
        browLeft.setAttribute('stroke', '#10081c');
        browLeft.setAttribute('stroke-width', '1.4');
        browLeft.setAttribute('stroke-linecap', 'round');
        browLeft.setAttribute('class', 'orb-eyebrow-left');

        const browRight = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        browRight.setAttribute('d', `M ${(x + this.cellSize * 0.10).toFixed(1)} ${(y - this.cellSize * 0.18).toFixed(1)} Q ${(x + this.cellSize * 0.18).toFixed(1)} ${(y - this.cellSize * 0.23).toFixed(1)} ${(x + this.cellSize * 0.26).toFixed(1)} ${(y - this.cellSize * 0.18).toFixed(1)}`);
        browRight.setAttribute('fill', 'none');
        browRight.setAttribute('stroke', '#10081c');
        browRight.setAttribute('stroke-width', '1.4');
        browRight.setAttribute('stroke-linecap', 'round');
        browRight.setAttribute('class', 'orb-eyebrow-right');

        eyebrowsGroup.appendChild(browLeft);
        eyebrowsGroup.appendChild(browRight);

        // Pupils Glance Group (Asynchronous Looking Left / Center / Right)
        const pupilsGlanceGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        pupilsGlanceGroup.setAttribute('class', 'orb-pupils-glance');
        pupilsGlanceGroup.style.animationDelay = `${glanceDelay}s`;

        // Left Eye (Normal)
        const leftEyeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const lPupil = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        lPupil.setAttribute('cx', (x - this.cellSize * 0.18).toFixed(1));
        lPupil.setAttribute('cy', (y - this.cellSize * 0.06).toFixed(1));
        lPupil.setAttribute('r', (this.cellSize * 0.09).toFixed(1));
        lPupil.setAttribute('fill', '#10081c');

        const lShine1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        lShine1.setAttribute('cx', (x - this.cellSize * 0.21).toFixed(1));
        lShine1.setAttribute('cy', (y - this.cellSize * 0.09).toFixed(1));
        lShine1.setAttribute('r', (this.cellSize * 0.038).toFixed(1));
        lShine1.setAttribute('fill', '#ffffff');

        const lShine2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        lShine2.setAttribute('cx', (x - this.cellSize * 0.15).toFixed(1));
        lShine2.setAttribute('cy', (y - this.cellSize * 0.03).toFixed(1));
        lShine2.setAttribute('r', (this.cellSize * 0.02).toFixed(1));
        lShine2.setAttribute('fill', '#ffffff');

        leftEyeGroup.appendChild(lPupil);
        leftEyeGroup.appendChild(lShine1);
        leftEyeGroup.appendChild(lShine2);

        // Right Eye (Normal)
        const rightEyeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const rPupil = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        rPupil.setAttribute('cx', (x + this.cellSize * 0.18).toFixed(1));
        rPupil.setAttribute('cy', (y - this.cellSize * 0.06).toFixed(1));
        rPupil.setAttribute('r', (this.cellSize * 0.09).toFixed(1));
        rPupil.setAttribute('fill', '#10081c');

        const rShine1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        rShine1.setAttribute('cx', (x + this.cellSize * 0.15).toFixed(1));
        rShine1.setAttribute('cy', (y - this.cellSize * 0.09).toFixed(1));
        rShine1.setAttribute('r', (this.cellSize * 0.038).toFixed(1));
        rShine1.setAttribute('fill', '#ffffff');

        const rShine2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        rShine2.setAttribute('cx', (x + this.cellSize * 0.21).toFixed(1));
        rShine2.setAttribute('cy', (y - this.cellSize * 0.03).toFixed(1));
        rShine2.setAttribute('r', (this.cellSize * 0.02).toFixed(1));
        rShine2.setAttribute('fill', '#ffffff');

        rightEyeGroup.appendChild(rPupil);
        rightEyeGroup.appendChild(rShine1);
        rightEyeGroup.appendChild(rShine2);

        pupilsGlanceGroup.appendChild(leftEyeGroup);
        pupilsGlanceGroup.appendChild(rightEyeGroup);

        // Eyelids Blink Group (Blinds the pupils cleanly without compressing brows)
        const blinkGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        blinkGroup.setAttribute('class', 'orb-eyelids-blink');
        blinkGroup.style.transformOrigin = `${x}px ${(y - this.cellSize * 0.06).toFixed(1)}px`;
        blinkGroup.style.animationDelay = `${blinkDelay}s`;
        blinkGroup.appendChild(pupilsGlanceGroup);

        // Combined Normal Eyes Group
        const eyesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        eyesGroup.setAttribute('class', 'orb-eyes-normal');
        eyesGroup.appendChild(eyebrowsGroup);
        eyesGroup.appendChild(blinkGroup);

        // Scared / Threatened Eyes (Quivering dots + sweat drop)
        const scaredEyesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        scaredEyesGroup.setAttribute('class', 'orb-eyes-scared');

        const sLeftWhite = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        sLeftWhite.setAttribute('cx', x - this.cellSize * 0.18);
        sLeftWhite.setAttribute('cy', y - this.cellSize * 0.06);
        sLeftWhite.setAttribute('r', this.cellSize * 0.11);
        sLeftWhite.setAttribute('fill', '#ffffff');
        sLeftWhite.setAttribute('stroke', '#10081c');
        sLeftWhite.setAttribute('stroke-width', '1');

        const sLeftPupil = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        sLeftPupil.setAttribute('cx', x - this.cellSize * 0.18);
        sLeftPupil.setAttribute('cy', y - this.cellSize * 0.06);
        sLeftPupil.setAttribute('r', this.cellSize * 0.04);
        sLeftPupil.setAttribute('fill', '#10081c');

        const sRightWhite = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        sRightWhite.setAttribute('cx', x + this.cellSize * 0.18);
        sRightWhite.setAttribute('cy', y - this.cellSize * 0.06);
        sRightWhite.setAttribute('r', this.cellSize * 0.11);
        sRightWhite.setAttribute('fill', '#ffffff');
        sRightWhite.setAttribute('stroke', '#10081c');
        sRightWhite.setAttribute('stroke-width', '1');

        const sRightPupil = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        sRightPupil.setAttribute('cx', x + this.cellSize * 0.18);
        sRightPupil.setAttribute('cy', y - this.cellSize * 0.06);
        sRightPupil.setAttribute('r', this.cellSize * 0.04);
        sRightPupil.setAttribute('fill', '#10081c');

        // Threat Sweatdrop
        const sweat = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const swX = x + this.cellSize * 0.32;
        const swY = y - this.cellSize * 0.22;
        sweat.setAttribute('d', `M ${swX} ${swY - 5} C ${swX} ${swY - 5} ${swX + 3} ${swY} ${swX + 3} ${swY + 2} C ${swX + 3} ${swY + 4} ${swX + 1.5} ${swY + 5} ${swX} ${swY + 5} C ${swX - 1.5} ${swY + 5} ${swX - 3} ${swY + 4} ${swX - 3} ${swY + 2} C ${swX - 3} ${swY} ${swX} ${swY - 5} Z`);
        sweat.setAttribute('fill', '#38bdf8');
        sweat.setAttribute('class', 'orb-sweatdrop');

        scaredEyesGroup.appendChild(sLeftWhite);
        scaredEyesGroup.appendChild(sLeftPupil);
        scaredEyesGroup.appendChild(sRightWhite);
        scaredEyesGroup.appendChild(sRightPupil);
        scaredEyesGroup.appendChild(sweat);

        // Happy Triumphant Eyes (^ ^ shape)
        const happyEyesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        happyEyesGroup.setAttribute('class', 'orb-eyes-happy');

        const hLeft = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hLeft.setAttribute('d', `M ${x - this.cellSize * 0.25} ${y - this.cellSize * 0.03} Q ${x - this.cellSize * 0.18} ${y - this.cellSize * 0.14} ${x - this.cellSize * 0.11} ${y - this.cellSize * 0.03}`);
        hLeft.setAttribute('fill', 'none');
        hLeft.setAttribute('stroke', '#10081c');
        hLeft.setAttribute('stroke-width', '1.8');
        hLeft.setAttribute('stroke-linecap', 'round');

        const hRight = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hRight.setAttribute('d', `M ${x + this.cellSize * 0.11} ${y - this.cellSize * 0.03} Q ${x + this.cellSize * 0.18} ${y - this.cellSize * 0.14} ${x + this.cellSize * 0.25} ${y - this.cellSize * 0.03}`);
        hRight.setAttribute('fill', 'none');
        hRight.setAttribute('stroke', '#10081c');
        hRight.setAttribute('stroke-width', '1.8');
        hRight.setAttribute('stroke-linecap', 'round');

        happyEyesGroup.appendChild(hLeft);
        happyEyesGroup.appendChild(hRight);

        // Panic Nervous Sweat
        const panicSweat = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const pswX = x - this.cellSize * 0.30;
        const pswY = y - this.cellSize * 0.18;
        panicSweat.setAttribute('d', `M ${pswX} ${pswY - 4} C ${pswX} ${pswY - 4} ${pswX + 2.5} ${pswY} ${pswX + 2.5} ${pswY + 1.8} C ${pswX + 2.5} ${pswY + 3.2} ${pswX + 1.2} ${pswY + 4} ${pswX} ${pswY + 4} C ${pswX - 1.2} ${pswY + 4} ${pswX - 2.5} ${pswY + 3.2} ${pswX - 2.5} ${pswY + 1.8} C ${pswX - 2.5} ${pswY} ${pswX} ${pswY - 4} Z`);
        panicSweat.setAttribute('fill', '#38bdf8');
        panicSweat.setAttribute('class', 'orb-sweat-nervous');

        // Mouth Variants (Contextual Worms 2D Emotions)
        // 1. Normal Happy Smile (Default / Balanced)
        const mouthNormal = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        mouthNormal.setAttribute('d', `M ${x - this.cellSize * 0.11} ${y + this.cellSize * 0.13} Q ${x} ${y + this.cellSize * 0.23} ${x + this.cellSize * 0.11} ${y + this.cellSize * 0.13}`);
        mouthNormal.setAttribute('fill', 'none');
        mouthNormal.setAttribute('stroke', '#10081c');
        mouthNormal.setAttribute('stroke-width', '1.6');
        mouthNormal.setAttribute('stroke-linecap', 'round');
        mouthNormal.setAttribute('class', 'orb-mouth-normal');

        // 2. Smug Smirk (When in clear lead / dominant)
        const mouthSmug = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        mouthSmug.setAttribute('d', `M ${x - this.cellSize * 0.12} ${y + this.cellSize * 0.15} Q ${x} ${y + this.cellSize * 0.22} ${x + this.cellSize * 0.14} ${y + this.cellSize * 0.08}`);
        mouthSmug.setAttribute('fill', 'none');
        mouthSmug.setAttribute('stroke', '#10081c');
        mouthSmug.setAttribute('stroke-width', '1.7');
        mouthSmug.setAttribute('stroke-linecap', 'round');
        mouthSmug.setAttribute('class', 'orb-mouth-smug');

        // 3. Nervous Wobbly Mouth (When trailing in score)
        const mouthNervous = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        mouthNervous.setAttribute('d', `M ${x - this.cellSize * 0.14} ${y + this.cellSize * 0.15} Q ${x - this.cellSize * 0.07} ${y + this.cellSize * 0.10} ${x} ${y + this.cellSize * 0.15} Q ${x + this.cellSize * 0.07} ${y + this.cellSize * 0.20} ${x + this.cellSize * 0.14} ${y + this.cellSize * 0.15}`);
        mouthNervous.setAttribute('fill', 'none');
        mouthNervous.setAttribute('stroke', '#10081c');
        mouthNervous.setAttribute('stroke-width', '1.5');
        mouthNervous.setAttribute('stroke-linecap', 'round');
        mouthNervous.setAttribute('class', 'orb-mouth-nervous');

        // 4. Panic Biting Teeth Grimace (When down to 1-2 pieces)
        const mouthPanic = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        mouthPanic.setAttribute('d', `M ${x - this.cellSize * 0.13} ${y + this.cellSize * 0.13} L ${x + this.cellSize * 0.13} ${y + this.cellSize * 0.13} L ${x + this.cellSize * 0.10} ${y + this.cellSize * 0.21} L ${x - this.cellSize * 0.10} ${y + this.cellSize * 0.21} Z`);
        mouthPanic.setAttribute('fill', '#ffffff');
        mouthPanic.setAttribute('stroke', '#10081c');
        mouthPanic.setAttribute('stroke-width', '1.2');
        mouthPanic.setAttribute('class', 'orb-mouth-panic');

        // 5. Excited Big Smile (When Selected)
        const mouthExcited = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        mouthExcited.setAttribute('d', `M ${x - this.cellSize * 0.13} ${y + this.cellSize * 0.11} Q ${x} ${y + this.cellSize * 0.27} ${x + this.cellSize * 0.13} ${y + this.cellSize * 0.11} Z`);
        mouthExcited.setAttribute('fill', '#ff2d60');
        mouthExcited.setAttribute('stroke', '#10081c');
        mouthExcited.setAttribute('stroke-width', '1.3');
        mouthExcited.setAttribute('class', 'orb-mouth-excited');

        // 6. Scared Gasp Mouth (When Threatened)
        const mouthScared = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        mouthScared.setAttribute('cx', x);
        mouthScared.setAttribute('cy', y + this.cellSize * 0.16);
        mouthScared.setAttribute('rx', this.cellSize * 0.08);
        mouthScared.setAttribute('ry', this.cellSize * 0.10);
        mouthScared.setAttribute('fill', '#10081c');
        mouthScared.setAttribute('class', 'orb-mouth-scared');

        // 7. Triumphant Cheering Mouth
        const mouthTriumphant = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        mouthTriumphant.setAttribute('d', `M ${x - this.cellSize * 0.15} ${y + this.cellSize * 0.10} Q ${x} ${y + this.cellSize * 0.30} ${x + this.cellSize * 0.15} ${y + this.cellSize * 0.10} Z`);
        mouthTriumphant.setAttribute('fill', '#fb7185');
        mouthTriumphant.setAttribute('stroke', '#10081c');
        mouthTriumphant.setAttribute('stroke-width', '1.4');
        mouthTriumphant.setAttribute('class', 'orb-mouth-triumphant');

        // 8. Dismayed Jaw Drop (When Opponent gets a high combo)
        const mouthDismayed = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        mouthDismayed.setAttribute('cx', x);
        mouthDismayed.setAttribute('cy', y + this.cellSize * 0.18);
        mouthDismayed.setAttribute('rx', this.cellSize * 0.09);
        mouthDismayed.setAttribute('ry', this.cellSize * 0.13);
        mouthDismayed.setAttribute('fill', '#10081c');
        mouthDismayed.setAttribute('class', 'orb-mouth-dismayed');

        faceGroup.appendChild(blushLeft);
        faceGroup.appendChild(blushRight);
        faceGroup.appendChild(panicSweat);
        faceGroup.appendChild(eyesGroup);
        faceGroup.appendChild(scaredEyesGroup);
        faceGroup.appendChild(happyEyesGroup);
        faceGroup.appendChild(mouthNormal);
        faceGroup.appendChild(mouthSmug);
        faceGroup.appendChild(mouthNervous);
        faceGroup.appendChild(mouthPanic);
        faceGroup.appendChild(mouthExcited);
        faceGroup.appendChild(mouthScared);
        faceGroup.appendChild(mouthTriumphant);
        faceGroup.appendChild(mouthDismayed);

        group.appendChild(shadow);
        group.appendChild(circle);
        group.appendChild(glossHighlight);
        group.appendChild(glossCore);
        group.appendChild(faceGroup);

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

    triggerCaptureVFX(fromX, fromY, toX, toY, color, player = 'ruby') {
        const effectsGroup = document.getElementById('hex-effects-group');
        if (!effectsGroup) return;

        const isRuby = (player === 'ruby');

        // Trigger Canvas Particle Burst tailored to player
        if (this.particleEngine) {
            this.particleEngine.createCaptureBurst(toX, toY, color, player);
        }

        if (isRuby) {
            // =================================================================
            // RUBY: Crimson Bio-Magma Whip, Crystal Blades & Shatter Detonation
            // =================================================================
            // Helper function to generate coiling S-curve bio-plasma tendril
            const generateTendrilPath = (x1, y1, x2, y2, amplitude = 18, flip = 1) => {
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const nx = -(y2 - y1);
                const ny = (x2 - x1);
                const len = Math.hypot(nx, ny) || 1;
                const ux = (nx / len) * amplitude * flip;
                const uy = (ny / len) * amplitude * flip;

                const c1x = (x1 + mx) / 2 + ux;
                const c1y = (y1 + my) / 2 + uy;
                const c2x = (mx + x2) / 2 - ux;
                const c2y = (my + y2) / 2 - uy;

                return `M ${x1} ${y1} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x2} ${y2}`;
            };

            // 1. Primary Burning Crimson Bio-Plasma Tendril
            const tendrilMain = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tendrilMain.setAttribute('d', generateTendrilPath(fromX, fromY, toX, toY, 20, 1));
            tendrilMain.setAttribute('stroke', '#ff2d60');
            tendrilMain.setAttribute('fill', 'none');
            tendrilMain.setAttribute('stroke-linecap', 'round');
            tendrilMain.setAttribute('class', 'svg-ruby-tendril-main');
            effectsGroup.appendChild(tendrilMain);

            // 2. Secondary Glowing Golden-Amber Core Tendril (Counter-coiled)
            const tendrilCore = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tendrilCore.setAttribute('d', generateTendrilPath(fromX, fromY, toX, toY, 14, -1));
            tendrilCore.setAttribute('stroke', '#fbbf24');
            tendrilCore.setAttribute('fill', 'none');
            tendrilCore.setAttribute('stroke-linecap', 'round');
            tendrilCore.setAttribute('class', 'svg-ruby-tendril-core');
            effectsGroup.appendChild(tendrilCore);

            // 3. Expanding Crimson Magma Shockwave Ring
            const magmaShockwave = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            magmaShockwave.setAttribute('cx', toX);
            magmaShockwave.setAttribute('cy', toY);
            magmaShockwave.setAttribute('r', '14');
            magmaShockwave.setAttribute('fill', 'none');
            magmaShockwave.setAttribute('stroke', '#ff2d60');
            magmaShockwave.setAttribute('class', 'svg-ruby-magma-shockwave');
            effectsGroup.appendChild(magmaShockwave);

            // 4. Hexagonal Crystal Shatter Core Ring
            const crystalRing = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            crystalRing.setAttribute('points', HexMath.getHexPolygonPoints(toX, toY, 26));
            crystalRing.setAttribute('fill', 'rgba(255, 45, 96, 0.22)');
            crystalRing.setAttribute('stroke', '#ff2d60');
            crystalRing.setAttribute('class', 'svg-capture-ruby-crystal');
            effectsGroup.appendChild(crystalRing);

            // 5. 6 Directional Crystal Spike Blades
            for (let i = 0; i < 6; i++) {
                const angle = (i * 60) * Math.PI / 180;
                const dist = 32;
                const tx = Math.cos(angle) * dist;
                const ty = Math.sin(angle) * dist;

                const blade = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const s = 4.5;
                blade.setAttribute('points', `${toX},${toY - s * 1.8} ${toX + s},${toY} ${toX},${toY + s * 1.8} ${toX - s},${toY}`);
                blade.setAttribute('fill', i % 2 === 0 ? '#ff2d60' : '#ffd000');
                blade.setAttribute('class', 'svg-ruby-crystal-blade');
                blade.style.setProperty('--tx', `${tx}px`);
                blade.style.setProperty('--ty', `${ty}px`);
                effectsGroup.appendChild(blade);
                setTimeout(() => blade.remove(), 480);
            }

            // 6. 8 Radiating Diamond Ruby Shards & Amber Embers
            for (let i = 0; i < 8; i++) {
                const angle = (i * 45 + (Math.random() - 0.5) * 20) * Math.PI / 180;
                const dist = 24 + Math.random() * 12;
                const tx = Math.cos(angle) * dist;
                const ty = Math.sin(angle) * dist;

                const spark = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const s = 3.2;
                spark.setAttribute('points', `${toX},${toY - s * 1.2} ${toX + s},${toY} ${toX},${toY + s * 1.2} ${toX - s},${toY}`);
                spark.setAttribute('fill', i % 2 === 0 ? '#ff2d60' : '#fbbf24');
                spark.setAttribute('class', 'svg-gem-spark-ruby');
                spark.style.setProperty('--tx', `${tx}px`);
                spark.style.setProperty('--ty', `${ty}px`);
                effectsGroup.appendChild(spark);
                setTimeout(() => spark.remove(), 450);
            }

            // 7. Floating +1 Score Pop
            const scoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            scoreText.setAttribute('x', toX);
            scoreText.setAttribute('y', toY - 6);
            scoreText.setAttribute('text-anchor', 'middle');
            scoreText.setAttribute('fill', '#ff2d60');
            scoreText.setAttribute('font-size', '13');
            scoreText.setAttribute('class', 'svg-score-pop');
            scoreText.textContent = '+1';
            effectsGroup.appendChild(scoreText);

            setTimeout(() => {
                tendrilMain.remove();
                tendrilCore.remove();
                magmaShockwave.remove();
                crystalRing.remove();
                scoreText.remove();
            }, 550);

        } else {
            // =================================================================
            // PEARL: Authentic 1993 High-Voltage Electric Zap (Zigzag Lightning)
            // =================================================================
            // Helper function to generate jagged zigzag lightning bolt geometry
            const generateLightningPath = (x1, y1, x2, y2, segments = 5, offset = 14) => {
                let d = `M ${x1} ${y1}`;
                const dx = (x2 - x1) / segments;
                const dy = (y2 - y1) / segments;
                const nx = -(y2 - y1);
                const ny = (x2 - x1);
                const len = Math.hypot(nx, ny) || 1;
                const ux = nx / len;
                const uy = ny / len;

                for (let i = 1; i < segments; i++) {
                    const jitter = (Math.random() - 0.5) * offset * 2;
                    const px = (x1 + dx * i + ux * jitter).toFixed(1);
                    const py = (y1 + dy * i + uy * jitter).toFixed(1);
                    d += ` L ${px} ${py}`;
                }
                d += ` L ${x2} ${y2}`;
                return d;
            };

            // 1. Primary Jagged Cyan Electric Lightning Bolt
            const boltMain = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            boltMain.setAttribute('d', generateLightningPath(fromX, fromY, toX, toY, 6, 12));
            boltMain.setAttribute('stroke', '#00e5ff');
            boltMain.setAttribute('fill', 'none');
            boltMain.setAttribute('stroke-linecap', 'round');
            boltMain.setAttribute('stroke-linejoin', 'bevel');
            boltMain.setAttribute('class', 'svg-electric-bolt-main');
            effectsGroup.appendChild(boltMain);

            // 2. Secondary High-Voltage White Core Lightning Arc
            const boltCore = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            boltCore.setAttribute('d', generateLightningPath(fromX, fromY, toX, toY, 5, 8));
            boltCore.setAttribute('stroke', '#ffffff');
            boltCore.setAttribute('fill', 'none');
            boltCore.setAttribute('stroke-linecap', 'round');
            boltCore.setAttribute('stroke-linejoin', 'bevel');
            boltCore.setAttribute('class', 'svg-electric-bolt-core');
            effectsGroup.appendChild(boltCore);

            // 3. Crackling Electric Cage Rings around Converted Pearl
            const zapCage = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            zapCage.setAttribute('cx', toX);
            zapCage.setAttribute('cy', toY);
            zapCage.setAttribute('r', '20');
            zapCage.setAttribute('fill', 'none');
            zapCage.setAttribute('stroke', '#00e5ff');
            zapCage.setAttribute('class', 'svg-electric-zap-cage');
            effectsGroup.appendChild(zapCage);

            // 4. Radiating Electric Zap Sparks (8 branching spark needles)
            for (let i = 0; i < 8; i++) {
                const angle = (i * 45 + (Math.random() - 0.5) * 20) * Math.PI / 180;
                const dist = 24 + Math.random() * 8;
                const tx = Math.cos(angle) * dist;
                const ty = Math.sin(angle) * dist;

                const spark = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                spark.setAttribute('x1', toX);
                spark.setAttribute('y1', toY);
                spark.setAttribute('x2', toX + tx);
                spark.setAttribute('y2', toY + ty);
                spark.setAttribute('stroke', i % 2 === 0 ? '#00e5ff' : '#ffffff');
                spark.setAttribute('class', 'svg-electric-zap-spark');
                effectsGroup.appendChild(spark);
                setTimeout(() => spark.remove(), 420);
            }

            // 5. Floating +1 Score Pop
            const scoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            scoreText.setAttribute('x', toX);
            scoreText.setAttribute('y', toY - 6);
            scoreText.setAttribute('text-anchor', 'middle');
            scoreText.setAttribute('fill', '#00e5ff');
            scoreText.setAttribute('font-size', '13');
            scoreText.setAttribute('class', 'svg-score-pop');
            scoreText.textContent = '+1';
            effectsGroup.appendChild(scoreText);

            setTimeout(() => {
                boltMain.remove();
                boltCore.remove();
                zapCage.remove();
                scoreText.remove();
            }, 520);
        }
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
                        pieceEl.classList.add('piece-capture-threat', 'orb-state-scared');
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
                this.activeThreatPieceElements[i].classList.remove('piece-capture-threat', 'orb-state-scared');
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

        // Update Piece active/selected facial states
        this.pieceElements.forEach((pieceEl, key) => {
            if (key === this.selectedCell) {
                pieceEl.classList.add('orb-state-selected');
            } else {
                pieceEl.classList.remove('orb-state-selected');
            }
        });

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

    updatePieceEmotions() {
        if (!this.state || !this.state.board) return;
        const scores = this.calculateScores();
        const totalPieces = Object.values(scores).reduce((a, b) => a + b, 0);

        // Compute Worms-style leverage and emotional atmosphere per team
        const playerMoods = {};
        for (const p of this.state.players) {
            const myScore = scores[p] || 0;
            if (myScore === 0) {
                playerMoods[p] = 'panic';
                continue;
            }

            const otherScores = this.state.players.filter(op => op !== p).map(op => scores[op] || 0);
            const maxOther = Math.max(0, ...otherScores);
            const avgOther = otherScores.length > 0 ? (otherScores.reduce((a, b) => a + b, 0) / otherScores.length) : 0;
            const diff = myScore - avgOther;

            if (myScore <= 2 && totalPieces >= 10) {
                // Last survivors hanging on for dear life -> Panic, shivering teeth
                playerMoods[p] = 'panic';
            } else if (diff >= 4 || (myScore >= 7 && myScore >= maxOther * 1.5)) {
                // Clear lead / dominance -> Smug, cocky smirk
                playerMoods[p] = 'smug';
            } else if (diff <= -4 || (maxOther >= 7 && maxOther >= myScore * 1.5)) {
                // Trailing significantly -> Nervous, uneasy sweating
                playerMoods[p] = 'nervous';
            } else {
                // Balanced / close battle -> Focused, resolute alert smile
                playerMoods[p] = 'focused';
            }
        }

        // Apply moods to every piece element on the board
        this.pieceElements.forEach((pieceEl, key) => {
            const owner = this.state.board[key];
            if (owner && pieceEl) {
                const mood = playerMoods[owner] || 'focused';
                pieceEl.setAttribute('data-mood', mood);
            }
        });
    }

    triggerComboReactions(capturingPlayer, captureCount) {
        if (!this.pieceElements || captureCount < 2) return;
        const duration = 500; // Snappy, non-distracting arcade feedback

        this.pieceElements.forEach((pieceEl, key) => {
            const owner = this.state.board[key];
            if (owner === capturingPlayer) {
                pieceEl.classList.remove('orb-mood-combo-dismayed');
                pieceEl.classList.add('orb-mood-combo-cheering');
            } else {
                pieceEl.classList.remove('orb-mood-combo-cheering');
                pieceEl.classList.add('orb-mood-combo-dismayed');
            }
        });

        if (this._comboReactionTimer) {
            clearTimeout(this._comboReactionTimer);
        }

        this._comboReactionTimer = setTimeout(() => {
            this.pieceElements.forEach((pieceEl) => {
                pieceEl.classList.remove('orb-mood-combo-cheering', 'orb-mood-combo-dismayed');
            });
            this.updatePieceEmotions();
        }, duration);
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

                // Worms-style team celebration / shock combo reactions
                this.triggerComboReactions(player, capCount);
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
                    newPiece.classList.add('piece-converting', player === 'ruby' ? 'piece-converting-ruby' : 'piece-converting-pearl');
                    this.pieceElements.set(capKey, newPiece);

                    const piecesGroup = document.getElementById('hex-pieces-group');
                    if (piecesGroup) {
                        piecesGroup.appendChild(newPiece);
                    }

                    // 3. Trigger 8-Bit Retro Explosion Sound & VFX
                    sound.playCaptureStep(idx, move.captures.length, player);
                    this.triggerCaptureVFX(landingCoords.x, landingCoords.y, capCoords.x, capCoords.y, playerColor, player);
                }, idx * 35);
            });

            await new Promise(resolve => setTimeout(resolve, Math.min(260, move.captures.length * 35 + 80)));
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

                    // Snappy AI Pacing window (just enough to see AI move, zero sluggish delay)
                    await new Promise(resolve => setTimeout(resolve, 220));

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
