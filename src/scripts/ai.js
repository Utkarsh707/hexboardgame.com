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

    static getLegalMoves(state, player) {
        const moves = [];
        const { board, cells } = state;
        const validCells = new Set(cells);

        for (const [key, pieceOwner] of Object.entries(board)) {
            if (pieceOwner !== player) continue;
            const from = HexMath.parseKey(key);

            const reachables = HexMath.getReachableHexes(from, 2);
            for (let i = 0; i < reachables.length; i++) {
                const target = reachables[i];
                const targetKey = HexMath.key(target.q, target.r);

                if (validCells.has(targetKey) && !board[targetKey]) {
                    const captures = HexxagonAI.getCaptures(state, target, player);
                    moves.push({
                        from,
                        to: target,
                        fromKey: key,
                        toKey: targetKey,
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

        for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            const key = HexMath.key(neighbor.q, neighbor.r);
            const owner = state.board[key];
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
        nextBoard[move.toKey] = player;

        for (let i = 0; i < move.captures.length; i++) {
            nextBoard[move.captures[i]] = player;
        }

        return {
            ...state,
            board: nextBoard
        };
    }

    /**
     * Ultra-fast Static Board Evaluation O(N)
     */
    static evaluate(state, maximizingPlayer, opponent) {
        const board = state.board;
        let myScore = 0;
        let oppScore = 0;

        for (const [key, owner] of Object.entries(board)) {
            if (owner === 'obstacle') continue;
            const pos = HexMath.parseKey(key);
            const distCenter = Math.max(Math.abs(pos.q), Math.abs(pos.r), Math.abs(pos.s));
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

    static minimax(state, depth, alpha, beta, isMaximizing, player, opponent, allPlayers) {
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

        // Beam Search Pruning for deeper plies to maintain 60 FPS
        const candidateMoves = (moves.length > 14 && depth > 1) ? moves.slice(0, 14) : moves;

        if (isMaximizing) {
            let maxEval = -Infinity;
            let bestMove = candidateMoves[0];

            for (let i = 0; i < candidateMoves.length; i++) {
                const move = candidateMoves[i];
                const nextState = HexxagonAI.applyMove(state, move, player);
                const evaluation = HexxagonAI.minimax(nextState, depth - 1, alpha, beta, false, player, opponent, allPlayers).score;

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
                const evaluation = HexxagonAI.minimax(nextState, depth - 1, alpha, beta, true, player, opponent, allPlayers).score;

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
        const moves = HexxagonAI.getLegalMoves(state, player);
        if (moves.length === 0) return null;

        const opponent = allPlayers.find(p => p !== player) || 'ruby';

        // Non-blocking micro-delay
        await new Promise(resolve => setTimeout(resolve, 240 + Math.random() * 100));

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

        if (this.difficulty === 'medium') {
            const result = HexxagonAI.minimax(state, 2, -Infinity, Infinity, true, player, opponent, allPlayers);
            return result.move || moves[0];
        }

        // Master AI: Fast 3-ply lookahead with tactical beam pruning
        const emptyCount = state.cells.length - Object.keys(state.board).length;
        const depth = (moves.length <= 10 || emptyCount <= 8) ? 4 : 3;
        const result = HexxagonAI.minimax(state, depth, -Infinity, Infinity, true, player, opponent, allPlayers);
        return result.move || moves[0];
    }
}
