/**
 * Hexxagon High-Performance Artificial Intelligence Engine
 * Optimized Alpha-Beta Minimax with Tactical Beam Pruning & Fast Evaluation
 */

import { HexMath } from './hex-math.js';

export class HexxagonAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty; // 'easy', 'medium', 'master'
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
     * Ultra-fast Static Board Evaluation with edge control and mobility weighting
     */
    static evaluate(state, maximizingPlayer, opponent) {
        const board = state.board;
        let myScore = 0;
        let oppScore = 0;

        for (const key in board) {
            const owner = board[key];
            if (owner === 'obstacle') continue;

            const commaIdx = key.indexOf(',');
            const q = parseInt(key.substring(0, commaIdx), 10);
            const r = parseInt(key.substring(commaIdx + 1), 10);
            const s = -q - r;
            const distCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
            const weight = distCenter >= 3 ? 14 : 10;

            if (owner === maximizingPlayer) {
                myScore += weight;
            } else if (owner === opponent) {
                oppScore += weight;
            }
        }

        if (oppScore === 0 && myScore > 0) return 99999;
        if (myScore === 0 && oppScore > 0) return -99999;

        return myScore - oppScore;
    }

    static minimax(state, depth, alpha, beta, isMaximizing, player, opponent, allPlayers, beamWidth = 10) {
        const moves = HexxagonAI.getLegalMoves(state, isMaximizing ? player : opponent);

        if (depth === 0 || moves.length === 0) {
            return {
                score: HexxagonAI.evaluate(state, player, opponent),
                move: null
            };
        }

        // Heuristic Move Ordering: evaluate captures & clones first
        moves.sort((a, b) => {
            const valA = (a.type === 'clone' ? 3 : 0) + a.captures.length * 6;
            const valB = (b.type === 'clone' ? 3 : 0) + b.captures.length * 6;
            return valB - valA;
        });

        // Beam Search Pruning: evaluate top N candidate moves per ply
        const candidateMoves = (moves.length > beamWidth) ? moves.slice(0, beamWidth) : moves;

        if (isMaximizing) {
            let maxEval = -Infinity;
            let bestMove = candidateMoves[0];

            for (let i = 0; i < candidateMoves.length; i++) {
                const move = candidateMoves[i];
                const nextState = HexxagonAI.applyMove(state, move, player);
                const evaluation = HexxagonAI.minimax(nextState, depth - 1, alpha, beta, false, player, opponent, allPlayers, beamWidth).score;

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
                const evaluation = HexxagonAI.minimax(nextState, depth - 1, alpha, beta, true, player, opponent, allPlayers, beamWidth).score;

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

        // Non-blocking natural micro-delay for realistic pacing
        await new Promise(resolve => setTimeout(resolve, 180 + Math.random() * 60));

        // -------------------------------------------------------------
        // EASY DIFFICULTY: Casual / Beginner
        // 1-ply greedy heuristic with 35% blunder/randomness rate
        // -------------------------------------------------------------
        if (this.difficulty === 'easy') {
            if (Math.random() < 0.35) {
                return moves[Math.floor(Math.random() * moves.length)];
            }
            moves.sort((a, b) => {
                const scoreA = (a.type === 'clone' ? 1 : 0) + a.captures.length * 2 + (Math.random() * 0.8);
                const scoreB = (b.type === 'clone' ? 1 : 0) + b.captures.length * 2 + (Math.random() * 0.8);
                return scoreB - scoreA;
            });
            return moves[0];
        }

        // -------------------------------------------------------------
        // MEDIUM DIFFICULTY: Balanced & Fun
        // Smart 1-ply tactical evaluation with positional weighting
        // and human-like choice variance (doesn't ruthlessly lookahead 2 turns)
        // -------------------------------------------------------------
        if (this.difficulty === 'medium') {
            const scoredMoves = moves.map(move => {
                let score = 0;
                // Clone bonus (keeps pieces on board)
                if (move.type === 'clone') score += 3.5;
                // Capture value
                score += move.captures.length * 6.0;

                // Positional edge preference (defense)
                const q = move.to.q;
                const r = move.to.r;
                const s = -q - r;
                const distCenter = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
                if (distCenter >= 3) score += 1.5;

                // Penalize empty jumps that capture nothing
                if (move.type === 'jump' && move.captures.length === 0) {
                    score -= 2.5;
                }

                // Add small human-like variance
                score += (Math.random() * 0.9);

                return { move, score };
            });

            scoredMoves.sort((a, b) => b.score - a.score);

            // 85% pick top move, 15% pick 2nd best move if available
            if (scoredMoves.length > 1 && Math.random() < 0.15) {
                return scoredMoves[1].move;
            }
            return scoredMoves[0].move;
        }

        // -------------------------------------------------------------
        // HARD / MASTER DIFFICULTY: Ruthless & Tactical
        // Deep Depth-3 Minimax search with Alpha-Beta pruning
        // -------------------------------------------------------------
        const result = HexxagonAI.minimax(state, 3, -Infinity, Infinity, true, player, opponent, allPlayers, 10);
        return result.move || moves[0];
    }
}

