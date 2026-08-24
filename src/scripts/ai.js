/**
 * Hexxagon Artificial Intelligence Engine
 * Minimax with Alpha-Beta Pruning, Mobility Heuristics, and Multiple Difficulties
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
            for (const target of reachables) {
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

        for (const neighbor of neighbors) {
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

        for (const captureKey of move.captures) {
            nextBoard[captureKey] = player;
        }

        return {
            ...state,
            board: nextBoard
        };
    }

    static evaluate(state, maximizingPlayer, allPlayers) {
        const { board, cells } = state;
        let myScore = 0;
        let oppScore = 0;

        const opponent = allPlayers.find(p => p !== maximizingPlayer);

        for (const key of cells) {
            const owner = board[key];
            if (!owner) continue;

            const pos = HexMath.parseKey(key);
            const distCenter = Math.max(Math.abs(pos.q), Math.abs(pos.r), Math.abs(pos.s));
            const stabilityWeight = distCenter >= 3 ? 1.4 : 1.0;

            if (owner === maximizingPlayer) {
                myScore += 10 * stabilityWeight;
            } else {
                oppScore += 10 * stabilityWeight;
            }
        }

        const myMoves = HexxagonAI.getLegalMoves(state, maximizingPlayer).length;
        const oppMoves = opponent ? HexxagonAI.getLegalMoves(state, opponent).length : 0;
        const myMobility = myMoves * 0.5;
        const oppMobility = oppMoves * 0.5;

        if (oppScore === 0 && myScore > 0) return 99999;
        if (myScore === 0 && oppScore > 0) return -99999;

        return (myScore - oppScore) + (myMobility - oppMobility);
    }

    static minimax(state, depth, alpha, beta, isMaximizing, player, opponent, allPlayers) {
        const moves = HexxagonAI.getLegalMoves(state, isMaximizing ? player : opponent);

        if (depth === 0 || moves.length === 0) {
            return {
                score: HexxagonAI.evaluate(state, player, allPlayers),
                move: null
            };
        }

        moves.sort((a, b) => {
            const valA = (a.type === 'clone' ? 1 : 0) + a.captures.length * 2;
            const valB = (b.type === 'clone' ? 1 : 0) + b.captures.length * 2;
            return valB - valA;
        });

        if (isMaximizing) {
            let maxEval = -Infinity;
            let bestMove = moves[0];

            for (const move of moves) {
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
            let bestMove = moves[0];

            for (const move of moves) {
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

        // Natural thinking delay
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 250));

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

        // Master AI: 3-4 ply lookahead
        const emptyCount = state.cells.length - Object.keys(state.board).length;
        const depth = (moves.length < 15 || emptyCount < 12) ? 4 : 3;
        const result = HexxagonAI.minimax(state, depth, -Infinity, Infinity, true, player, opponent, allPlayers);
        return result.move || moves[0];
    }
}
