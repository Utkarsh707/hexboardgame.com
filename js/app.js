/**
 * Main Application Controller for Hexxagon
 * Wires UI, SVG rendering, animations, audio, and state machine.
 */

import { HexMath } from './hex-math.js';
import { BOARD_PRESETS, PLAYERS } from './boards.js';
import { GameEngine } from './game.js';
import { sound } from './audio.js';
import { ParticleEngine } from './particles.js';

class HexxagonApp {
    constructor() {
        this.svg = document.getElementById('board-svg');
        this.cellsLayer = document.getElementById('grid-cells-layer');
        this.indicatorsLayer = document.getElementById('grid-indicators-layer');
        this.piecesLayer = document.getElementById('grid-pieces-layer');
        this.particleCanvas = document.getElementById('particle-canvas');

        this.particles = new ParticleEngine(this.particleCanvas);
        this.hexSize = 28; // Hexagon radius in SVG coordinate units

        // UI Element References
        this.btnSound = document.getElementById('btn-sound');
        this.btnRules = document.getElementById('btn-rules');
        this.btnCloseRules = document.getElementById('btn-close-rules');
        this.modalRules = document.getElementById('modal-rules');
        this.modalGameOver = document.getElementById('modal-gameover');
        this.btnPlayAgain = document.getElementById('btn-play-again');
        this.btnDismissGameOver = document.getElementById('btn-dismiss-gameover');

        this.btnNewGame = document.getElementById('btn-new-game');
        this.btnUndo = document.getElementById('btn-undo');
        this.btnRedo = document.getElementById('btn-redo');
        this.selectMode = document.getElementById('select-mode');
        this.selectDifficulty = document.getElementById('select-difficulty');
        this.selectMap = document.getElementById('select-map');
        this.statusBanner = document.getElementById('status-banner');

        this.scoreRuby = document.getElementById('score-ruby');
        this.scorePearl = document.getElementById('score-pearl');
        this.scoreEmerald = document.getElementById('score-emerald');
        this.cardRuby = document.getElementById('card-ruby');
        this.cardPearl = document.getElementById('card-pearl');
        this.cardEmerald = document.getElementById('card-emerald');
        this.pearlTypeLabel = document.getElementById('pearl-type-label');

        // Initialize Game Engine
        this.game = new GameEngine(
            this.selectMap.value,
            this.selectMode.value,
            this.selectDifficulty.value
        );

        this.setupEventListeners();
        this.setupGameHooks();
        this.renderBoard();
        this.updateHUD(this.game.getStateSnapshot());
        this.updateSoundButton();
    }

    setupEventListeners() {
        // Sound toggle
        this.btnSound.addEventListener('click', () => {
            const isMuted = sound.toggleMute();
            this.updateSoundButton();
            if (!isMuted) sound.playSelect();
        });

        // Rules modal
        this.btnRules.addEventListener('click', () => {
            this.modalRules.classList.add('active');
            sound.playSelect();
        });
        this.btnCloseRules.addEventListener('click', () => {
            this.modalRules.classList.remove('active');
            sound.playDeselect();
        });
        this.modalRules.addEventListener('click', (e) => {
            if (e.target === this.modalRules) this.modalRules.classList.remove('active');
        });

        // Game Over modal buttons
        this.btnPlayAgain.addEventListener('click', () => {
            this.modalGameOver.classList.remove('active');
            this.startNewGame();
        });
        this.btnDismissGameOver.addEventListener('click', () => {
            this.modalGameOver.classList.remove('active');
            sound.playSelect();
        });

        // Action Toolbar
        this.btnNewGame.addEventListener('click', () => this.startNewGame());
        this.btnUndo.addEventListener('click', () => {
            if (this.game.undo()) sound.playDeselect();
        });
        this.btnRedo.addEventListener('click', () => {
            if (this.game.redo()) sound.playSelect();
        });

        // Select Controls
        this.selectMode.addEventListener('change', () => {
            const mode = this.selectMode.value;
            this.selectDifficulty.style.display = mode === 'ai' ? 'inline-block' : 'none';

            if (mode === 'trio') {
                this.selectMap.value = 'trio';
            } else if (this.selectMap.value === 'trio') {
                this.selectMap.value = 'classic';
            }

            this.updatePlayerLabels();
            this.startNewGame();
        });

        this.selectDifficulty.addEventListener('change', () => {
            this.game.ai.setDifficulty(this.selectDifficulty.value);
            this.updatePlayerLabels();
        });

        this.selectMap.addEventListener('change', () => {
            if (this.selectMap.value === 'trio') {
                this.selectMode.value = 'trio';
                this.selectDifficulty.style.display = 'none';
            } else if (this.selectMode.value === 'trio') {
                this.selectMode.value = 'ai';
                this.selectDifficulty.style.display = 'inline-block';
            }
            this.updatePlayerLabels();
            this.startNewGame();
        });
    }

    updatePlayerLabels() {
        const mode = this.selectMode.value;
        const diffText = this.selectDifficulty.options[this.selectDifficulty.selectedIndex].text.replace('AI: ', '');
        this.pearlTypeLabel.textContent = mode === 'ai' ? `AI (${diffText})` : 'Player 2';
    }

    updateSoundButton() {
        this.btnSound.textContent = sound.muted ? '🔇' : '🔊';
        this.btnSound.classList.toggle('active', !sound.muted);
    }

    startNewGame() {
        sound.playClone();
        this.game.mode = this.selectMode.value;
        this.game.loadPreset(this.selectMap.value);
        this.renderBoard();
        this.updateHUD(this.game.getStateSnapshot());
    }

    setupGameHooks() {
        this.game.on('stateChange', (state) => {
            this.updateBoard(state);
            this.updateHUD(state);
        });

        this.game.on('moveExecuted', ({ player, move }) => {
            const fromPos = HexMath.hexToPixel(move.from.q, move.from.r, this.hexSize);
            const toPos = HexMath.hexToPixel(move.to.q, move.to.r, this.hexSize);

            // Canvas coordinate conversion from SVG center origin (viewBox -260 -260 520 520)
            const canvasCenter = { x: this.particleCanvas.width / (2 * window.devicePixelRatio), y: this.particleCanvas.height / (2 * window.devicePixelRatio) };
            const scale = (this.particleCanvas.width / (window.devicePixelRatio)) / 520;

            const cFromX = canvasCenter.x + fromPos.x * scale;
            const cFromY = canvasCenter.y + fromPos.y * scale;
            const cToX = canvasCenter.x + toPos.x * scale;
            const cToY = canvasCenter.y + toPos.y * scale;

            const pColor = PLAYERS[player.toUpperCase()] ? PLAYERS[player.toUpperCase()].color : '#00e5ff';

            if (move.type === 'clone') {
                sound.playClone();
                this.particles.createShockwave(cToX, cToY, pColor, 55);
                this.particles.createSparks(cToX, cToY, pColor, 18);
            } else {
                sound.playJump();
                this.particles.createJumpTrail(cFromX, cFromY, cToX, cToY, pColor, 20);
                this.particles.createShockwave(cToX, cToY, pColor, 70);
                this.particles.createSparks(cToX, cToY, pColor, 24);
            }
        });

        this.game.on('conversions', ({ player, captures }) => {
            sound.playCapture(captures.length);
            const pColor = PLAYERS[player.toUpperCase()] ? PLAYERS[player.toUpperCase()].color : '#00e5ff';

            const canvasCenter = { x: this.particleCanvas.width / (2 * window.devicePixelRatio), y: this.particleCanvas.height / (2 * window.devicePixelRatio) };
            const scale = (this.particleCanvas.width / (window.devicePixelRatio)) / 520;

            captures.forEach(capKey => {
                const pos = HexMath.parseKey(capKey);
                const pix = HexMath.hexToPixel(pos.q, pos.r, this.hexSize);
                const cx = canvasCenter.x + pix.x * scale;
                const cy = canvasCenter.y + pix.y * scale;
                this.particles.createShockwave(cx, cy, pColor, 40);
                this.particles.createSparks(cx, cy, pColor, 12, 0.8);
            });
        });

        this.game.on('turnSkipped', ({ player }) => {
            sound.playPass();
            const pName = PLAYERS[player.toUpperCase()] ? PLAYERS[player.toUpperCase()].name : player;
            this.statusBanner.textContent = `⚠️ ${pName} has no valid moves and passes!`;
            this.statusBanner.classList.add('highlight');
            setTimeout(() => this.statusBanner.classList.remove('highlight'), 1500);
        });

        this.game.on('gameOver', ({ winner, stats, isTie }) => {
            if (winner === 'ruby') {
                sound.playVictory();
                this.particles.createVictoryConfetti();
            } else if (winner === 'pearl' && this.game.mode === 'ai') {
                sound.playDefeat();
            } else {
                sound.playVictory();
                this.particles.createVictoryConfetti();
            }

            this.showGameOverModal(winner, stats, isTie);
        });
    }

    showGameOverModal(winner, stats, isTie) {
        const trophy = document.getElementById('winner-trophy');
        const title = document.getElementById('winner-title');
        const subtitle = document.getElementById('winner-subtitle');

        document.getElementById('final-ruby-score').textContent = stats.ruby || 0;
        document.getElementById('final-pearl-score').textContent = stats.pearl || 0;

        const emeraldItem = document.getElementById('final-emerald-item');
        if (this.game.players.includes('emerald')) {
            emeraldItem.style.display = 'flex';
            document.getElementById('final-emerald-score').textContent = stats.emerald || 0;
        } else {
            emeraldItem.style.display = 'none';
        }

        if (isTie) {
            trophy.textContent = '🤝';
            title.textContent = "It's a Stalemate Tie!";
            subtitle.textContent = "Both players finished with identical territory counts.";
        } else {
            const pConfig = PLAYERS[winner.toUpperCase()];
            trophy.textContent = pConfig ? pConfig.icon : '🏆';
            title.textContent = `${pConfig ? pConfig.name : winner} Wins!`;
            title.style.color = pConfig ? pConfig.color : '#fff';
            subtitle.textContent = `Total dominance of the hexagonal grid with ${stats[winner]} pieces!`;
        }

        setTimeout(() => {
            this.modalGameOver.classList.add('active');
        }, 600);
    }

    renderBoard() {
        this.cellsLayer.innerHTML = '';
        this.indicatorsLayer.innerHTML = '';
        this.piecesLayer.innerHTML = '';

        const validCells = new Set(this.game.cells);
        const obstacles = new Set(this.game.obstacles);

        // Render Hex Background Cells
        for (const cellKey of this.game.cells) {
            const { q, r } = HexMath.parseKey(cellKey);
            const { x, y } = HexMath.hexToPixel(q, r, this.hexSize);
            const points = HexMath.getHexPolygonPoints(x, y, this.hexSize - 1.5);

            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', points);
            polygon.setAttribute('class', 'hex-cell');
            polygon.setAttribute('data-key', cellKey);
            polygon.id = `cell-${cellKey}`;

            polygon.addEventListener('click', () => this.handleCellClick(cellKey));
            polygon.addEventListener('mouseenter', () => this.handleCellHover(cellKey));
            polygon.addEventListener('mouseleave', () => this.handleCellLeave(cellKey));

            this.cellsLayer.appendChild(polygon);
        }

        // Render Obstacle Cells
        for (const obsKey of this.game.obstacles) {
            const { q, r } = HexMath.parseKey(obsKey);
            const { x, y } = HexMath.hexToPixel(q, r, this.hexSize);
            const points = HexMath.getHexPolygonPoints(x, y, this.hexSize - 1.5);

            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', points);
            polygon.setAttribute('class', 'hex-cell obstacle');
            polygon.setAttribute('fill', 'url(#obstacle-grad)');
            this.cellsLayer.appendChild(polygon);
        }

        this.updateBoard(this.game.getStateSnapshot());
    }

    updateBoard(state) {
        const { board, selectedKey, validMoves, activePlayer } = state;

        // Reset highlight states on all cells
        document.querySelectorAll('.hex-cell').forEach(cell => {
            cell.classList.remove('valid-clone', 'valid-jump', 'target-capture-preview');
        });

        this.indicatorsLayer.innerHTML = '';

        // Highlight valid move target cells
        validMoves.forEach(move => {
            const cellEl = document.getElementById(`cell-${move.toKey}`);
            if (cellEl) {
                cellEl.classList.add(move.type === 'clone' ? 'valid-clone' : 'valid-jump');

                // Render small indicator marker
                const pos = HexMath.hexToPixel(move.to.q, move.to.r, this.hexSize);
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', pos.x);
                circle.setAttribute('cy', pos.y);
                circle.setAttribute('r', move.type === 'clone' ? '5' : '4');
                circle.setAttribute('fill', move.type === 'clone' ? 'var(--clone-glow)' : 'var(--jump-glow)');
                circle.setAttribute('class', 'move-indicator');
                this.indicatorsLayer.appendChild(circle);
            }
        });

        // Synchronize Pieces Layer
        // Remove pieces that are no longer on board
        const existingPieces = this.piecesLayer.querySelectorAll('.hex-piece');
        existingPieces.forEach(pEl => {
            const key = pEl.getAttribute('data-key');
            if (!board[key] || board[key] === 'obstacle') {
                pEl.remove();
            }
        });

        // Add or update pieces
        for (const [key, owner] of Object.entries(board)) {
            if (owner === 'obstacle') continue;

            const { q, r } = HexMath.parseKey(key);
            const { x, y } = HexMath.hexToPixel(q, r, this.hexSize);
            let pieceEl = document.getElementById(`piece-${key}`);

            if (!pieceEl) {
                pieceEl = this.createPieceElement(key, owner, x, y);
                this.piecesLayer.appendChild(pieceEl);
            } else {
                // Check if owner changed (conversion)
                const currentOwner = pieceEl.getAttribute('data-owner');
                if (currentOwner !== owner) {
                    pieceEl.setAttribute('data-owner', owner);
                    pieceEl.setAttribute('class', `hex-piece piece-${owner} converting`);
                    setTimeout(() => pieceEl.classList.remove('converting'), 450);
                }
            }

            // Selection state
            if (key === selectedKey) {
                pieceEl.classList.add('selected');
            } else {
                pieceEl.classList.remove('selected');
            }
        }
    }

    createPieceElement(key, owner, x, y) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `hex-piece piece-${owner}`);
        g.setAttribute('id', `piece-${key}`);
        g.setAttribute('data-key', key);
        g.setAttribute('data-owner', owner);
        g.setAttribute('transform', `translate(${x.toFixed(2)}, ${y.toFixed(2)})`);

        // Pulsing glow aura behind piece
        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        glow.setAttribute('r', (this.hexSize * 0.72).toFixed(2));
        glow.setAttribute('class', 'piece-glow');
        g.appendChild(glow);

        // 3D Gem Body
        const body = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        body.setAttribute('r', (this.hexSize * 0.58).toFixed(2));
        body.setAttribute('class', 'piece-body piece-base');
        body.setAttribute('filter', 'url(#piece-shadow)');
        g.appendChild(body);

        // Faceted crystal inner specular highlight
        const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        highlight.setAttribute('cx', (-this.hexSize * 0.18).toFixed(2));
        highlight.setAttribute('cy', (-this.hexSize * 0.18).toFixed(2));
        highlight.setAttribute('rx', (this.hexSize * 0.22).toFixed(2));
        highlight.setAttribute('ry', (this.hexSize * 0.12).toFixed(2));
        highlight.setAttribute('fill', '#ffffff');
        highlight.setAttribute('opacity', '0.75');
        highlight.setAttribute('transform', 'rotate(-30)');
        g.appendChild(highlight);

        g.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handlePieceClick(key);
        });

        return g;
    }

    handlePieceClick(key) {
        const owner = this.game.board[key];
        const active = this.game.activePlayer;

        // If clicking own active piece, select it
        if (owner === active) {
            sound.playSelect();
            this.game.selectPiece(key);
        } else if (this.game.selectedKey) {
            // Clicking another cell while selected does nothing or clears
            sound.playDeselect();
            this.game.clearSelection();
            this.game.emit('stateChange', this.game.getStateSnapshot());
        }
    }

    handleCellClick(key) {
        if (!this.game.selectedKey) return;

        // Check if clicked cell is a valid move destination
        const isValid = this.game.validMoves.some(m => m.toKey === key);
        if (isValid) {
            this.game.makeMove(key);
        } else {
            sound.playDeselect();
            this.game.clearSelection();
            this.game.emit('stateChange', this.game.getStateSnapshot());
        }
    }

    handleCellHover(key) {
        if (!this.game.selectedKey) return;

        const move = this.game.validMoves.find(m => m.toKey === key);
        if (move && move.captures && move.captures.length > 0) {
            move.captures.forEach(capKey => {
                const enemyCell = document.getElementById(`cell-${capKey}`);
                if (enemyCell) enemyCell.classList.add('target-capture-preview');
            });
        }
    }

    handleCellLeave(key) {
        document.querySelectorAll('.target-capture-preview').forEach(el => {
            el.classList.remove('target-capture-preview');
        });
    }

    updateHUD(state) {
        const { stats, activePlayer, isGameOver, canUndo, canRedo, mode, isBusy } = state;

        this.scoreRuby.textContent = stats.ruby || 0;
        this.scorePearl.textContent = stats.pearl || 0;

        if (this.game.players.includes('emerald')) {
            this.cardEmerald.style.display = 'flex';
            this.scoreEmerald.textContent = stats.emerald || 0;
        } else {
            this.cardEmerald.style.display = 'none';
        }

        // Active turn cards
        this.cardRuby.classList.toggle('active-turn', activePlayer === 'ruby' && !isGameOver);
        this.cardPearl.classList.toggle('active-turn', activePlayer === 'pearl' && !isGameOver);
        this.cardEmerald.classList.toggle('active-turn', activePlayer === 'emerald' && !isGameOver);

        // Buttons state
        this.btnUndo.disabled = !canUndo || isGameOver || isBusy;
        this.btnRedo.disabled = !canRedo || isGameOver || isBusy;

        // Status banner
        if (isGameOver) {
            this.statusBanner.textContent = '🏁 Match Finished!';
        } else if (mode === 'ai' && activePlayer === 'pearl') {
            this.statusBanner.textContent = '🧠 AI is calculating optimal trajectory...';
        } else {
            const pConfig = PLAYERS[activePlayer.toUpperCase()];
            const pName = pConfig ? pConfig.name : activePlayer;
            if (state.selectedKey) {
                this.statusBanner.textContent = `${pName}: Select green hex to Clone (+1) or yellow hex to Jump`;
            } else {
                this.statusBanner.textContent = `${pName}'s Turn: Select a ${pName} to view moves`;
            }
        }
    }
}

// Instantiate App when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.app = new HexxagonApp();
});
