/**
 * Hexxagon UI Binder & DOM Orchestration
 */

import { HexxagonGame } from './game-engine.js';
import { sound } from './audio.js';
import { PLAYERS, BOARD_PRESETS } from './boards.js';

export function initGameUI() {
    // Controls & Select Elements
    const selectGameMode = document.getElementById('select-game-mode');
    const selectBoardPreset = document.getElementById('select-board-preset');
    const selectGameModeMobile = document.getElementById('select-game-mode-mobile');
    const selectBoardPresetMobile = document.getElementById('select-board-preset-mobile');

    // Always reset UI dropdowns to Stage 1 (Classic) & VS CPU on fresh page load/refresh
    if (selectBoardPreset) selectBoardPreset.value = 'classic';
    if (selectBoardPresetMobile) selectBoardPresetMobile.value = 'classic';
    if (selectGameMode) selectGameMode.value = 'pve';
    if (selectGameModeMobile) selectGameModeMobile.value = 'pve';

    const game = new HexxagonGame({
        presetId: 'classic',
        gameMode: 'pve-medium'
    });

    // DOM Elements
    const stageBannerText = document.getElementById('stage-banner-text');
    const hudTurnGlow = document.getElementById('hud-turn-glow');
    const scoreRuby = document.getElementById('score-ruby');
    const scorePearl = document.getElementById('score-pearl');
    const scoreEmerald = document.getElementById('score-emerald');
    const scoreRubyMobile = document.getElementById('score-ruby-mobile');
    const scorePearlMobile = document.getElementById('score-pearl-mobile');
    const cardRuby = document.getElementById('card-player-ruby');
    const cardPearl = document.getElementById('card-player-pearl');
    const cardEmerald = document.getElementById('card-player-emerald');
    const turnDotRuby = document.getElementById('turn-dot-ruby');
    const turnDotRubySolid = document.getElementById('turn-dot-ruby-solid');
    const turnDotPearl = document.getElementById('turn-dot-pearl');
    const turnDotPearlSolid = document.getElementById('turn-dot-pearl-solid');
    const turnDotEmerald = document.getElementById('turn-dot-emerald');
    const turnDotEmeraldSolid = document.getElementById('turn-dot-emerald-solid');
    const turnStatusIndicator = document.getElementById('turn-status-indicator');
    const turnStatusText = document.getElementById('turn-status-text');
    const turnStatusIndicatorMobile = document.getElementById('turn-status-indicator-mobile');
    const turnStatusTextMobile = document.getElementById('turn-status-text-mobile');
    const labelPlayerPearl = document.getElementById('label-player-pearl');
    const hudMoveCount = document.getElementById('hud-move-count');

    // Controls Buttons
    const btnRestartGame = document.getElementById('btn-restart-game');
    const btnHudUndo = document.getElementById('btn-hud-undo');
    const btnHudUndoMobile = document.getElementById('btn-hud-undo-mobile');
    const btnToggleSound = document.getElementById('btn-toggle-sound');
    const iconSoundOn = document.getElementById('icon-sound-on');
    const iconSoundOff = document.getElementById('icon-sound-off');

    // Modals
    const dialogHowToPlay = document.getElementById('dialog-how-to-play');
    const btnOpenHowToPlay = document.getElementById('btn-open-how-to-play');
    const btnCloseHowToPlay = document.getElementById('btn-close-how-to-play');
    const btnConfirmHowToPlay = document.getElementById('btn-confirm-how-to-play');
    const btnFooterHowToPlay = document.getElementById('btn-footer-how-to-play');

    const dialogStats = document.getElementById('dialog-stats');
    const btnOpenStats = document.getElementById('btn-open-stats');
    const btnCloseStats = document.getElementById('btn-close-stats');
    const btnCloseStatsAction = document.getElementById('btn-close-stats-action');
    const btnResetStats = document.getElementById('btn-reset-stats');

    const dialogShortcuts = document.getElementById('dialog-shortcuts');
    const btnOpenShortcuts = document.getElementById('btn-open-shortcuts');
    const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');
    const btnCloseShortcutsAction = document.getElementById('btn-close-shortcuts-action');
    const btnFooterShortcuts = document.getElementById('btn-footer-shortcuts');

    const dialogGameOver = document.getElementById('dialog-game-over');
    const gameOverTitle = document.getElementById('game-over-title');
    const gameOverSubtitle = document.getElementById('game-over-subtitle');
    const gameOverIcon = document.getElementById('game-over-icon');
    const finalScoreRuby = document.getElementById('final-score-ruby');
    const finalScorePearl = document.getElementById('final-score-pearl');
    const btnGameOverRematch = document.getElementById('btn-game-over-rematch');
    const btnGameOverClose = document.getElementById('btn-game-over-close');

    // Sound UI Sync
    function syncSoundUI(muted) {
        if (muted) {
            iconSoundOn?.classList.add('hidden');
            iconSoundOff?.classList.remove('hidden');
        } else {
            iconSoundOn?.classList.remove('hidden');
            iconSoundOff?.classList.add('hidden');
        }
    }
    syncSoundUI(sound.muted);

    btnToggleSound?.addEventListener('click', () => {
        const isMuted = sound.toggleMute();
        syncSoundUI(isMuted);
    });

    game.on('soundToggle', (muted) => syncSoundUI(muted));

    // Event: Score Change
    game.on('scoreChange', ({ scores }) => {
        if (scoreRuby) scoreRuby.textContent = scores.ruby || 0;
        if (scoreRubyMobile) scoreRubyMobile.textContent = scores.ruby || 0;
        if (scorePearl) scorePearl.textContent = scores.pearl || 0;
        if (scorePearlMobile) scorePearlMobile.textContent = scores.pearl || 0;
        if (scoreEmerald && scores.emerald !== undefined) {
            scoreEmerald.textContent = scores.emerald || 0;
        }
    });

    // Event: Turn Change
    game.on('turnChange', ({ currentPlayer, isAi, moveCount }) => {
        if (hudMoveCount) hudMoveCount.textContent = moveCount;
        syncDifficultyLock(moveCount);

        // Reset turn dots & borders
        [turnDotRuby, turnDotRubySolid, turnDotPearl, turnDotPearlSolid, turnDotEmerald, turnDotEmeraldSolid].forEach(el => el?.classList.add('hidden'));
        [cardRuby, cardPearl, cardEmerald].forEach(el => {
            if (el) {
                el.classList.remove('border-[#ff2d60]', 'border-[#00e5ff]', 'border-[#10b981]', 'bg-white/5');
            }
        });

        const playerInfo = PLAYERS[currentPlayer];

        if (currentPlayer === 'ruby') {
            turnDotRuby?.classList.remove('hidden');
            turnDotRubySolid?.classList.remove('hidden');
            cardRuby?.classList.add('border-[#ff2d60]', 'bg-white/5');
            if (hudTurnGlow) hudTurnGlow.style.background = 'radial-gradient(circle at 15% 50%, rgba(255, 45, 96, 0.25), transparent 70%)';
            if (turnStatusIndicator) turnStatusIndicator.style.backgroundColor = '#ff2d60';
            if (turnStatusIndicatorMobile) turnStatusIndicatorMobile.style.backgroundColor = '#ff2d60';
            const text = selectGameMode?.value === 'pvp' ? "Player 1's Turn" : "Your Turn (Rubies)";
            if (turnStatusText) turnStatusText.textContent = text;
            if (turnStatusTextMobile) turnStatusTextMobile.textContent = text;
        } else if (currentPlayer === 'pearl') {
            turnDotPearl?.classList.remove('hidden');
            turnDotPearlSolid?.classList.remove('hidden');
            cardPearl?.classList.add('border-[#00e5ff]', 'bg-white/5');
            if (hudTurnGlow) hudTurnGlow.style.background = 'radial-gradient(circle at 85% 50%, rgba(0, 229, 255, 0.25), transparent 70%)';
            if (turnStatusIndicator) turnStatusIndicator.style.backgroundColor = '#00e5ff';
            if (turnStatusIndicatorMobile) turnStatusIndicatorMobile.style.backgroundColor = '#00e5ff';
            const text = isAi ? 'AI Opponent Thinking…' : "Player 2's Turn";
            if (turnStatusText) turnStatusText.textContent = text;
            if (turnStatusTextMobile) turnStatusTextMobile.textContent = text;
        } else if (currentPlayer === 'emerald') {
            turnDotEmerald?.classList.remove('hidden');
            turnDotEmeraldSolid?.classList.remove('hidden');
            cardEmerald?.classList.add('border-[#10b981]', 'bg-white/5');
            if (hudTurnGlow) hudTurnGlow.style.background = 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.25), transparent 70%)';
            if (turnStatusIndicator) turnStatusIndicator.style.backgroundColor = '#10b981';
            if (turnStatusIndicatorMobile) turnStatusIndicatorMobile.style.backgroundColor = '#10b981';
            const text = "Player 3's Turn";
            if (turnStatusText) turnStatusText.textContent = text;
            if (turnStatusTextMobile) turnStatusTextMobile.textContent = text;
        }
    });

    // Event: AI Thinking
    game.on('aiThinking', (thinking) => {
        if (thinking) {
            if (turnStatusIndicator) turnStatusIndicator.classList.add('animate-spin');
            if (turnStatusIndicatorMobile) turnStatusIndicatorMobile.classList.add('animate-spin');
            if (turnStatusText) turnStatusText.textContent = 'AI Calculating Move…';
            if (turnStatusTextMobile) turnStatusTextMobile.textContent = 'AI Thinking…';
        } else {
            if (turnStatusIndicator) turnStatusIndicator.classList.remove('animate-spin');
            if (turnStatusIndicatorMobile) turnStatusIndicatorMobile.classList.remove('animate-spin');
        }
    });

    // Event: Game Over
    game.on('gameOver', ({ winner, isTie, scores, moveCount }) => {
        if (!dialogGameOver) return;

        if (finalScoreRuby) finalScoreRuby.textContent = scores.ruby || 0;
        if (finalScorePearl) finalScorePearl.textContent = scores.pearl || 0;

        if (isTie) {
            if (gameOverTitle) gameOverTitle.textContent = 'Stalemate / Draw!';
            if (gameOverSubtitle) gameOverSubtitle.textContent = `Both players finished tied with ${scores.ruby} gems each in ${moveCount} moves.`;
            if (gameOverIcon) gameOverIcon.textContent = '🤝';
        } else if (winner === 'ruby') {
            if (gameOverTitle) gameOverTitle.textContent = selectGameMode?.value === 'pvp' ? 'Player 1 (Rubies) Wins!' : 'Victory! You Won!';
            if (gameOverSubtitle) gameOverSubtitle.textContent = `Rubies dominated the board with ${scores.ruby} gems over Pearls (${scores.pearl}) in ${moveCount} moves.`;
            if (gameOverIcon) gameOverIcon.textContent = '🏆';
        } else if (winner === 'pearl') {
            if (gameOverTitle) gameOverTitle.textContent = selectGameMode?.value === 'pvp' ? 'Player 2 (Pearls) Wins!' : 'AI Opponent Wins!';
            if (gameOverSubtitle) gameOverSubtitle.textContent = `Pearls secured victory with ${scores.pearl} gems vs Rubies (${scores.ruby}) in ${moveCount} moves.`;
            if (gameOverIcon) gameOverIcon.textContent = selectGameMode?.value === 'pvp' ? '🏆' : '💀';
        }

        dialogGameOver.showModal();
    });

    // Difficulty and Mode Setup
    let currentDifficulty = 'medium';
    const containerAiDifficulty = document.getElementById('container-ai-difficulty');
    const containerAiDifficultyMobile = document.getElementById('container-ai-difficulty-mobile');
    const labelCurrentDiff = document.getElementById('label-current-diff');
    const diffLockBadge = document.getElementById('diff-lock-badge');
    const diffLockBadgeMobile = document.getElementById('diff-lock-badge-mobile');
    const diffButtons = document.querySelectorAll('.btn-difficulty, .btn-diff-mobile');

    function syncDifficultyLock(moveCount) {
        const isGameStarted = moveCount > 0 && !game.isGameOver;
        
        diffButtons.forEach(btn => {
            if (isGameStarted) {
                btn.disabled = true;
                btn.classList.add('opacity-40', 'cursor-not-allowed');
                btn.setAttribute('title', 'Difficulty locked during active match. Reset to change.');
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-40', 'cursor-not-allowed');
                btn.removeAttribute('title');
            }
        });

        if (diffLockBadge) {
            if (isGameStarted) {
                diffLockBadge.classList.remove('hidden');
            } else {
                diffLockBadge.classList.add('hidden');
            }
        }
        if (diffLockBadgeMobile) {
            if (isGameStarted) {
                diffLockBadgeMobile.classList.remove('hidden');
            } else {
                diffLockBadgeMobile.classList.add('hidden');
            }
        }
    }

    function setDifficulty(diff) {
        // Prevent changing difficulty if match has already started
        if (game.state && game.state.moveCount > 0 && !game.isGameOver) {
            return;
        }

        currentDifficulty = diff;
        
        if (labelCurrentDiff) {
            const labels = {
                easy: 'EASY (NOVICE)',
                medium: 'MEDIUM (TACTICAL)',
                master: 'MASTER (GRANDMASTER)'
            };
            labelCurrentDiff.textContent = labels[diff] || diff.toUpperCase();
        }

        diffButtons.forEach(btn => {
            if (btn.getAttribute('data-diff') === diff) {
                btn.classList.add('bg-cyan-500/20', 'text-cyan-200', 'border', 'border-cyan-400', 'shadow-[0_0_8px_rgba(0,229,255,0.4)]');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('bg-cyan-500/20', 'text-cyan-200', 'border', 'border-cyan-400', 'shadow-[0_0_8px_rgba(0,229,255,0.4)]');
                btn.classList.add('text-slate-400');
            }
        });

        if (!selectGameMode || selectGameMode.value === 'pve' || selectGameMode.value.startsWith('pve')) {
            game.setGameMode(`pve-${diff}`);
        }
    }

    diffButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const diff = btn.getAttribute('data-diff');
            if (diff) {
                setDifficulty(diff);
                sound.playSelect();
            }
        });
    });

    // Unified Mode & Preset Handlers (Desktop & Mobile Sync)
    function handleModeChange(mode, playSound = true) {
        if (selectGameMode) selectGameMode.value = mode;
        if (selectGameModeMobile) selectGameModeMobile.value = mode;

        if (mode === 'pve') {
            containerAiDifficulty?.classList.remove('opacity-30', 'pointer-events-none');
            containerAiDifficultyMobile?.classList.remove('opacity-30', 'pointer-events-none');
            game.setGameMode(`pve-${currentDifficulty}`);
        } else {
            containerAiDifficulty?.classList.add('opacity-30', 'pointer-events-none');
            containerAiDifficultyMobile?.classList.add('opacity-30', 'pointer-events-none');
            game.setGameMode(mode);
        }

        if (mode === 'trio') {
            cardEmerald?.classList.remove('hidden');
            cardEmerald?.classList.add('flex');
            handlePresetChange('trio', playSound);
        } else {
            cardEmerald?.classList.add('hidden');
            cardEmerald?.classList.remove('flex');
            if (game.presetId === 'trio') {
                handlePresetChange('classic', playSound);
            }
        }

        if (labelPlayerPearl) {
            labelPlayerPearl.textContent = mode === 'pvp' ? 'Player 2' : (mode === 'trio' ? 'Player 2' : 'AI // PEARL');
        }

        if (playSound) sound.playSelect();
    }

    function handlePresetChange(preset, playSound = true) {
        if (selectBoardPreset) selectBoardPreset.value = preset;
        if (selectBoardPresetMobile) selectBoardPresetMobile.value = preset;

        if (preset === 'trio') {
            if (selectGameMode) selectGameMode.value = 'trio';
            if (selectGameModeMobile) selectGameModeMobile.value = 'trio';
            cardEmerald?.classList.remove('hidden');
            cardEmerald?.classList.add('flex');
            containerAiDifficulty?.classList.add('opacity-30', 'pointer-events-none');
            containerAiDifficultyMobile?.classList.add('opacity-30', 'pointer-events-none');
        }

        if (stageBannerText && BOARD_PRESETS[preset]) {
            stageBannerText.textContent = BOARD_PRESETS[preset].stageTitle;
        }

        game.setPreset(preset);
        syncDifficultyLock(0);
        if (playSound) sound.playSelect();
    }

    // Initial silent sync on startup / page refresh
    handlePresetChange('classic', false);
    handleModeChange('pve', false);

    selectGameMode?.addEventListener('change', (e) => handleModeChange(e.target.value));
    selectGameModeMobile?.addEventListener('change', (e) => handleModeChange(e.target.value));

    selectBoardPreset?.addEventListener('change', (e) => handlePresetChange(e.target.value));
    selectBoardPresetMobile?.addEventListener('change', (e) => handlePresetChange(e.target.value));

    // Restart Button
    btnRestartGame?.addEventListener('click', () => {
        game.initGame();
        sound.playSelect();
        syncDifficultyLock(0);
    });

    // Undo Button (Desktop & Mobile)
    btnHudUndo?.addEventListener('click', () => {
        game.undo();
    });
    btnHudUndoMobile?.addEventListener('click', () => {
        game.undo();
    });

    // Rematch Button
    btnGameOverRematch?.addEventListener('click', () => {
        dialogGameOver?.close();
        game.initGame();
        syncDifficultyLock(0);
    });

    btnGameOverClose?.addEventListener('click', () => {
        dialogGameOver?.close();
    });

    // Modals: How to Play
    const openHowToPlay = () => dialogHowToPlay?.showModal();
    const closeHowToPlay = () => dialogHowToPlay?.close();
    btnOpenHowToPlay?.addEventListener('click', openHowToPlay);
    btnFooterHowToPlay?.addEventListener('click', openHowToPlay);
    btnCloseHowToPlay?.addEventListener('click', closeHowToPlay);
    btnConfirmHowToPlay?.addEventListener('click', closeHowToPlay);

    // Modals: Stats
    function updateStatsUI() {
        try {
            const raw = localStorage.getItem('hexxagon_stats_v2') || '{}';
            const stats = JSON.parse(raw);
            const total = stats.totalGames || 0;
            const rWins = stats.rubyWins || 0;
            const pWins = stats.pearlWins || 0;
            const winRate = total > 0 ? Math.round((rWins / total) * 100) : 0;

            const elTotal = document.getElementById('stat-total-games');
            const elWinRate = document.getElementById('stat-win-rate');
            const elRubyWins = document.getElementById('stat-ruby-wins');
            const elPearlWins = document.getElementById('stat-pearl-wins');
            const elHighRuby = document.getElementById('stat-high-ruby');

            if (elTotal) elTotal.textContent = total;
            if (elWinRate) elWinRate.textContent = `${winRate}%`;
            if (elRubyWins) elRubyWins.textContent = rWins;
            if (elPearlWins) elPearlWins.textContent = pWins;
            if (elHighRuby) elHighRuby.textContent = stats.highScoreRuby || 0;
        } catch (e) { }
    }

    const openStats = () => {
        updateStatsUI();
        dialogStats?.showModal();
    };
    const closeStats = () => dialogStats?.close();
    btnOpenStats?.addEventListener('click', openStats);
    btnCloseStats?.addEventListener('click', closeStats);
    btnCloseStatsAction?.addEventListener('click', closeStats);
    btnResetStats?.addEventListener('click', () => {
        localStorage.removeItem('hexxagon_stats_v2');
        updateStatsUI();
    });

    // Modals: Shortcuts
    const openShortcuts = () => dialogShortcuts?.showModal();
    const closeShortcuts = () => dialogShortcuts?.close();
    btnOpenShortcuts?.addEventListener('click', openShortcuts);
    btnFooterShortcuts?.addEventListener('click', openShortcuts);
    btnCloseShortcuts?.addEventListener('click', closeShortcuts);
    btnCloseShortcutsAction?.addEventListener('click', closeShortcuts);

    // Keyboard shortcut to open help
    window.addEventListener('keydown', (e) => {
        if (e.key === '?') {
            e.preventDefault();
            openHowToPlay();
        }
    });

    window.hexxagonInstance = game;
}
