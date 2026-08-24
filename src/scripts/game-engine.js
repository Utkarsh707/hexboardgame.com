/**
 * High-Performance Hexxagon Game State Controller & SVG Board Renderer
 * - Cached element maps for instantaneous O(1) hover lookups and 60 FPS transitions
 * - Lightweight particle triggers without idle overhead
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

        // Cached DOM Elements for zero-lag O(1) lookups
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
            moveMade: []
        };

        this.initGame();
        this.setupEventListeners();
    }

    on(event, cb) {
        if (this.listeners[event]) {
            this.listeners[event].push(cb);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    initGame(presetId = this.presetId) {
        this.clearCapturePreviews();
        this.presetId = presetId;
        const preset = BOARD_PRESETS[presetId] || BOARD_PRESETS.classic;
        const boardData = preset.generate();

        this.state = {
            cells: boardData.cells,
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
        players.forEach(p => scores[p] = 0);
        Object.values(board).forEach(p => {
            if (scores[p] !== undefined) {
                scores[p]++;
            }
        });
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
            isAi: this.isCurrentPlayerAi(),
            moveCount: this.state.moveCount
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
            <!-- Ruby Radial Gradient -->
            <radialGradient id="grad-ruby" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stop-color="#ff8fab"/>
                <stop offset="45%" stop-color="#ff2d60"/>
                <stop offset="100%" stop-color="#8a0026"/>
            </radialGradient>
            <!-- Pearl Radial Gradient -->
            <radialGradient id="grad-pearl" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="40%" stop-color="#00e5ff"/>
                <stop offset="100%" stop-color="#005b82"/>
            </radialGradient>
            <!-- Emerald Radial Gradient -->
            <radialGradient id="grad-emerald" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stop-color="#b9f6ca"/>
                <stop offset="40%" stop-color="#10b981"/>
                <stop offset="100%" stop-color="#064e3b"/>
            </radialGradient>
        `;
        this.svgContainer.appendChild(defs);

        const cellsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        cellsGroup.setAttribute('id', 'hex-cells-group');

        const piecesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        piecesGroup.setAttribute('id', 'hex-pieces-group');

        const movesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        movesGroup.setAttribute('id', 'hex-moves-group');

        this.state.cells.forEach(key => {
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

            polygon.addEventListener('click', () => this.handleCellClick(key));
            polygon.addEventListener('mouseenter', () => this.previewCaptures(key));
            polygon.addEventListener('mouseleave', () => this.clearCapturePreviews());
            polygon.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleCellClick(key);
                }
            });

            this.cellElements.set(key, polygon);
            cellsGroup.appendChild(polygon);

            // Render Piece if present
            const pieceOwner = this.state.board[key];
            if (pieceOwner) {
                const pieceEl = this.createPieceElement(key, pieceOwner, x, y);
                this.pieceElements.set(key, pieceEl);
                piecesGroup.appendChild(pieceEl);
            }
        });

        this.svgContainer.appendChild(cellsGroup);
        this.svgContainer.appendChild(piecesGroup);
        this.svgContainer.appendChild(movesGroup);

        this.updateHighlights();
    }

    createPieceElement(key, owner, x, y) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('data-piece-key', key);
        group.setAttribute('data-owner', owner);
        group.setAttribute('class', 'hex-piece');
        group.style.cursor = (owner === this.getCurrentPlayer() && !this.isAiTurn) ? 'pointer' : 'default';

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', this.cellSize * 0.58);
        circle.setAttribute('fill', `url(#grad-${owner})`);
        circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.45)');
        circle.setAttribute('stroke-width', '1.5');

        // Specular highlight gleam
        const gleam = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        gleam.setAttribute('cx', x - this.cellSize * 0.18);
        gleam.setAttribute('cy', y - this.cellSize * 0.18);
        gleam.setAttribute('r', this.cellSize * 0.18);
        gleam.setAttribute('fill', 'rgba(255, 255, 255, 0.7)');

        group.appendChild(circle);
        group.appendChild(gleam);

        group.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleCellClick(key);
        });

        return group;
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
                const validCells = new Set(this.state.cells);

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
            } else {
                poly.style.stroke = '';
            }
        });

        if (!this.selectedCell) return;

        // Render target dots/markers
        this.validMoves.forEach(move => {
            const { x, y } = HexMath.hexToPixel(move.to.q, move.to.r, this.cellSize, this.originX, this.originY);

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', move.type === 'clone' ? this.cellSize * 0.28 : this.cellSize * 0.22);
            circle.setAttribute('fill', move.type === 'clone' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(245, 158, 11, 0.9)');
            circle.setAttribute('stroke', '#ffffff');
            circle.setAttribute('stroke-width', '1.5');
            circle.style.cursor = 'pointer';

            if (move.type === 'clone') {
                circle.classList.add('hex-cell-clone-target');
            } else {
                circle.classList.add('hex-cell-jump-target');
            }

            // Hover preview ONLY on the tiles and balls affected by this specific candidate move
            circle.addEventListener('mouseenter', () => this.previewCaptures(move.toKey));
            circle.addEventListener('mouseleave', () => this.clearCapturePreviews());

            circle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.executeMove(move);
            });

            movesGroup.appendChild(circle);
        });
    }

    async executeMove(move) {
        const player = this.getCurrentPlayer();
        this.selectedCell = null;
        this.validMoves = [];
        this.updateHighlights();

        // Save history for Undo
        this.history.push({
            board: { ...this.state.board },
            currentTurnIndex: this.state.currentTurnIndex,
            moveCount: this.state.moveCount
        });

        // Audio & Particles for Move
        const toCoords = HexMath.hexToPixel(move.to.q, move.to.r, this.cellSize, this.originX, this.originY);
        const fromCoords = HexMath.hexToPixel(move.from.q, move.from.r, this.cellSize, this.originX, this.originY);

        if (move.type === 'clone') {
            sound.playClone();
            if (this.particleEngine) {
                this.particleEngine.createShockwave(toCoords.x, toCoords.y, PLAYERS[player].color, 45);
                this.particleEngine.createSparks(toCoords.x, toCoords.y, PLAYERS[player].color, 8, 1.0);
            }
        } else {
            sound.playJump();
            if (this.particleEngine) {
                this.particleEngine.createJumpTrail(fromCoords.x, fromCoords.y, toCoords.x, toCoords.y, PLAYERS[player].color, 10);
                this.particleEngine.createShockwave(toCoords.x, toCoords.y, PLAYERS[player].color, 50);
                this.particleEngine.createSparks(toCoords.x, toCoords.y, PLAYERS[player].color, 8, 1.0);
            }
        }

        // Apply Move State
        this.state = HexxagonAI.applyMove(this.state, move, player);
        this.state.moveCount++;
        this.renderBoard();

        // Staggered conversion audio & animation
        if (move.captures.length > 0) {
            sound.playCapture(move.captures.length);
            move.captures.forEach((capKey, idx) => {
                setTimeout(() => {
                    const capPiece = this.pieceElements.get(capKey);
                    if (capPiece) {
                        capPiece.classList.add('piece-converting');
                    }
                    const capPos = HexMath.parseKey(capKey);
                    const pos = HexMath.hexToPixel(capPos.q, capPos.r, this.cellSize, this.originX, this.originY);
                    if (this.particleEngine) {
                        this.particleEngine.createSparks(pos.x, pos.y, PLAYERS[player].color, 6, 0.8);
                    }
                }, idx * 50);
            });
        }

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
            // If only 1 player has legal moves remaining while spaces exist, sweep for that player
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
                this.isAiTurn = false;

                if (bestMove) {
                    await this.executeMove(bestMove);
                } else {
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

        // Rapid, rhythmic cascading fill (~36ms per tile for an energetic sweep)
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

            // High-energy ascending audio arpeggio & spark burst
            sound.playSweepPop(i, emptyCells.length);
            if (this.particleEngine) {
                this.particleEngine.createSparks(x, y, color, 4, 0.7);
            }

            this.notifyState();
            await new Promise(r => setTimeout(r, 36));
        }

        // Brief cinematic pause to savor the final filled board
        await new Promise(r => setTimeout(r, 350));
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
            if (this.particleEngine) {
                this.particleEngine.createVictoryConfetti();
            }
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

    setupEventListeners() {
        if (typeof window === 'undefined') return;

        window.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

            if (e.code === 'Space') {
                e.preventDefault();
                this.initGame();
            } else if (e.key === 'u' || e.key === 'U') {
                e.preventDefault();
                this.undo();
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                const muted = sound.toggleMute();
                this.emit('soundToggle', muted);
            }
        });
    }
}
