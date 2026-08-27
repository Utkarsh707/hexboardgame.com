/**
 * Hexxagon UI Binder & DOM State Orchestrator
 * - Splash Screen / Main Menu vs Active Game Arena
 * - Zero-Scroll Viewport Adaptation & Dialog Lifecycle Management
 * - Comprehensive Settings, Stats, Audio, and Strategy Modals
 */

import { HexxagonGame } from './game-engine.js';
import { sound } from './audio.js';
import { PLAYERS, BOARD_PRESETS, STAGE_THEMES } from './boards.js';

export function initGameUI() {
    // Screen Elements
    const screenTitle = document.getElementById('screen-title');
    const screenSetup = document.getElementById('screen-setup');
    const screenGame = document.getElementById('screen-game');

    // Title Screen Controls
    const btnTitlePlay = document.getElementById('btn-title-play');

    // Setup Screen Controls
    const btnSetupBack = document.getElementById('btn-setup-back');
    const splashSelectMode = document.getElementById('splash-select-mode');
    const splashSelectPreset = document.getElementById('splash-select-preset');
    const splashSelectTheme = document.getElementById('splash-select-theme');
    const splashThemeButtons = document.querySelectorAll('.btn-splash-theme');
    const splashThemeTagline = document.getElementById('splash-theme-tagline');
    const splashContainerDiff = document.getElementById('splash-container-difficulty');
    const splashDiffButtons = document.querySelectorAll('.btn-splash-diff');
    const btnSplashStartGame = document.getElementById('btn-splash-start-game');
    const btnSplashSound = document.getElementById('btn-splash-sound');
    const splashSoundIcon = document.getElementById('splash-sound-icon');
    const splashSoundText = document.getElementById('splash-sound-text');
    const settingSelectTheme = document.getElementById('setting-select-theme');

    // In-Game Header & Arena Controls
    const btnNavMenu = document.getElementById('btn-nav-menu');
    const btnRestartGame = document.getElementById('btn-restart-game');
    const btnHudUndo = document.getElementById('btn-hud-undo');
    const btnToggleSound = document.getElementById('btn-toggle-sound');
    const iconSoundOn = document.getElementById('icon-sound-on');
    const iconSoundOff = document.getElementById('icon-sound-off');

    // Score & Telemetry DOM Elements
    const stageBannerText = document.getElementById('stage-banner-text');
    const scoreRuby = document.getElementById('score-ruby');
    const scorePearl = document.getElementById('score-pearl');
    const scoreEmerald = document.getElementById('score-emerald');
    const cardRuby = document.getElementById('card-player-ruby');
    const cardPearl = document.getElementById('card-player-pearl');
    const cardEmerald = document.getElementById('card-player-emerald');
    const turnDotRuby = document.getElementById('turn-dot-ruby');
    const turnDotRubySolid = document.getElementById('turn-dot-ruby-solid');
    const turnDotPearl = document.getElementById('turn-dot-pearl');
    const turnDotPearlSolid = document.getElementById('turn-dot-pearl-solid');
    const turnStatusIndicator = document.getElementById('turn-status-indicator');
    const turnStatusText = document.getElementById('turn-status-text');
    const labelPlayerPearl = document.getElementById('label-player-pearl');
    const hudMoveCount = document.getElementById('hud-move-count');

    // Dialog Elements
    const dialogHowToPlay = document.getElementById('dialog-how-to-play');
    const btnOpenHowToPlay = document.getElementById('btn-open-how-to-play');
    const btnSplashHowToPlay = document.getElementById('btn-splash-how-to-play');
    const btnCloseHowToPlay = document.getElementById('btn-close-how-to-play');
    const btnConfirmHowToPlay = document.getElementById('btn-confirm-how-to-play');

    const dialogStrategy = document.getElementById('dialog-strategy');
    const btnOpenStrategy = document.getElementById('btn-open-strategy');
    const btnSplashStrategy = document.getElementById('btn-splash-strategy');
    const btnCloseStrategy = document.getElementById('btn-close-strategy');
    const btnConfirmStrategy = document.getElementById('btn-confirm-strategy');

    const dialogSettings = document.getElementById('dialog-settings');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnSplashSettings = document.getElementById('btn-splash-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnConfirmSettings = document.getElementById('btn-confirm-settings');
    const settingToggleMusic = document.getElementById('setting-toggle-music');
    const settingToggleSound = document.getElementById('setting-toggle-sound');
    const settingVolumeSlider = document.getElementById('setting-volume-slider');
    const settingVolumeLabel = document.getElementById('setting-volume-label');
    const settingToggleShake = document.getElementById('setting-toggle-shake');
    const settingToggleFlashes = document.getElementById('setting-toggle-flashes');
    const btnSettingsClearData = document.getElementById('btn-settings-clear-data');

    const dialogStats = document.getElementById('dialog-stats');
    const btnOpenStats = document.getElementById('btn-open-stats');
    const btnSplashStats = document.getElementById('btn-splash-stats');
    const btnCloseStats = document.getElementById('btn-close-stats');
    const btnCloseStatsAction = document.getElementById('btn-close-stats-action');
    const btnResetStats = document.getElementById('btn-reset-stats');

    const dialogShortcuts = document.getElementById('dialog-shortcuts');
    const btnSplashShortcuts = document.getElementById('btn-splash-shortcuts');
    const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');
    const btnCloseShortcutsAction = document.getElementById('btn-close-shortcuts-action');

    const dialogAbout = document.getElementById('dialog-about');
    const btnSplashAbout = document.getElementById('btn-splash-about');
    const btnCloseAbout = document.getElementById('btn-close-about');
    const btnConfirmAbout = document.getElementById('btn-confirm-about');

    const dialogGameOver = document.getElementById('dialog-game-over');
    const gameOverTitle = document.getElementById('game-over-title');
    const gameOverSubtitle = document.getElementById('game-over-subtitle');
    const gameOverIcon = document.getElementById('game-over-icon');
    const finalScoreRuby = document.getElementById('final-score-ruby');
    const finalScorePearl = document.getElementById('final-score-pearl');
    const btnGameOverRematch = document.getElementById('btn-game-over-rematch');
    const btnGameOverClose = document.getElementById('btn-game-over-close');

    // State Variables
    let selectedMode = 'pve';
    let selectedPreset = localStorage.getItem('hexxagon_maze') || 'classic';
    let selectedTheme = localStorage.getItem('hexxagon_theme') || 'space_invaders';
    let selectedDiff = 'medium';
    let game = null;
    let screenShakeEnabled = localStorage.getItem('hexxagon_shake') !== 'false';
    let reduceFlashesEnabled = localStorage.getItem('hexxagon_reduce_flashes') === 'true';

    // Start Menu BGM on first interaction
    const initMusicOnInteraction = () => {
        if (!game || screenGame?.classList.contains('hidden-screen')) {
            sound.startMusic('menu');
        }
        window.removeEventListener('pointerdown', initMusicOnInteraction);
        window.removeEventListener('keydown', initMusicOnInteraction);
    };
    window.addEventListener('pointerdown', initMusicOnInteraction, { once: true });
    window.addEventListener('keydown', initMusicOnInteraction, { once: true });

    // Auto-close dialogs on backdrop click
    const allDialogs = [
        dialogHowToPlay,
        dialogStrategy,
        dialogSettings,
        dialogStats,
        dialogShortcuts,
        dialogAbout,
        dialogGameOver
    ];

    allDialogs.forEach(dlg => {
        if (dlg) {
            dlg.addEventListener('click', (e) => {
                const rect = dlg.getBoundingClientRect();
                const isInDialog = (
                    rect.top <= e.clientY &&
                    e.clientY <= rect.top + rect.height &&
                    rect.left <= e.clientX &&
                    e.clientX <= rect.left + rect.width
                );
                if (!isInDialog) {
                    dlg.close();
                }
            });
        }
    });

    // Sound & Music UI Synchronization
    function syncSoundUI(muted) {
        if (muted) {
            iconSoundOn?.classList.add('hidden');
            iconSoundOff?.classList.remove('hidden');
            if (splashSoundIcon) splashSoundIcon.textContent = '🔇';
            if (splashSoundText) splashSoundText.textContent = 'AUDIO MUTED';
            if (settingToggleSound) {
                settingToggleSound.textContent = 'MUTED';
                settingToggleSound.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all bg-rose-500/20 border border-rose-400 text-rose-300 hover:bg-rose-500/30 cursor-pointer';
            }
        } else {
            iconSoundOn?.classList.remove('hidden');
            iconSoundOff?.classList.add('hidden');
            if (splashSoundIcon) splashSoundIcon.textContent = '🔊';
            if (splashSoundText) splashSoundText.textContent = 'AUDIO ON';
            if (settingToggleSound) {
                settingToggleSound.textContent = 'ENABLED';
                settingToggleSound.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all bg-emerald-500/20 border border-emerald-400 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer';
            }
        }
    }

    function syncMusicUI(musicMuted) {
        if (settingToggleMusic) {
            if (musicMuted) {
                settingToggleMusic.textContent = 'MUTED';
                settingToggleMusic.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all bg-rose-500/20 border border-rose-400 text-rose-300 hover:bg-rose-500/30 cursor-pointer';
            } else {
                settingToggleMusic.textContent = 'ENABLED';
                settingToggleMusic.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all bg-emerald-500/20 border border-emerald-400 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer';
            }
        }
    }

    syncSoundUI(sound.muted);
    syncMusicUI(sound.musicMuted);

    btnToggleSound?.addEventListener('click', () => {
        const isMuted = sound.toggleMute();
        syncSoundUI(isMuted);
    });

    btnSplashSound?.addEventListener('click', () => {
        const isMuted = sound.toggleMute();
        syncSoundUI(isMuted);
        if (!isMuted) sound.playSelect();
    });

    settingToggleSound?.addEventListener('click', () => {
        const isMuted = sound.toggleMute();
        syncSoundUI(isMuted);
        if (!isMuted) sound.playSelect();
    });

    settingToggleMusic?.addEventListener('click', () => {
        const isMusicMuted = sound.toggleMusic();
        syncMusicUI(isMusicMuted);
        if (!isMusicMuted) {
            sound.playSelect();
            if (!sound.isPlayingMusic) {
                sound.startMusic(screenSplash?.classList.contains('hidden-screen') ? 'game' : 'menu');
            }
        }
    });

    // Volume Slider
    if (settingVolumeSlider && settingVolumeLabel) {
        const initialVol = Math.round((sound.volume || 0.7) * 100);
        settingVolumeSlider.value = String(initialVol);
        settingVolumeLabel.textContent = `${initialVol}%`;

        settingVolumeSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            settingVolumeLabel.textContent = `${val}%`;
            sound.setVolume(val / 100);
        });
    }

    // Screen Shake & Accessibility Toggles
    function updateSettingsUI() {
        if (settingToggleShake) {
            if (screenShakeEnabled) {
                settingToggleShake.textContent = 'ON';
                settingToggleShake.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all bg-cyan-500/20 border border-cyan-400 text-cyan-300 hover:bg-cyan-500/30';
            } else {
                settingToggleShake.textContent = 'OFF';
                settingToggleShake.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all bg-slate-800 border border-slate-700 text-slate-400 hover:text-white';
            }
        }

        if (settingToggleFlashes) {
            if (reduceFlashesEnabled) {
                settingToggleFlashes.textContent = 'ON';
                settingToggleFlashes.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all bg-emerald-500/20 border border-emerald-400 text-emerald-300 hover:bg-emerald-500/30';
            } else {
                settingToggleFlashes.textContent = 'OFF';
                settingToggleFlashes.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all bg-slate-800 border border-slate-700 text-slate-400 hover:text-white';
            }
        }
    }
    updateSettingsUI();

    settingToggleShake?.addEventListener('click', () => {
        screenShakeEnabled = !screenShakeEnabled;
        localStorage.setItem('hexxagon_shake', String(screenShakeEnabled));
        updateSettingsUI();
        sound.playSelect();
    });

    settingToggleFlashes?.addEventListener('click', () => {
        reduceFlashesEnabled = !reduceFlashesEnabled;
        localStorage.setItem('hexxagon_reduce_flashes', String(reduceFlashesEnabled));
        updateSettingsUI();
        sound.playSelect();
    });

    // Splash Screen: Difficulty Buttons
    splashDiffButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const diff = btn.getAttribute('data-diff');
            if (diff) {
                selectedDiff = diff;
                splashDiffButtons.forEach(b => {
                    if (b.getAttribute('data-diff') === diff) {
                        b.className = 'btn-splash-diff active py-1.5 text-xs font-mono font-bold text-cyan-200 bg-cyan-500/20 border border-cyan-400/80 rounded-lg cursor-pointer';
                    } else {
                        b.className = 'btn-splash-diff py-1.5 text-xs font-mono font-bold text-slate-400 rounded-lg transition-colors hover:text-cyan-300 cursor-pointer';
                    }
                });
                sound.playSelect();
            }
        });
    });

    // Update In-Game Composite Stage Banner (e.g. STAGE 1 // SPACE INVADERS • CLASSIC)
    function updateStageBanner() {
        if (stageBannerText && BOARD_PRESETS[selectedPreset] && STAGE_THEMES[selectedTheme]) {
            const maze = BOARD_PRESETS[selectedPreset];
            const theme = STAGE_THEMES[selectedTheme];
            stageBannerText.textContent = `${theme.stageTitle} • ${maze.shortName || maze.name}`;
        }
    }

    // Theme Selection Synchronizer (Splash & Settings)
    function updateThemeCardsUI(themeId) {
        selectedTheme = themeId;
        localStorage.setItem('hexxagon_theme', themeId);
        if (splashSelectTheme) splashSelectTheme.value = themeId;
        if (settingSelectTheme) settingSelectTheme.value = themeId;

        // Apply theme globally across Document, Body, and Stage Backdrop
        document.documentElement.setAttribute('data-theme', themeId);
        document.body.setAttribute('data-theme', themeId);
        const stageBackdrop = document.getElementById('stage-backdrop');
        if (stageBackdrop) {
            stageBackdrop.setAttribute('data-theme', themeId);
        }

        const themeObj = STAGE_THEMES[themeId];
        if (splashThemeTagline && themeObj) {
            splashThemeTagline.textContent = themeObj.subtitle;
        }

        splashThemeButtons.forEach(btn => {
            const bTheme = btn.getAttribute('data-theme');
            if (bTheme === themeId) {
                btn.classList.add('active');
                btn.classList.remove('border-slate-700', 'bg-[#04060c]');
                btn.classList.add('border-cyan-400/80', 'bg-cyan-500/20');
            } else {
                btn.classList.remove('active', 'border-cyan-400/80', 'bg-cyan-500/20');
                btn.classList.add('border-slate-700', 'bg-[#04060c]');
            }
        });

        if (game) {
            game.setTheme(themeId);
            if (sound.isPlayingMusic && sound.currentTrack !== 'menu') {
                sound.startMusic(themeObj?.bgmTrack || themeId);
            }
            updateStageBanner();
        }
    }

    // Theme selection button clicks
    splashThemeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            if (theme) {
                updateThemeCardsUI(theme);
                sound.playSelect();
            }
        });
    });

    splashSelectTheme?.addEventListener('change', (e) => {
        updateThemeCardsUI(e.target.value);
        sound.playSelect();
    });

    settingSelectTheme?.addEventListener('change', (e) => {
        updateThemeCardsUI(e.target.value);
        sound.playSelect();
    });

    // Splash Screen: Mode Selector
    splashSelectMode?.addEventListener('change', (e) => {
        selectedMode = e.target.value;
        if (selectedMode === 'pve') {
            splashContainerDiff?.classList.remove('opacity-30', 'pointer-events-none');
        } else {
            splashContainerDiff?.classList.add('opacity-30', 'pointer-events-none');
        }

        if (selectedMode === 'trio') {
            if (splashSelectPreset) splashSelectPreset.value = 'trio';
            selectedPreset = 'trio';
        } else if (selectedPreset === 'trio') {
            if (splashSelectPreset) splashSelectPreset.value = 'classic';
            selectedPreset = 'classic';
        }
        localStorage.setItem('hexxagon_maze', selectedPreset);
        sound.playSelect();
    });

    // Splash Screen: Maze Type Selector
    splashSelectPreset?.addEventListener('change', (e) => {
        selectedPreset = e.target.value;
        localStorage.setItem('hexxagon_maze', selectedPreset);
        if (selectedPreset === 'trio') {
            if (splashSelectMode) splashSelectMode.value = 'trio';
            selectedMode = 'trio';
            splashContainerDiff?.classList.add('opacity-30', 'pointer-events-none');
        } else if (selectedMode === 'trio') {
            if (splashSelectMode) splashSelectMode.value = 'pve';
            selectedMode = 'pve';
            splashContainerDiff?.classList.remove('opacity-30', 'pointer-events-none');
        }
        sound.playSelect();
    });

    // Reset Menu Selections to Defaults (PvE, Classic / Saved, Medium AI)
    function resetMenuSelections() {
        selectedMode = 'pve';
        selectedPreset = localStorage.getItem('hexxagon_maze') || 'classic';
        selectedTheme = localStorage.getItem('hexxagon_theme') || 'space_invaders';
        selectedDiff = 'medium';

        if (splashSelectMode) splashSelectMode.value = 'pve';
        if (splashSelectPreset) splashSelectPreset.value = selectedPreset;
        splashContainerDiff?.classList.remove('opacity-30', 'pointer-events-none');

        updateThemeCardsUI(selectedTheme);

        splashDiffButtons.forEach(b => {
            if (b.getAttribute('data-diff') === 'medium') {
                b.className = 'btn-splash-diff active py-1.5 text-xs font-mono font-bold text-cyan-200 bg-cyan-500/20 border border-cyan-400/80 rounded-lg cursor-pointer';
            } else {
                b.className = 'btn-splash-diff py-1.5 text-xs font-mono font-bold text-slate-400 rounded-lg transition-colors hover:text-cyan-300 cursor-pointer';
            }
        });
    }

    // Initialize defaults on fresh load
    resetMenuSelections();

    // Screen State Transition Functions
    function showTitleScreen() {
        resetMenuSelections();
        screenGame?.classList.add('hidden-screen');
        screenSetup?.classList.add('hidden-screen');
        screenTitle?.classList.remove('hidden-screen');
        sound.startMusic('menu');
        sound.playDeselect();
    }

    function showSetupScreen() {
        screenGame?.classList.add('hidden-screen');
        screenTitle?.classList.add('hidden-screen');
        screenSetup?.classList.remove('hidden-screen');
        sound.startMusic('menu');
        sound.playSelect();
    }

    function launchBattle() {
        sound.playSelect();
        const themeObj = STAGE_THEMES[selectedTheme] || STAGE_THEMES.space_invaders;
        sound.startMusic(themeObj.bgmTrack || 'space_invaders');
        screenTitle?.classList.add('hidden-screen');
        screenSetup?.classList.add('hidden-screen');
        screenGame?.classList.remove('hidden-screen');

        const modeKey = selectedMode === 'pve' ? `pve-${selectedDiff}` : selectedMode;

        if (!game) {
            game = new HexxagonGame({
                presetId: selectedPreset,
                themeId: selectedTheme,
                gameMode: modeKey
            });
            attachGameEvents(game);
        } else {
            game.setPreset(selectedPreset);
            game.setTheme(selectedTheme);
            game.setGameMode(modeKey);
            game.initGame();
        }

        // Update In-Game Labels with Composite Stage Banner
        updateStageBanner();

        if (selectedMode === 'trio') {
            cardEmerald?.classList.remove('hidden');
            cardEmerald?.classList.add('flex');
        } else {
            cardEmerald?.classList.add('hidden');
            cardEmerald?.classList.remove('flex');
        }

        if (labelPlayerPearl) {
            labelPlayerPearl.textContent = selectedMode === 'pvp' ? 'Player 2' : (selectedMode === 'trio' ? 'Player 2' : 'Pearls');
        }

        window.hexxagonInstance = game;
    }

    // Attach Game Event Listeners
    function attachGameEvents(gameInstance) {
        // Event: Score Change
        gameInstance.on('scoreChange', ({ scores }) => {
            if (scoreRuby) scoreRuby.textContent = scores.ruby || 0;
            if (scorePearl) scorePearl.textContent = scores.pearl || 0;
            if (scoreEmerald && scores.emerald !== undefined) {
                scoreEmerald.textContent = scores.emerald || 0;
            }
        });

        // Helper: Contextual Undo Button Visibility
        function updateUndoButton(canUndo) {
            if (!btnHudUndo) return;
            if (canUndo) {
                btnHudUndo.classList.remove('opacity-0', 'pointer-events-none', 'scale-95', 'invisible');
                btnHudUndo.classList.add('opacity-100', 'scale-100', 'visible');
                btnHudUndo.removeAttribute('disabled');
            } else {
                btnHudUndo.classList.add('opacity-0', 'pointer-events-none', 'scale-95', 'invisible');
                btnHudUndo.classList.remove('opacity-100', 'scale-100', 'visible');
                btnHudUndo.setAttribute('disabled', 'true');
            }
        }

        // Event: Turn Change
        gameInstance.on('turnChange', ({ currentPlayer, isAi, moveCount, canUndo }) => {
            if (hudMoveCount) hudMoveCount.textContent = moveCount;
            updateUndoButton(canUndo ?? gameInstance.canUndo());

            // Reset turn dots & borders
            turnDotRuby?.classList.add('hidden');
            turnDotRubySolid?.classList.add('hidden');
            turnDotPearl?.classList.add('hidden');
            turnDotPearlSolid?.classList.add('hidden');

            cardRuby?.classList.remove('border-[#ff2d60]', 'bg-white/5');
            cardPearl?.classList.remove('border-[#00e5ff]', 'bg-white/5');
            cardEmerald?.classList.remove('border-[#10b981]', 'bg-white/5');

            if (currentPlayer === 'ruby') {
                turnDotRuby?.classList.remove('hidden');
                turnDotRubySolid?.classList.remove('hidden');
                cardRuby?.classList.add('border-[#ff2d60]', 'bg-white/5');
                if (turnStatusIndicator) {
                    turnStatusIndicator.style.backgroundColor = '#ff2d60';
                    turnStatusIndicator.style.boxShadow = '0 0 8px #ff2d60';
                }
                const text = selectedMode === 'pvp' ? "Player 1's Turn" : "Your Turn";
                if (turnStatusText) turnStatusText.textContent = text;
            } else if (currentPlayer === 'pearl') {
                turnDotPearl?.classList.remove('hidden');
                turnDotPearlSolid?.classList.remove('hidden');
                cardPearl?.classList.add('border-[#00e5ff]', 'bg-white/5');
                if (turnStatusIndicator) {
                    turnStatusIndicator.style.backgroundColor = '#00e5ff';
                    turnStatusIndicator.style.boxShadow = '0 0 8px #00e5ff';
                }
                const text = isAi ? 'AI Thinking…' : "Player 2's Turn";
                if (turnStatusText) turnStatusText.textContent = text;
            } else if (currentPlayer === 'emerald') {
                cardEmerald?.classList.add('border-[#10b981]', 'bg-white/5');
                if (turnStatusIndicator) {
                    turnStatusIndicator.style.backgroundColor = '#10b981';
                    turnStatusIndicator.style.boxShadow = '0 0 8px #10b981';
                }
                if (turnStatusText) turnStatusText.textContent = "Player 3's Turn";
            }
        });

        // Event: AI Thinking
        gameInstance.on('aiThinking', (thinking) => {
            if (thinking) {
                turnStatusIndicator?.classList.add('animate-spin');
                if (turnStatusText) turnStatusText.textContent = 'AI Calculating…';
                updateUndoButton(false);
            } else {
                turnStatusIndicator?.classList.remove('animate-spin');
                updateUndoButton(gameInstance.canUndo());
            }
        });

        // Event: Game Over
        gameInstance.on('gameOver', ({ winner, isTie, scores, moveCount }) => {
            updateUndoButton(false);
            if (!dialogGameOver) return;

            if (finalScoreRuby) finalScoreRuby.textContent = scores.ruby || 0;
            if (finalScorePearl) finalScorePearl.textContent = scores.pearl || 0;

            if (isTie) {
                if (gameOverTitle) gameOverTitle.textContent = 'Stalemate / Draw!';
                if (gameOverSubtitle) gameOverSubtitle.textContent = `Both sides finished tied with ${scores.ruby} gems each in ${moveCount} moves.`;
                if (gameOverIcon) gameOverIcon.textContent = '🤝';
            } else if (winner === 'ruby') {
                if (gameOverTitle) gameOverTitle.textContent = selectedMode === 'pvp' ? 'Player 1 Wins!' : 'Victory! You Won!';
                if (gameOverSubtitle) gameOverSubtitle.textContent = `Rubies dominated the board with ${scores.ruby} gems over Pearls (${scores.pearl}) in ${moveCount} moves.`;
                if (gameOverIcon) gameOverIcon.textContent = '🏆';
            } else if (winner === 'pearl') {
                if (gameOverTitle) gameOverTitle.textContent = selectedMode === 'pvp' ? 'Player 2 Wins!' : 'AI Opponent Wins!';
                if (gameOverSubtitle) gameOverSubtitle.textContent = `Pearls secured victory with ${scores.pearl} gems vs Rubies (${scores.ruby}) in ${moveCount} moves.`;
                if (gameOverIcon) gameOverIcon.textContent = selectedMode === 'pvp' ? '🏆' : '💀';
            }

            // Smooth 350ms cinematic delay so player sees the final board state before modal pops
            setTimeout(() => {
                if (!dialogGameOver.open) {
                    dialogGameOver.showModal();
                }
            }, 350);
        });
    }

    // Title Screen: Animated "PLAY!" button -> Opens Setup Screen
    btnTitlePlay?.addEventListener('click', showSetupScreen);

    // Setup Screen: Back to Title button
    btnSetupBack?.addEventListener('click', showTitleScreen);

    // Setup Screen: Start Battle CTA button
    btnSplashStartGame?.addEventListener('click', launchBattle);

    // Return to Menu / Title Screen Button from Game Arena Header
    btnNavMenu?.addEventListener('click', showTitleScreen);

    // Restart Button inside Arena
    btnRestartGame?.addEventListener('click', () => {
        if (game) game.initGame();
        sound.playSelect();
    });

    // Undo Button
    btnHudUndo?.addEventListener('click', () => {
        if (game) game.undo();
    });

    // Rematch & Review in Game Over Modal
    btnGameOverRematch?.addEventListener('click', () => {
        dialogGameOver?.close();
        if (game) game.initGame();
    });

    btnGameOverClose?.addEventListener('click', () => {
        dialogGameOver?.close();
    });

    // Modal Triggers: How To Play / Rules
    const openHowToPlay = () => {
        sound.playSelect();
        dialogHowToPlay?.showModal();
    };
    const closeHowToPlay = () => dialogHowToPlay?.close();
    btnOpenHowToPlay?.addEventListener('click', openHowToPlay);
    btnSplashHowToPlay?.addEventListener('click', openHowToPlay);
    btnCloseHowToPlay?.addEventListener('click', closeHowToPlay);
    btnConfirmHowToPlay?.addEventListener('click', closeHowToPlay);

    // Modal Triggers: Strategy Guide
    const openStrategy = () => {
        sound.playSelect();
        dialogStrategy?.showModal();
    };
    const closeStrategy = () => dialogStrategy?.close();
    btnOpenStrategy?.addEventListener('click', openStrategy);
    btnSplashStrategy?.addEventListener('click', openStrategy);
    btnCloseStrategy?.addEventListener('click', closeStrategy);
    btnConfirmStrategy?.addEventListener('click', closeStrategy);

    // Modal Triggers: Settings
    const openSettings = () => {
        sound.playSelect();
        updateSettingsUI();
        dialogSettings?.showModal();
    };
    const closeSettings = () => dialogSettings?.close();
    btnOpenSettings?.addEventListener('click', openSettings);
    btnSplashSettings?.addEventListener('click', openSettings);
    btnCloseSettings?.addEventListener('click', closeSettings);
    btnConfirmSettings?.addEventListener('click', closeSettings);

    // Modal Triggers: Stats
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
        sound.playSelect();
        updateStatsUI();
        dialogStats?.showModal();
    };
    const closeStats = () => dialogStats?.close();
    btnOpenStats?.addEventListener('click', openStats);
    btnSplashStats?.addEventListener('click', openStats);
    btnCloseStats?.addEventListener('click', closeStats);
    btnCloseStatsAction?.addEventListener('click', closeStats);
    btnResetStats?.addEventListener('click', () => {
        localStorage.removeItem('hexxagon_stats_v2');
        updateStatsUI();
        sound.playDeselect();
    });

    btnSettingsClearData?.addEventListener('click', () => {
        localStorage.removeItem('hexxagon_stats_v2');
        localStorage.removeItem('hexxagon_shake');
        localStorage.removeItem('hexxagon_reduce_flashes');
        localStorage.removeItem('hexxagon_volume');
        localStorage.removeItem('hexxagon_muted');
        updateStatsUI();
        updateSettingsUI();
        sound.playDeselect();
    });

    // Modal Triggers: Shortcuts
    const openShortcuts = () => {
        sound.playSelect();
        dialogShortcuts?.showModal();
    };
    const closeShortcuts = () => dialogShortcuts?.close();
    btnSplashShortcuts?.addEventListener('click', openShortcuts);
    btnCloseShortcuts?.addEventListener('click', closeShortcuts);
    btnCloseShortcutsAction?.addEventListener('click', closeShortcuts);

    // Modal Triggers: About
    const openAbout = () => {
        sound.playSelect();
        dialogAbout?.showModal();
    };
    const closeAbout = () => dialogAbout?.close();
    btnSplashAbout?.addEventListener('click', openAbout);
    btnCloseAbout?.addEventListener('click', closeAbout);
    btnConfirmAbout?.addEventListener('click', closeAbout);

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            openHowToPlay();
        } else if (e.key === 'm' || e.key === 'M') {
            const isMuted = sound.toggleMute();
            syncSoundUI(isMuted);
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
            // Close any open dialogs first
            allDialogs.forEach(dlg => {
                if (dlg && dlg.open) dlg.close();
            });
        }
    });
}
