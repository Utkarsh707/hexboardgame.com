/**
 * Hex Board Game UI Binder & DOM State Orchestrator
 * - Screen 1: Minimal Bouncy Play Button
 * - Screen 2: Free-Floating Mode (1P vs 2P) & Difficulty Selection
 * - Screen 3: Maximized Hex Game Arena with Vertical Score Stack
 * - Revamped Free-Floating Game Over Celebration
 */

import { HexxagonGame } from './game-engine.js';
import { sound } from './audio.js';

export function initGameUI() {
    // Screen Containers
    const screenTitle = document.getElementById('screen-title');
    const screenSetup = document.getElementById('screen-setup');
    const screenGame = document.getElementById('screen-game');

    // Title Screen Controls
    const btnTitlePlay = document.getElementById('btn-title-play');
    const btnSplashSound = document.getElementById('btn-splash-sound');
    const splashSoundIcon = document.getElementById('splash-sound-icon');

    // Setup Screen Controls (Free-Floating)
    const btnSetupBack = document.getElementById('btn-setup-back');
    const btnModePve = document.getElementById('btn-mode-pve');
    const btnModePvp = document.getElementById('btn-mode-pvp');
    const setupDifficultyGroup = document.getElementById('setup-difficulty-group');
    const diffButtons = document.querySelectorAll('.btn-floating-diff');
    const btnSetupStartGame = document.getElementById('btn-setup-start-game');
    const btnSetupSound = document.getElementById('btn-setup-sound');
    const setupSoundIcon = document.getElementById('setup-sound-icon');

    // Game Arena Controls
    const btnGameSound = document.getElementById('btn-game-sound');
    const gameSoundIcon = document.getElementById('game-sound-icon');
    const btnRestartGame = document.getElementById('btn-restart-game');
    const btnGameBack = document.getElementById('btn-game-back');
    const btnGameUndo = document.getElementById('btn-game-undo');

    // Live Turn Banner
    const turnBanner = document.getElementById('turn-banner');
    const turnBannerDot = document.getElementById('turn-banner-dot');
    const turnBannerText = document.getElementById('turn-banner-text');

    // Duel Score Bar Elements
    const duelBarRuby = document.getElementById('duel-bar-ruby');
    const duelBarPearl = document.getElementById('duel-bar-pearl');
    const duelScoreSummary = document.getElementById('duel-score-summary');

    // Vertical Score & Turn Telemetry DOM Elements
    const scoreRuby = document.getElementById('score-ruby');
    const scorePearl = document.getElementById('score-pearl');
    const cardRuby = document.getElementById('card-player-ruby');
    const cardPearl = document.getElementById('card-player-pearl');
    const turnDotRuby = document.getElementById('turn-dot-ruby');
    const turnDotRubySolid = document.getElementById('turn-dot-ruby-solid');
    const turnDotPearl = document.getElementById('turn-dot-pearl');
    const turnDotPearlSolid = document.getElementById('turn-dot-pearl-solid');

    // Free-Floating Game Over Elements
    const dialogGameOver = document.getElementById('dialog-game-over');
    const gameOverTitle = document.getElementById('game-over-title');
    const gameOverSubtitle = document.getElementById('game-over-subtitle');
    const gameOverIcon = document.getElementById('game-over-icon');
    const finalScoreRuby = document.getElementById('final-score-ruby');
    const finalScorePearl = document.getElementById('final-score-pearl');
    const btnGameOverRematch = document.getElementById('btn-game-over-rematch');
    const btnGameOverMode = document.getElementById('btn-game-over-mode');
    const btnGameOverClose = document.getElementById('btn-game-over-close');

    // Selection State
    let selectedMode = 'pve'; // 'pve' | 'pvp'
    let selectedDiff = 'medium'; // 'easy' | 'medium' | 'master'
    let game = null;

    // Start Audio on First User Interaction
    const initAudioOnInteraction = () => {
        sound.startMusic(screenGame && !screenGame.classList.contains('hidden-screen') ? 'space_invaders' : 'menu');
        window.removeEventListener('pointerdown', initAudioOnInteraction);
        window.removeEventListener('keydown', initAudioOnInteraction);
    };
    window.addEventListener('pointerdown', initAudioOnInteraction, { once: true });
    window.addEventListener('keydown', initAudioOnInteraction, { once: true });

    // Synchronize Audio Mute UI Across All Screens
    function syncSoundUI(muted) {
        const icon = muted ? '🔇' : '🔊';
        if (splashSoundIcon) splashSoundIcon.textContent = icon;
        if (setupSoundIcon) setupSoundIcon.textContent = icon;
        if (gameSoundIcon) gameSoundIcon.textContent = icon;
    }
    syncSoundUI(sound.muted);

    // Audio Toggle Handler
    const toggleSound = () => {
        const isMuted = sound.toggleMute();
        syncSoundUI(isMuted);
        if (!isMuted) sound.playSelect();
    };

    btnSplashSound?.addEventListener('click', toggleSound);
    btnSetupSound?.addEventListener('click', toggleSound);
    btnGameSound?.addEventListener('click', toggleSound);

    // Navigation: Title Screen -> Setup Screen
    function showSetupScreen() {
        sound.playSelect();
        screenTitle?.classList.add('hidden-screen');
        screenGame?.classList.add('hidden-screen');
        screenSetup?.classList.remove('hidden-screen');
    }

    // Navigation: Setup Screen -> Title Screen
    function showTitleScreen() {
        sound.playDeselect();
        screenSetup?.classList.add('hidden-screen');
        screenGame?.classList.add('hidden-screen');
        screenTitle?.classList.remove('hidden-screen');
    }

    btnTitlePlay?.addEventListener('click', showSetupScreen);
    btnSetupBack?.addEventListener('click', showTitleScreen);

    // Mode Selector Logic
    function updateModeUI(mode) {
        selectedMode = mode;
        if (mode === 'pve') {
            btnModePve?.classList.add('active', 'border-cyan-400', 'bg-cyan-500/15', 'shadow-[0_0_20px_rgba(0,229,255,0.25)]');
            btnModePve?.classList.remove('border-white/15', 'bg-white/5');

            btnModePvp?.classList.remove('active', 'border-pink-400', 'bg-pink-500/15', 'shadow-[0_0_20px_rgba(255,45,96,0.25)]');
            btnModePvp?.classList.add('border-white/15', 'bg-white/5');

            if (setupDifficultyGroup) {
                setupDifficultyGroup.classList.remove('opacity-25', 'pointer-events-none', 'grayscale');
            }
        } else {
            btnModePvp?.classList.add('active', 'border-pink-400', 'bg-pink-500/15', 'shadow-[0_0_20px_rgba(255,45,96,0.25)]');
            btnModePvp?.classList.remove('border-white/15', 'bg-white/5');

            btnModePve?.classList.remove('active', 'border-cyan-400', 'bg-cyan-500/15', 'shadow-[0_0_20px_rgba(0,229,255,0.25)]');
            btnModePve?.classList.add('border-white/15', 'bg-white/5');

            if (setupDifficultyGroup) {
                setupDifficultyGroup.classList.add('opacity-25', 'pointer-events-none', 'grayscale');
            }
        }
    }

    btnModePve?.addEventListener('click', () => {
        updateModeUI('pve');
        sound.playSelect();
    });

    btnModePvp?.addEventListener('click', () => {
        updateModeUI('pvp');
        sound.playSelect();
    });

    // Difficulty Selector Logic
    diffButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const diff = btn.getAttribute('data-diff');
            if (!diff) return;
            selectedDiff = diff;

            diffButtons.forEach(b => {
                if (b.getAttribute('data-diff') === diff) {
                    b.className = 'btn-floating-diff active px-3 py-2 rounded-xl border-2 border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(0,229,255,0.3)] text-xs font-mono font-bold transition-all active:scale-95 cursor-pointer';
                } else {
                    b.className = 'btn-floating-diff px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:border-cyan-400/60 hover:text-cyan-300 text-xs font-mono font-bold text-slate-400 transition-all active:scale-95 cursor-pointer';
                }
            });
            sound.playSelect();
        });
    });

    // Launch Game Function
    function launchGame() {
        sound.playSelect();
        sound.startMusic('space_invaders');

        screenTitle?.classList.add('hidden-screen');
        screenSetup?.classList.add('hidden-screen');
        screenGame?.classList.remove('hidden-screen');

        const gameModeKey = selectedMode === 'pve' ? `pve-${selectedDiff}` : 'pvp';

        if (!game) {
            game = new HexxagonGame({
                presetId: 'classic',
                themeId: 'space_invaders',
                gameMode: gameModeKey
            });
            attachGameEvents(game);
        } else {
            game.setPreset('classic');
            game.setTheme('space_invaders');
            game.setGameMode(gameModeKey);
            game.initGame();
        }

        window.hexxagonInstance = game;
    }

    btnSetupStartGame?.addEventListener('click', launchGame);

    // Attach Game State & Telemetry Events
    function attachGameEvents(gameInstance) {
        // Event: Score Change & Duel Progress Bar
        gameInstance.on('scoreChange', ({ scores, totalCells }) => {
            const r = scores.ruby ?? 0;
            const p = scores.pearl ?? 0;
            if (scoreRuby) scoreRuby.textContent = r;
            if (scorePearl) scorePearl.textContent = p;

            const total = r + p || 1;
            const rubyPct = Math.round((r / total) * 100);
            const pearlPct = 100 - rubyPct;

            if (duelBarRuby) duelBarRuby.style.width = `${rubyPct}%`;
            if (duelBarPearl) duelBarPearl.style.width = `${pearlPct}%`;
            if (duelScoreSummary) duelScoreSummary.textContent = `${r} : ${p}`;
        });

        // Event: Turn Change & Turn Banner
        gameInstance.on('turnChange', ({ currentPlayer, isAi }) => {
            turnDotRuby?.classList.add('hidden');
            turnDotRubySolid?.classList.add('hidden');
            turnDotPearl?.classList.add('hidden');
            turnDotPearlSolid?.classList.add('hidden');

            cardRuby?.classList.remove('border-[#ff2d60]', 'bg-white/10');
            cardPearl?.classList.remove('border-[#00e5ff]', 'bg-white/10');

            if (currentPlayer === 'ruby') {
                turnDotRuby?.classList.remove('hidden');
                turnDotRubySolid?.classList.remove('hidden');
                cardRuby?.classList.add('border-[#ff2d60]', 'bg-white/10');

                if (turnBanner) {
                    turnBanner.className = "flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-[#090e1f]/90 border border-pink-500/50 text-pink-300 shadow-[0_0_15px_rgba(255,45,96,0.25)] backdrop-blur-md text-[9px] sm:text-[11px] transition-all";
                }
                if (turnBannerDot) {
                    turnBannerDot.className = "w-2 h-2 rounded-full bg-[#ff0844] animate-ping";
                }
                if (turnBannerText) {
                    turnBannerText.textContent = selectedMode === 'pvp' ? 'P1 TURN (RUBY)' : 'YOUR TURN';
                }
            } else if (currentPlayer === 'pearl') {
                turnDotPearl?.classList.remove('hidden');
                turnDotPearlSolid?.classList.remove('hidden');
                cardPearl?.classList.add('border-[#00e5ff]', 'bg-white/10');

                if (turnBanner) {
                    turnBanner.className = "flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-[#090e1f]/90 border border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.25)] backdrop-blur-md text-[9px] sm:text-[11px] transition-all";
                }
                if (turnBannerDot) {
                    turnBannerDot.className = "w-2 h-2 rounded-full bg-[#00e5ff] animate-ping";
                }
                if (turnBannerText) {
                    turnBannerText.textContent = selectedMode === 'pvp' ? 'P2 TURN (PEARL)' : (isAi ? 'BOT THINKING...' : 'PEARL TURN');
                }
            }
        });

        // Event: AI Thinking State Indicator
        gameInstance.on('aiThinking', (isThinking) => {
            if (isThinking && turnBannerText && selectedMode === 'pve') {
                turnBannerText.textContent = 'BOT THINKING...';
            }
        });

        // Event: Game Over
        gameInstance.on('gameOver', ({ winner, isTie, scores, moveCount }) => {
            if (!dialogGameOver) return;

            if (finalScoreRuby) finalScoreRuby.textContent = scores.ruby || 0;
            if (finalScorePearl) finalScorePearl.textContent = scores.pearl || 0;

            if (isTie) {
                if (gameOverTitle) gameOverTitle.textContent = 'STALEMATE!';
                if (gameOverSubtitle) gameOverSubtitle.textContent = `Both players finished tied with ${scores.ruby} gems each in ${moveCount} turns.`;
                if (gameOverIcon) gameOverIcon.textContent = '🤝';
            } else if (winner === 'ruby') {
                if (gameOverTitle) gameOverTitle.textContent = selectedMode === 'pvp' ? 'PLAYER 1 WINS!' : 'VICTORY!';
                if (gameOverSubtitle) gameOverSubtitle.textContent = `Rubies claimed victory with ${scores.ruby} gems over Pearls ${scores.pearl}.`;
                if (gameOverIcon) gameOverIcon.textContent = '🏆';
            } else if (winner === 'pearl') {
                if (gameOverTitle) gameOverTitle.textContent = selectedMode === 'pvp' ? 'PLAYER 2 WINS!' : 'AI WINS!';
                if (gameOverSubtitle) gameOverSubtitle.textContent = `Pearls dominated with ${scores.pearl} gems vs Rubies ${scores.ruby}.`;
                if (gameOverIcon) gameOverIcon.textContent = selectedMode === 'pvp' ? '🏆' : '💀';
            }

            setTimeout(() => {
                if (!dialogGameOver.open) {
                    dialogGameOver.showModal();
                }
            }, 300);
        });
    }

    // In-game Exit / Back Button
    btnGameBack?.addEventListener('click', () => {
        sound.playDeselect();
        showSetupScreen();
    });

    // In-game Undo Button
    btnGameUndo?.addEventListener('click', () => {
        if (game && !screenGame?.classList.contains('hidden-screen')) {
            game.undo();
        }
    });

    // In-game Restart Button
    btnRestartGame?.addEventListener('click', () => {
        if (game) {
            game.initGame();
            sound.playSelect();
        }
    });

    // Responsive Window Resize & Orientation Change Handling
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (game && screenGame && !screenGame.classList.contains('hidden-screen')) {
                game.renderBoard();
            }
        }, 150);
    });

    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            if (game && screenGame && !screenGame.classList.contains('hidden-screen')) {
                game.renderBoard();
            }
        }, 200);
    });

    // Game Over Actions
    btnGameOverRematch?.addEventListener('click', () => {
        dialogGameOver?.close();
        if (game) game.initGame();
    });

    btnGameOverMode?.addEventListener('click', () => {
        dialogGameOver?.close();
        showSetupScreen();
    });

    btnGameOverClose?.addEventListener('click', () => {
        dialogGameOver?.close();
    });

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') {
            toggleSound();
        } else if (e.key === 'u' || e.key === 'U') {
            if (game && !screenGame?.classList.contains('hidden-screen')) {
                game.undo();
            }
        } else if (e.key === 'r' || e.key === 'R') {
            if (game && !screenGame?.classList.contains('hidden-screen')) {
                game.initGame();
                sound.playSelect();
            }
        } else if (e.key === 'Escape') {
            if (dialogGameOver && dialogGameOver.open) {
                dialogGameOver.close();
            } else if (screenGame && !screenGame.classList.contains('hidden-screen')) {
                showSetupScreen();
            }
        }
    });
}
