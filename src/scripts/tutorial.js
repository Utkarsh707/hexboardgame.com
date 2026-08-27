/**
 * Hexxagon Interactive Tutorial Controller
 * Provides step-by-step guided lessons with interactive validation,
 * visual hand/target pointers, auto-demonstration playback, and completion flow.
 */

import { HexMath } from './hex-math.js';
import { sound } from './audio.js';

export const TUTORIAL_LESSONS = [
    {
        id: 'clone',
        stepNumber: 1,
        title: '1-Step Duplication (Clone)',
        presetId: 'tutorial_clone',
        tag: 'DUPLICATION',
        badgeColor: '#00e676',
        instruction: 'Click your <strong class="text-[#ff4b72]">Ruby</strong> and select an adjacent <strong class="text-emerald-400">Green Ring</strong> (1 hex away). It clones a brand new Ruby while keeping your original!',
        hint: '1-step moves duplicate your gem. Click your piece at center, then tap any green ring around it.',
        autoDemo: {
            fromKey: HexMath.key(0, 0),
            toKey: HexMath.key(1, 0)
        },
        successMsg: '🎉 Perfect Clone! You created a new gem while keeping your original intact!'
    },
    {
        id: 'jump',
        stepNumber: 2,
        title: '2-Step Leap (Jump)',
        presetId: 'tutorial_jump',
        tag: 'MOBILITY',
        badgeColor: '#ffab00',
        instruction: 'Click your <strong class="text-[#ff4b72]">Ruby</strong> and pick an <strong class="text-amber-400">Amber Ring</strong> (2 hexes away). Jumps leap across the board and leave the starting cell empty!',
        hint: '2-step moves leap across distance. Click your Ruby on the left, then pick an amber ring in the center.',
        autoDemo: {
            fromKey: HexMath.key(-2, 0),
            toKey: HexMath.key(0, 0)
        },
        successMsg: '🚀 Excellent Leap! Jumps let you traverse large distances rapidly!'
    },
    {
        id: 'infect',
        stepNumber: 3,
        title: 'Infection Attack (Conversion)',
        presetId: 'tutorial_infect',
        tag: 'CONVERSION',
        badgeColor: '#ff0844',
        instruction: 'Whenever your gem lands next to enemy Pearls, they immediately <strong class="text-rose-400">convert to Rubies</strong>! Move your Ruby adjacent to the cluster of Pearls.',
        hint: 'Landing near enemy gems flips them all to your side in an infection cascade! Move your piece to (–1, 0).',
        autoDemo: {
            fromKey: HexMath.key(-2, 0),
            toKey: HexMath.key(-1, 0)
        },
        successMsg: '⚡ Chain Reaction! All neighboring enemy gems were instantly converted to Rubies!'
    },
    {
        id: 'defense',
        stepNumber: 4,
        title: 'Tactical Formations & Walls',
        presetId: 'tutorial_defense',
        tag: 'STRATEGY',
        badgeColor: '#38bdf8',
        instruction: 'Cloning builds strong defensive walls. Move to <strong class="text-cyan-300">(0, 0)</strong> or <strong class="text-cyan-300">(0, 1)</strong> to safely convert the enemy without leaving an isolated gem behind.',
        hint: 'Cloning maintains a connected cluster so the opponent cannot easily surround you.',
        autoDemo: {
            fromKey: HexMath.key(-1, 0),
            toKey: HexMath.key(0, 0)
        },
        successMsg: '🛡️ Great Tactics! Cloned clusters create fortified walls against counter-attacks.'
    },
    {
        id: 'practice',
        stepNumber: 5,
        title: 'Mini Practice Skirmish',
        presetId: 'tutorial_mini',
        tag: 'COMBAT TEST',
        badgeColor: '#a855f7',
        instruction: 'Put all skills together in a fast mini match! Outnumber the Training AI to claim victory. Clone to expand, jump to flank, and infect enemy clusters!',
        hint: 'Play strategically: duplicate when safe, jump for big captures, and protect your borders.',
        isFreePlay: true,
        successMsg: '🏆 Fantastic Victory! You have mastered all core mechanics of Hexxagon!'
    }
];

export class TutorialManager {
    constructor(gameInstance, uiCallbacks = {}) {
        this.game = gameInstance;
        this.currentStepIndex = 0;
        this.isActive = false;
        this.isAutoDemoRunning = false;
        this.uiCallbacks = uiCallbacks;
        this.autoDemoTimeout = null;

        // Overlay DOM Elements
        this.overlayEl = document.getElementById('tutorial-overlay');
        this.stepBadge = document.getElementById('tutorial-step-badge');
        this.titleEl = document.getElementById('tutorial-lesson-title');
        this.instructionEl = document.getElementById('tutorial-instruction-text');
        this.successBannerEl = document.getElementById('tutorial-success-banner');
        this.successMsgEl = document.getElementById('tutorial-success-msg');
        this.btnNext = document.getElementById('btn-tutorial-next');
        this.btnPrev = document.getElementById('btn-tutorial-prev');
        this.btnReset = document.getElementById('btn-tutorial-reset');
        this.btnAutoDemo = document.getElementById('btn-tutorial-autodemo');
        this.btnExit = document.getElementById('btn-tutorial-exit');
        this.btnSuccessProceed = document.getElementById('btn-tutorial-success-proceed');
        this.progressBar = document.getElementById('tutorial-progress-bar');
        this.modalComplete = document.getElementById('dialog-tutorial-complete');
        this.btnCompletePlayReal = document.getElementById('btn-tutorial-complete-play');
        this.btnCompleteReplay = document.getElementById('btn-tutorial-complete-replay');
        this.btnCompleteClose = document.getElementById('btn-tutorial-complete-close');

        this.bindEvents();
    }

    setGame(gameInstance) {
        this.game = gameInstance;
    }

    bindEvents() {
        this.btnNext?.addEventListener('click', () => {
            sound.playSelect();
            this.nextLesson();
        });

        this.btnPrev?.addEventListener('click', () => {
            sound.playDeselect();
            this.prevLesson();
        });

        this.btnReset?.addEventListener('click', () => {
            sound.playSelect();
            this.loadCurrentLesson();
        });

        this.btnAutoDemo?.addEventListener('click', () => {
            this.runAutoDemo();
        });

        this.btnExit?.addEventListener('click', () => {
            this.exitTutorial();
        });

        this.btnSuccessProceed?.addEventListener('click', () => {
            sound.playSelect();
            this.hideSuccessBanner();
            if (this.currentStepIndex < TUTORIAL_LESSONS.length - 1) {
                this.nextLesson();
            } else {
                this.showCompletionModal();
            }
        });

        this.btnCompletePlayReal?.addEventListener('click', () => {
            this.modalComplete?.close();
            this.exitTutorial(true);
        });

        this.btnCompleteReplay?.addEventListener('click', () => {
            this.modalComplete?.close();
            this.startTutorial(0);
        });

        this.btnCompleteClose?.addEventListener('click', () => {
            this.modalComplete?.close();
            this.exitTutorial();
        });
    }

    startTutorial(startIndex = 0) {
        this.isActive = true;
        this.currentStepIndex = startIndex;
        this.overlayEl?.classList.remove('hidden');
        this.overlayEl?.classList.add('flex');
        document.getElementById('card-top-scoreboard')?.classList.add('hidden');

        if (this.game) {
            this.game.setTutorialMode(true);
        }

        this.loadCurrentLesson();
    }

    loadCurrentLesson() {
        this.clearAutoDemo();
        this.hideSuccessBanner();
        const lesson = TUTORIAL_LESSONS[this.currentStepIndex];
        if (!lesson) return;

        // Update HUD elements
        if (this.stepBadge) {
            this.stepBadge.textContent = `LESSON ${lesson.stepNumber} OF ${TUTORIAL_LESSONS.length}`;
            this.stepBadge.style.borderColor = lesson.badgeColor || '#00e5ff';
            this.stepBadge.style.color = lesson.badgeColor || '#00e5ff';
        }

        if (this.titleEl) {
            this.titleEl.textContent = lesson.title;
        }

        if (this.instructionEl) {
            this.instructionEl.innerHTML = lesson.instruction;
        }

        if (this.progressBar) {
            const pct = Math.round(((this.currentStepIndex + 1) / TUTORIAL_LESSONS.length) * 100);
            this.progressBar.style.width = `${pct}%`;
        }

        if (this.btnPrev) {
            this.btnPrev.disabled = this.currentStepIndex === 0;
            this.btnPrev.classList.toggle('opacity-40', this.currentStepIndex === 0);
            this.btnPrev.classList.toggle('pointer-events-none', this.currentStepIndex === 0);
        }

        if (this.btnAutoDemo) {
            if (lesson.isFreePlay || !lesson.autoDemo) {
                this.btnAutoDemo.classList.add('hidden');
            } else {
                this.btnAutoDemo.classList.remove('hidden');
            }
        }

        // Initialize Game Arena with Lesson Preset
        if (this.game) {
            this.game.setPreset(lesson.presetId);
            if (lesson.isFreePlay) {
                this.game.setGameMode('pve-easy');
            } else {
                this.game.setGameMode('tutorial');
            }
            this.game.initGame();
        }

        // Highlight recommended starting piece if single piece
        this.highlightLessonGuide(lesson);
    }

    highlightLessonGuide(lesson) {
        if (!this.game || lesson.isFreePlay) return;

        // Auto-select starting piece after brief 150ms pause so player immediately sees valid targets
        setTimeout(() => {
            if (!this.isActive || this.isAutoDemoRunning) return;
            if (lesson.autoDemo?.fromKey && this.game.state?.board[lesson.autoDemo.fromKey] === 'ruby') {
                this.game.handleCellClick(lesson.autoDemo.fromKey);
            }
        }, 150);
    }

    async runAutoDemo() {
        const lesson = TUTORIAL_LESSONS[this.currentStepIndex];
        if (!lesson || !lesson.autoDemo || this.isAutoDemoRunning) return;

        this.isAutoDemoRunning = true;
        sound.playSelect();
        this.clearAutoDemo();

        // 1. Reset board to lesson start state
        this.game.initGame();
        await new Promise(r => setTimeout(r, 200));

        // 2. Select starting piece
        const fromKey = lesson.autoDemo.fromKey;
        this.game.handleCellClick(fromKey);
        await new Promise(r => setTimeout(r, 350));

        // 3. Find matching legal move
        const targetMove = this.game.validMoves.find(m => m.toKey === lesson.autoDemo.toKey);
        if (targetMove) {
            await this.game.executeMove(targetMove);
        }

        this.isAutoDemoRunning = false;
    }

    clearAutoDemo() {
        if (this.autoDemoTimeout) {
            clearTimeout(this.autoDemoTimeout);
            this.autoDemoTimeout = null;
        }
        this.isAutoDemoRunning = false;
    }

    handleMoveMade(move, player) {
        if (!this.isActive || player !== 'ruby') return;
        const lesson = TUTORIAL_LESSONS[this.currentStepIndex];
        if (!lesson) return;

        if (lesson.isFreePlay) {
            // In free play lesson, let game proceed normally until victory/end
            return;
        }

        let isCorrect = true;
        if (lesson.id === 'clone' && move.type !== 'clone') isCorrect = false;
        if (lesson.id === 'jump' && move.type !== 'jump') isCorrect = false;
        if (lesson.id === 'infect' && (!move.captures || move.captures.length === 0)) isCorrect = false;

        if (isCorrect) {
            this.showSuccessBanner(lesson.successMsg);
        } else {
            sound.playDeselect();
            if (this.instructionEl) {
                this.instructionEl.innerHTML = `<span class="text-amber-300 font-bold">⚠️ Try again!</span> ${lesson.hint}`;
            }
        }
    }

    handleGameOver(winner) {
        if (!this.isActive) return;
        const lesson = TUTORIAL_LESSONS[this.currentStepIndex];
        if (lesson && lesson.isFreePlay) {
            if (winner === 'ruby') {
                this.showCompletionModal();
            } else {
                this.showSuccessBanner('Good try! Tap "Reset" to try the practice arena again.');
            }
        }
    }

    showSuccessBanner(msg) {
        if (this.successBannerEl && this.successMsgEl) {
            this.successMsgEl.textContent = msg;
            this.successBannerEl.classList.remove('hidden');
            this.successBannerEl.classList.add('flex');
            sound.playSelect();
        }
    }

    hideSuccessBanner() {
        if (this.successBannerEl) {
            this.successBannerEl.classList.add('hidden');
            this.successBannerEl.classList.remove('flex');
        }
    }

    showCompletionModal() {
        this.hideSuccessBanner();
        if (this.modalComplete) {
            this.modalComplete.showModal();
            sound.playVictory();
        }
    }

    nextLesson() {
        if (this.currentStepIndex < TUTORIAL_LESSONS.length - 1) {
            this.currentStepIndex++;
            this.loadCurrentLesson();
        } else {
            this.showCompletionModal();
        }
    }

    prevLesson() {
        if (this.currentStepIndex > 0) {
            this.currentStepIndex--;
            this.loadCurrentLesson();
        }
    }

    exitTutorial(launchBattle = false) {
        this.isActive = false;
        this.clearAutoDemo();
        this.hideSuccessBanner();
        this.overlayEl?.classList.add('hidden');
        this.overlayEl?.classList.remove('flex');
        document.getElementById('card-top-scoreboard')?.classList.remove('hidden');

        if (this.game) {
            this.game.setTutorialMode(false);
        }

        if (this.uiCallbacks.onExit) {
            this.uiCallbacks.onExit(launchBattle);
        }
    }
}
