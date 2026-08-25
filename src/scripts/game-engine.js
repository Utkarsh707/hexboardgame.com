/**
 * High-Performance Hexxagon Game State Controller & Native Vector VFX Board
 * - Native SVG vector infection beams, expanding rings, diamond sparks, and score pops
 * - 100% precision coordinate locking (zero canvas desync or DPI scaling drift)
 * - Incremental 60/120 FPS piece updates and authentic arcade game-feel
 */

import { HexMath } from './hex-math.js';
import { PLAYERS, BOARD_PRESETS } from './boards.js';
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
        this.gameMode = options.gameMode || 'pve-medium';

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
        const boardData = preset.generate();

        this.state = {
            cells: boardData.cells,
            cellSet: new Set(boardData.cells),
            board: { ...boardData.initialPieces },
            obstacles: new Set(boardData.obstacles || []),
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

        this.renderBoard();
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
            isAi: this.isCurrentPlayerAi()
        });
    }

    getCurrentPlayer() {
        return this.state.players[this.state.currentTurnIndex];
    }

    isCurrentPlayerAi() {
        if (this.gameMode === 'pvp') return false;
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

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <!-- 3D Ruby Radial Gradient -->
            <radialGradient id="grad-ruby" cx="30%" cy="26%" r="72%">
                <stop offset="0%" stop-color="#ff7b96"/>
                <stop offset="22%" stop-color="#ff0844"/>
                <stop offset="60%" stop-color="#ba002c"/>
                <stop offset="90%" stop-color="#5a0014"/>
                <stop offset="100%" stop-color="#240008"/>
            </radialGradient>
            <!-- 3D Pearl Radial Gradient -->
            <radialGradient id="grad-pearl" cx="30%" cy="26%" r="72%">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="25%" stop-color="#f2f7fc"/>
                <stop offset="60%" stop-color="#c5d1d9"/>
                <stop offset="85%" stop-color="#607d8b"/>
                <stop offset="100%" stop-color="#263238"/>
            </radialGradient>
            <!-- 3D Emerald Radial Gradient -->
            <radialGradient id="grad-emerald" cx="30%" cy="26%" r="72%">
                <stop offset="0%" stop-color="#a7f3d0"/>
                <stop offset="22%" stop-color="#00e676"/>
                <stop offset="60%" stop-color="#059669"/>
                <stop offset="90%" stop-color="#064e3b"/>
                <stop offset="100%" stop-color="#022c22"/>
            </radialGradient>
        `;
        this.svgContainer.appendChild(defs);

        const cellsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        cellsGroup.setAttribute('id', 'hex-cells-group');

        const piecesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        piecesGroup.setAttribute('id', 'hex-pieces-group');

        const movesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        movesGroup.setAttribute('id', 'hex-moves-group');

        const effectsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        effectsGroup.setAttribute('id', 'hex-effects-group');

        const cells = this.state.cells;
        for (let i = 0; i < cells.length; i++) {
            const key = cells[i];
            const { q, r } = HexMath.parseKey(key);
            const { x, y } = HexMath.hexToPixel(q, r, this.cellSize, this.originX, this.originY);
            const points = HexMath.getHexPolygonPoints(x, y, this.cellSize - 1.5);

            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', points);
            polygon.setAttribute('data-key', key);
            polygon.setAttribute('class', 'hex-cell hex-cell-empty');
            polygon.setAttribute('tabindex', '0');
            polygon.setAttribute('role', 'button');
            polygon.setAttribute('aria-label', `Hex cell ${key}`);

            if (this.lastMove) {
                if (key === this.lastMove.toKey) {
                    polygon.classList.add('hex-cell-last-dest');
                    const playerColor = PLAYERS[this.lastMove.player]?.color || '#00e5ff';
                    polygon.style.stroke = playerColor;
                } else if (this.lastMove.type === 'jump' && key === this.lastMove.fromKey) {
                    polygon.classList.add('hex-cell-last-origin');
                }
            }

            polygon.addEventListener('click', () => this.handleCellClick(key));
            polygon.addEventListener('mouseenter', () => this.previewCaptures(key));
            polygon.addEventListener('mouseleave', () => this.clearCapturePreviews());

            this.cellElements.set(key, polygon);
            cellsGroup.appendChild(polygon);

            // Render Piece if present
            const pieceOwner = this.state.board[key];
            if (pieceOwner) {
                const pieceEl = this.createPieceElement(key, pieceOwner, x, y);
                this.pieceElements.set(key, pieceEl);
                piecesGroup.appendChild(pieceEl);
            }
        }

        this.svgContainer.appendChild(cellsGroup);
        this.svgContainer.appendChild(piecesGroup);
        this.svgContainer.appendChild(movesGroup);
        this.svgContainer.appendChild(effectsGroup);

        this.updateHighlights();
    }

    createPieceElement(key, owner, x, y) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('data-piece-key', key);
        group.setAttribute('data-owner', owner);
        group.setAttribute('class', 'hex-piece');
        group.style.cursor = (owner === this.getCurrentPlayer() && !this.isAiTurn) ? 'pointer' : 'default';
        group.style.transformOrigin = `${x}px ${y}px`;
        group.style.transformBox = 'view-box';

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
        circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.45)');
        circle.setAttribute('stroke-width', '1.2');

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

        group.appendChild(shadow);
        group.appendChild(circle);
        group.appendChild(glossHighlight);
        group.appendChild(glossCore);

        group.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleCellClick(key);
        });

        return group;
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
        beam.setAttribute('stroke-width', '3');
        beam.setAttribute('stroke-linecap', 'round');
        beam.setAttribute('class', 'svg-infection-beam');
        effectsGroup.appendChild(beam);

        // 2. Vector Shockwave Expanding Ring at Converted Piece
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', toX);
        ring.setAttribute('cy', toY);
        ring.setAttribute('r', '10');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', color);
        ring.setAttribute('stroke-width', '3.5');
        ring.setAttribute('class', 'svg-capture-ring');
        effectsGroup.appendChild(ring);

        // 3. Symmetrical Diamond Gem Sparks Bursting Outward
        for (let i = 0; i < 6; i++) {
            const angle = (i * 60 + (Math.random() - 0.5) * 20) * Math.PI / 180;
            const dist = 24 + Math.random() * 8;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;

            const spark = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const s = 3.5;
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

    triggerBoardShake() {
        if (typeof window !== 'undefined' && localStorage.getItem('hexxagon_shake') === 'false') return;
        const boardViewport = document.getElementById('board-viewport');
        if (boardViewport) {
            boardViewport.classList.remove('board-rumble');
            void boardViewport.offsetWidth; // force reflow
            boardViewport.classList.add('board-rumble');
        }
    }

    previewCaptures(targetKey) {
        if (!this.selectedCell || !targetKey || this.currentHoveredKey === targetKey) return;
        this.clearCapturePreviews();
        this.currentHoveredKey = targetKey;

        const move = this.validMoves.find(m => m.toKey === targetKey);
        if (move && move.captures && move.captures.length > 0) {
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

    handleCellClick(key) {
        if (this.isGameOver || this.isAiTurn) return;
        this.clearCapturePreviews();

        const pieceOwner = this.state.board[key];
        const currentTurn = this.getCurrentPlayer();

        // 1. If clicking own piece -> select it
        if (pieceOwner === currentTurn) {
            if (this.selectedCell === key) {
                // Deselect
                this.selectedCell = null;
                this.validMoves = [];
                sound.playDeselect();
            } else {
                this.selectedCell = key;
                const from = HexMath.parseKey(key);
                const reachables = HexMath.getReachableHexes(from, 2);
                const validCells = this.state.cellSet;

                this.validMoves = reachables
                    .filter(t => {
                        const targetKey = HexMath.key(t.q, t.r);
                        return validCells.has(targetKey) && !this.state.board[targetKey];
                    })
                    .map(t => ({
                        from,
                        to: t,
                        fromKey: key,
                        toKey: HexMath.key(t.q, t.r),
                        type: t.type,
                        captures: HexxagonAI.getCaptures(this.state, t, currentTurn)
                    }));

                sound.playSelect();
            }
            this.updateHighlights();
            return;
        }

        // 2. If a piece is already selected and clicking a valid target -> make move
        if (this.selectedCell) {
            const move = this.validMoves.find(m => m.toKey === key);
            if (move) {
                this.executeMove(move);
            } else {
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
            if (key === this.selectedCell) {
                poly.classList.add('hex-cell-selected');
                const owner = this.state.board[key];
                poly.style.stroke = PLAYERS[owner]?.color || '#ffffff';
            } else if (this.lastMove && key === this.lastMove.toKey) {
                poly.classList.add('hex-cell-last-dest');
                const playerColor = PLAYERS[this.lastMove.player]?.color || '#00e5ff';
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
            const color = isClone ? '#00e676' : '#ffab00';
            const fillColor = isClone ? 'rgba(0, 230, 118, 0.22)' : 'rgba(255, 171, 0, 0.22)';

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
            moveCount: this.state.moveCount
        });

        // Exact SVG Coordinate Calculation
        const toCoords = HexMath.hexToPixel(move.to.q, move.to.r, this.cellSize, this.originX, this.originY);
        const fromCoords = HexMath.hexToPixel(move.from.q, move.from.r, this.cellSize, this.originX, this.originY);
        const playerColor = PLAYERS[player]?.color || '#ff2d60';

        const piecesGroup = document.getElementById('hex-pieces-group');

        if (move.type === 'clone') {
            sound.playClone();
            if (this.particleEngine) {
                this.particleEngine.createShockwave(toCoords.x, toCoords.y, playerColor, 45);
                this.particleEngine.createSparks(toCoords.x, toCoords.y, playerColor, 8, 1.0);
            }

            // Create cloned piece element with pop-in animation
            const newPiece = this.createPieceElement(move.toKey, player, toCoords.x, toCoords.y);
            newPiece.classList.add('piece-popping-in');
            this.pieceElements.set(move.toKey, newPiece);
            if (piecesGroup) piecesGroup.appendChild(newPiece);

        } else {
            // Jump move
            sound.playJump();
            if (this.particleEngine) {
                this.particleEngine.createJumpTrail(fromCoords.x, fromCoords.y, toCoords.x, toCoords.y, playerColor, 12);
                this.particleEngine.createShockwave(toCoords.x, toCoords.y, playerColor, 50);
                this.particleEngine.createSparks(toCoords.x, toCoords.y, playerColor, 8, 1.0);
            }

            // Move existing piece element
            const jumpingPiece = this.pieceElements.get(move.fromKey);
            this.pieceElements.delete(move.fromKey);

            if (jumpingPiece && piecesGroup) {
                jumpingPiece.remove();
            }

            const newPiece = this.createPieceElement(move.toKey, player, toCoords.x, toCoords.y);
            newPiece.classList.add('piece-popping-in');
            this.pieceElements.set(move.toKey, newPiece);
            if (piecesGroup) piecesGroup.appendChild(newPiece);
        }

        // Apply Move State
        this.lastMove = {
            fromKey: move.fromKey,
            toKey: move.toKey,
            type: move.type,
            player
        };

        this.state = HexxagonAI.applyMove(this.state, move, player);
        this.state.moveCount++;

        // Staggered conversion audio & native vector animation
        if (move.captures.length > 0) {
            this.triggerBoardShake();
            sound.playCapture(move.captures.length);

            move.captures.forEach((capKey, idx) => {
                setTimeout(() => {
                    const capPiece = this.pieceElements.get(capKey);
                    if (capPiece) {
                        capPiece.setAttribute('data-owner', player);
                        const circleBody = capPiece.querySelector('.gem-circle-body') || capPiece.querySelector('circle');
                        if (circleBody) {
                            circleBody.setAttribute('fill', `url(#grad-${player})`);
                        }
                        capPiece.classList.remove('piece-converting');
                        void capPiece.offsetWidth; // Trigger reflow for animation restart
                        capPiece.classList.add('piece-converting');
                    }

                    const capPos = HexMath.parseKey(capKey);
                    const capCoords = HexMath.hexToPixel(capPos.q, capPos.r, this.cellSize, this.originX, this.originY);

                    // Trigger Native Vector VFX (Beam, Shockwave Ring, Sparks, Floating +1)
                    this.triggerCaptureVFX(toCoords.x, toCoords.y, capCoords.x, capCoords.y, playerColor);
                }, idx * 55);
            });

            await new Promise(resolve => setTimeout(resolve, Math.min(500, move.captures.length * 55 + 180)));
        }

        this.updateHighlights();
        this.emit('moveMade', { move, player });
        this.notifyState();

        // Advance Turn
        await this.advanceTurn();
    }

    async advanceTurn() {
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
        const color = PLAYERS[winnerPlayer]?.color || '#00e5ff';

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

        if (winner === 'ruby' || (winner !== 'pearl' && winner !== 'tie')) {
            sound.playVictory();
        } else if (winner === 'pearl' && this.gameMode.startsWith('pve-')) {
            sound.playDefeat();
        }

        this.saveStats(winner, scores);

        this.emit('gameOver', {
            winner,
            winnerInfo: PLAYERS[winner] || null,
            isTie,
            scores,
            moveCount: this.state.moveCount
        });
    }

    saveStats(winner, scores) {
        if (typeof window === 'undefined') return;
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
