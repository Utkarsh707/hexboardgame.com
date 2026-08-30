/**
 * Hexxagon High-Performance Artificial Intelligence Engine
 * Multi-Tier Tactical Engine with Alpha-Beta Pruning & Positional Heuristics
 */

import { HexMath } from './hex-math.js';

export class HexxagonAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty; // 'easy', 'medium', 'master' | 'hard'
    }

    setDifficulty(diff) {
        this.difficulty = diff;
    }

    getLegalMoves(state, player) {
        return HexxagonAI.getLegalMoves(state, player);
    }

    getCaptures(state, target, player) {
        return HexxagonAI.getCaptures(state, target, player);
    }

    static getLegalMoves(state, player) {
        const moves = [];
        const { board, cells, specialTiles } = state;
        const validCells = state.cellSet || (state.cellSet = new Set(cells));

        for (const [key, pieceOwner] of Object.entries(board)) {
            if (pieceOwner !== player) continue;
            const from = HexMath.parseKey(key);
            const reachables = HexMath.getReachableHexes(from, 2);

            for (let i = 0; i < reachables.length; i++) {
                const target = reachables[i];
                const targetKey = HexMath.key(target.q, target.r);

                if (validCells.has(targetKey) && !board[targetKey]) {
                    // Check for Quantum Warp Tile
                    let warpToKey = null;
                    let finalTarget = target;
                    if (specialTiles && specialTiles[targetKey]?.type === 'warp') {
                        const warpTargetKey = specialTiles[targetKey].target;
                        if (!board[warpTargetKey]) {
                            warpToKey = warpTargetKey;
                            finalTarget = HexMath.parseKey(warpTargetKey);
                        }
                    }

                    const captures = HexxagonAI.getCaptures(state, finalTarget, player);
                    moves.push({
                        from,
                        to: target,
                        fromKey: key,
                        toKey: targetKey,
                        warpToKey,
                        type: target.type,
                        captures
                    });
                }
            }
        }
        return moves;
    }

    static getCaptures(state, target, player) {
        const captures = [];
        const neighbors = HexMath.getNeighbors(target);
        const board = state.board;

        for (let i = 0; i < 6; i++) {
            const n = neighbors[i];
            const key = HexMath.key(n.q, n.r);
            const owner = board[key];
            if (owner && owner !== player && owner !== 'obstacle') {
                captures.push(key);
            }
        }
        return captures;
    }

    static applyMove(state, move, player) {
        const nextBoard = { ...state.board };

        if (move.type === 'jump') {
            delete nextBoard[move.fromKey];
        }

        const landingKey = move.warpToKey || move.toKey;
        nextBoard[landingKey] = player;

        const caps = move.captures;
        for (let i = 0; i < caps.length; i++) {
            nextBoard[caps[i]] = player;
        }

        return {
            ...state,
            board: nextBoard,
            cellSet: state.cellSet
        };
    }

    /**
     * Strategic Board Evaluation with edge control, material differential, and cluster cohesion
     */
    static evaluate(state, maximizingPlayer, opponent, isHard = false) {
        const board = state.board;
        let myScore = 0;
        let oppScore = 0;
        let myCount = 0;
        let oppCount = 0;

        for (const key in board) {
            const owner = board[key];
            if (owner === 'obstacle') continue;

            const commaIdx = key.indexOf(',');
            const q = parseInt(key.substring(0, commaIdx), 10);
            const r = parseInt(key.substring(commaIdx + 1), 10);
            const s = -q - r;
            const distCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));

            // Edge / Perimeter safety: outer hexes are less exposed to multi-side surround
            const edgeBonus = distCenter >= 3 ? 2.5 : (distCenter >= 2 ? 1.2 : 0.4);

            if (owner === maximizingPlayer) {
                myCount++;
                myScore += 10.0 + edgeBonus;
            } else if (owner === opponent) {
                oppCount++;
                oppScore += 10.0 + edgeBonus;
            }
        }

        if (oppCount === 0 && myCount > 0) return 99999;
        if (myCount === 0 && oppCount > 0) return -99999;

        // Hard difficulty adds cluster cohesion (adjacent friendly units protect each other)
        if (isHard) {
            let myClusters = 0;
            let oppClusters = 0;
            for (const key in board) {
                const owner = board[key];
                if (owner === 'obstacle') continue;
                const pos = HexMath.parseKey(key);
                const neighbors = HexMath.getNeighbors(pos);
                for (let i = 0; i < 6; i++) {
                    const nKey = HexMath.key(neighbors[i].q, neighbors[i].r);
                    if (board[nKey] === owner) {
                        if (owner === maximizingPlayer) myClusters += 0.35;
                        else if (owner === opponent) oppClusters += 0.35;
                    }
                }
            }
            myScore += myClusters;
            oppScore += oppClusters;
        }

        return myScore - oppScore;
    }

    static minimax(state, depth, alpha, beta, isMaximizing, player, opponent, allPlayers, beamWidth = 10, isHard = false) {
        const activePlayer = isMaximizing ? player : opponent;
        const moves = HexxagonAI.getLegalMoves(state, activePlayer);

        if (depth === 0 || moves.length === 0) {
            return {
                score: HexxagonAI.evaluate(state, player, opponent, isHard),
                move: null
            };
        }

        // Heuristic Move Ordering: evaluate clones and high captures first
        moves.sort((a, b) => {
            const valA = (a.type === 'clone' ? 3 : 0) + a.captures.length * 5;
            const valB = (b.type === 'clone' ? 3 : 0) + b.captures.length * 5;
            return valB - valA;
        });

        // Tactical Beam Pruning
        const candidateMoves = (moves.length > beamWidth) ? moves.slice(0, beamWidth) : moves;

        if (isMaximizing) {
            let maxEval = -Infinity;
            let bestMove = candidateMoves[0];

            for (let i = 0; i < candidateMoves.length; i++) {
                const move = candidateMoves[i];
                const nextState = HexxagonAI.applyMove(state, move, player);
                const evaluation = HexxagonAI.minimax(nextState, depth - 1, alpha, beta, false, player, opponent, allPlayers, beamWidth, isHard).score;

                if (evaluation > maxEval) {
                    maxEval = evaluation;
                    bestMove = move;
                }
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break;
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            let bestMove = candidateMoves[0];

            for (let i = 0; i < candidateMoves.length; i++) {
                const move = candidateMoves[i];
                const nextState = HexxagonAI.applyMove(state, move, opponent);
                const evaluation = HexxagonAI.minimax(nextState, depth - 1, alpha, beta, true, player, opponent, allPlayers, beamWidth, isHard).score;

                if (evaluation < minEval) {
                    minEval = evaluation;
                    bestMove = move;
                }
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break;
            }
            return { score: minEval, move: bestMove };
        }
    }

    async getBestMove(state, player, allPlayers) {
        // Ensure cellSet is cached
        if (!state.cellSet) {
            state.cellSet = new Set(state.cells);
        }

        const moves = HexxagonAI.getLegalMoves(state, player);
        if (moves.length === 0) return null;

        const opponent = allPlayers.find(p => p !== player) || 'ruby';

        // Non-blocking natural micro-delay for realistic pacing and arcade feel
        await new Promise(resolve => setTimeout(resolve, 160 + Math.random() * 70));

        // -------------------------------------------------------------
        // EASY DIFFICULTY: Fun, Engaging & Approachable
        // 1-ply tactical heuristic. Active territory expansion and captures
        // with soft stochastic choice among top moves (no random blunders).
        // -------------------------------------------------------------
        if (this.difficulty === 'easy') {
            const scoredMoves = moves.map(move => {
                let score = 0;
                // Clone bonus (+3.0) keeps pieces on board
                if (move.type === 'clone') score += 3.0;
                // Capture reward (+4.5 each)
                score += move.captures.length * 4.5;

                // Outer perimeter preference (+1.0)
                const q = move.to.q;
                const r = move.to.r;
                const s = -q - r;
                const distCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
                if (distCenter >= 3) score += 1.0;

                // Penalize jumping into empty space with no captures
                if (move.type === 'jump' && move.captures.length === 0) {
                    score -= 1.8;
                }

                // Natural human variance
                score += (Math.random() * 0.9);

                return { move, score };
            });

            scoredMoves.sort((a, b) => b.score - a.score);

            // Weighted distribution: 65% #1 best move, 25% #2 move, 10% #3 move
            const roll = Math.random();
            if (roll < 0.65 || scoredMoves.length === 1) {
                return scoredMoves[0].move;
            } else if (roll < 0.90 || scoredMoves.length === 2) {
                return scoredMoves[1].move;
            } else {
                return scoredMoves[2].move;
            }
        }

        // -------------------------------------------------------------
        // MEDIUM DIFFICULTY: Dynamic, Engaging & Balanced Flow-State
        // 2-ply Minimax Lookahead (1 full round). Avoids 1-turn counter-traps,
        // values defensive edges and steady piece cloning.
        // -------------------------------------------------------------
        if (this.difficulty === 'medium') {
            const result = HexxagonAI.minimax(state, 2, -Infinity, Infinity, true, player, opponent, allPlayers, 10, false);
            return result.move || moves[0];
        }

        // -------------------------------------------------------------
        // HARD / MASTER DIFFICULTY: Strategic, Assertive & Rewarding
        // 2-ply Minimax with Cluster Cohesion & Dominant Edge Control.
        // Formidable tactical gameplay without punishing 3-ply lockouts.
        // -------------------------------------------------------------
        const result = HexxagonAI.minimax(state, 2, -Infinity, Infinity, true, player, opponent, allPlayers, 14, true);
        return result.move || moves[0];
    }
}

