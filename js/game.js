/**
 * Hexxagon Game State Machine & Rules Engine
 */

import { HexMath } from './hex-math.js';
import { BOARD_PRESETS, PLAYERS } from './boards.js';
import { HexxagonAI } from './ai.js';

export class GameEngine {
    constructor(presetKey = 'classic', mode = 'ai', difficulty = 'medium') {
        this.presetKey = presetKey;
        this.mode = mode; // 'ai' (1P vs AI), 'pvp' (2P local), 'trio' (3P local/AI)
        this.difficulty = difficulty;
        this.ai = new HexxagonAI(difficulty);

        this.cells = [];
        this.board = {};
        this.obstacles = [];
        this.players = ['ruby', 'pearl'];
        this.currentPlayerIndex = 0;
        this.selectedKey = null;
        this.validMoves = [];
        this.history = [];
        this.redoStack = [];
        this.isGameOver = false;
        this.winner = null;
        this.stats = { ruby: 0, pearl: 0, emerald: 0, empty: 0 };
        this.isBusy = false; // Prevents interactions during animations/AI thinking

        // Event callbacks
        this.listeners = {
            stateChange: [],
            moveExecuted: [],
            conversions: [],
            turnSkipped: [],
            gameOver: []
        };

        this.loadPreset(presetKey);
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

    loadPreset(presetKey) {
        const preset = BOARD_PRESETS[presetKey] || BOARD_PRESETS.classic;
        this.presetKey = preset.id;
        this.players = [...preset.players];
        const layout = preset.generate();

        this.cells = layout.cells;
        this.board = { ...layout.initialPieces };
        this.obstacles = layout.obstacles || [];

        // Mark obstacles on board
        for (const obs of this.obstacles) {
            this.board[obs] = 'obstacle';
        }

        this.currentPlayerIndex = 0;
        this.selectedKey = null;
        this.validMoves = [];
        this.history = [];
        this.redoStack = [];
        this.isGameOver = false;
        this.winner = null;
        this.isBusy = false;

        this.updateStats();
        this.emit('stateChange', this.getStateSnapshot());
    }

    get activePlayer() {
        return this.players[this.currentPlayerIndex];
    }

    getStateSnapshot() {
        return {
            cells: [...this.cells],
            board: { ...this.board },
            obstacles: [...this.obstacles],
            players: [...this.players],
            activePlayer: this.activePlayer,
            selectedKey: this.selectedKey,
            validMoves: [...this.validMoves],
            stats: { ...this.stats },
            isGameOver: this.isGameOver,
            winner: this.winner,
            mode: this.mode,
            canUndo: this.history.length > 0 && !this.isBusy,
            canRedo: this.redoStack.length > 0 && !this.isBusy
        };
    }

    updateStats() {
        const counts = { ruby: 0, pearl: 0, emerald: 0, empty: 0 };
        const validCells = new Set(this.cells);

        for (const cell of this.cells) {
            const piece = this.board[cell];
            if (piece && piece !== 'obstacle' && counts[piece] !== undefined) {
                counts[piece]++;
            } else if (!piece) {
                counts.empty++;
            }
        }
        this.stats = counts;
    }

    /**
     * Select a piece on the board
     */
    selectPiece(key) {
        if (this.isGameOver || this.isBusy) return false;

        // If clicking on already selected piece, deselect
        if (this.selectedKey === key) {
            this.clearSelection();
            this.emit('stateChange', this.getStateSnapshot());
            return true;
        }

        // Must click a piece belonging to the active player
        const owner = this.board[key];
        if (owner !== this.activePlayer) {
            return false;
        }

        this.selectedKey = key;
        const from = HexMath.parseKey(key);
        const reachables = HexMath.getReachableHexes(from, 2);
        const validCells = new Set(this.cells);

        this.validMoves = [];
        for (const target of reachables) {
            const targetKey = HexMath.key(target.q, target.r);
            if (validCells.has(targetKey) && !this.board[targetKey]) {
                const captures = HexxagonAI.getCaptures({ board: this.board }, target, this.activePlayer);
                this.validMoves.push({
                    fromKey: key,
                    toKey: targetKey,
                    from,
                    to: target,
                    type: target.type, // 'clone' or 'jump'
                    captures
                });
            }
        }

        this.emit('stateChange', this.getStateSnapshot());
        return true;
    }

    clearSelection() {
        this.selectedKey = null;
        this.validMoves = [];
    }

    /**
     * Attempt to move the currently selected piece to targetKey
     */
    async makeMove(targetKey) {
        if (!this.selectedKey || this.isGameOver || this.isBusy) return false;

        const move = this.validMoves.find(m => m.toKey === targetKey);
        if (!move) return false;

        return await this.executeMove(move);
    }

    /**
     * Execute a move object {fromKey, toKey, type, captures}
     */
    async executeMove(move) {
        this.isBusy = true;
        const player = this.activePlayer;

        // Save history for Undo
        this.history.push({
            board: { ...this.board },
            currentPlayerIndex: this.currentPlayerIndex,
            move
        });
        this.redoStack = []; // Clear redo on new move

        // Apply piece move
        if (move.type === 'jump') {
            delete this.board[move.fromKey];
        }
        this.board[move.toKey] = player;

        this.clearSelection();
        this.updateStats();

        this.emit('moveExecuted', {
            player,
            move
        });

        // Trigger conversion animations
        if (move.captures && move.captures.length > 0) {
            // Short delay for visual polish before flips
            await new Promise(r => setTimeout(r, 120));

            for (const capKey of move.captures) {
                this.board[capKey] = player;
            }
            this.updateStats();

            this.emit('conversions', {
                player,
                captures: move.captures
            });
        }

        await new Promise(r => setTimeout(r, 180));
        this.advanceTurn();
        this.isBusy = false;
        return true;
    }

    /**
     * Switch to next player and check for game over / turn skipping
     */
    async advanceTurn() {
        let attempts = 0;
        let nextPlayerFound = false;

        while (attempts < this.players.length) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            const nextPlayer = this.activePlayer;
            attempts++;

            // Check if this player has pieces left
            if (this.stats[nextPlayer] === 0) {
                continue;
            }

            // Check if this player has any legal moves
            const moves = HexxagonAI.getLegalMoves({ board: this.board, cells: this.cells }, nextPlayer);
            if (moves.length > 0) {
                nextPlayerFound = true;
                break;
            } else {
                // Player is trapped and must pass
                this.emit('turnSkipped', { player: nextPlayer });
                await new Promise(r => setTimeout(r, 600));
            }
        }

        // Check End Game Conditions
        const alivePlayers = this.players.filter(p => this.stats[p] > 0);
        const totalEmpty = this.stats.empty;

        if (!nextPlayerFound || alivePlayers.length <= 1 || totalEmpty === 0) {
            this.finishGame();
            return;
        }

        this.emit('stateChange', this.getStateSnapshot());

        // Trigger AI turn if applicable
        if (this.mode === 'ai' && this.activePlayer === 'pearl' && !this.isGameOver) {
            this.triggerAITurn();
        }
    }

    /**
     * AI computation and move execution
     */
    async triggerAITurn() {
        this.isBusy = true;
        this.emit('stateChange', this.getStateSnapshot());

        try {
            const aiMove = await this.ai.getBestMove(
                { board: this.board, cells: this.cells },
                this.activePlayer,
                this.players
            );

            if (aiMove && !this.isGameOver) {
                // Show AI selecting piece briefly
                this.selectedKey = aiMove.fromKey;
                this.validMoves = [aiMove];
                this.emit('stateChange', this.getStateSnapshot());

                await new Promise(r => setTimeout(r, 260));
                await this.executeMove(aiMove);
            } else {
                this.advanceTurn();
            }
        } catch (err) {
            console.error('AI Error:', err);
            this.isBusy = false;
        }
    }

    /**
     * Compute game over results
     */
    finishGame() {
        this.isGameOver = true;
        this.clearSelection();
        this.updateStats();

        // Winner is the player with the highest piece count
        let highest = -1;
        let winners = [];

        for (const p of this.players) {
            const count = this.stats[p] || 0;
            if (count > highest) {
                highest = count;
                winners = [p];
            } else if (count === highest) {
                winners.push(p);
            }
        }

        this.winner = winners.length === 1 ? winners[0] : 'tie';

        this.emit('gameOver', {
            winner: this.winner,
            stats: this.stats,
            isTie: winners.length > 1
        });
        this.emit('stateChange', this.getStateSnapshot());
    }

    /**
     * Undo last move
     */
    undo() {
        if (this.history.length === 0 || this.isBusy) return false;

        // In 1P AI mode, undo 2 steps (AI + player) if possible
        const stepsToUndo = (this.mode === 'ai' && this.history.length >= 2) ? 2 : 1;

        for (let i = 0; i < stepsToUndo; i++) {
            if (this.history.length === 0) break;
            const lastState = this.history.pop();
            this.redoStack.push({
                board: { ...this.board },
                currentPlayerIndex: this.currentPlayerIndex
            });
            this.board = lastState.board;
            this.currentPlayerIndex = lastState.currentPlayerIndex;
        }

        this.isGameOver = false;
        this.winner = null;
        this.clearSelection();
        this.updateStats();
        this.emit('stateChange', this.getStateSnapshot());
        return true;
    }

    /**
     * Redo move
     */
    redo() {
        if (this.redoStack.length === 0 || this.isBusy) return false;

        const nextState = this.redoStack.pop();
        this.history.push({
            board: { ...this.board },
            currentPlayerIndex: this.currentPlayerIndex
        });
        this.board = nextState.board;
        this.currentPlayerIndex = nextState.currentPlayerIndex;

        this.clearSelection();
        this.updateStats();
        this.emit('stateChange', this.getStateSnapshot());
        return true;
    }
}
