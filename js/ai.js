/**
 * Hexxagon Artificial Intelligence Engine
 * Features Minimax with Alpha-Beta Pruning, positional heuristics, and multiple difficulty levels.
 */

import { HexMath } from './hex-math.js';

export class HexxagonAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty; // 'easy', 'medium', 'master'
    }

    setDifficulty(diff) {
        this.difficulty = diff;
    }

    /**
     * Compute all legal moves for a given player in the current state
     */
    static getLegalMoves(state, player) {
        const moves = [];
        const { board, cells } = state;
        const validCells = new Set(cells);

        // Find all pieces belonging to player
        for (const [key, pieceOwner] of Object.entries(board)) {
            if (pieceOwner !== player) continue;
            const from = HexMath.parseKey(key);

            // Check all hexes in distance 1 and 2
            const reachables = HexMath.getReachableHexes(from, 2);
            for (const target of reachables) {
                const targetKey = HexMath.key(target.q, target.r);

                // Cell must exist on board and must be empty (not occupied, not obstacle)
                if (validCells.has(targetKey) && !board[targetKey]) {
                    // Calculate potential captures
                    const captures = HexxagonAI.getCaptures(state, target, player);
                    moves.push({
                        from,
                        to: target,
                        fromKey: key,
                        toKey: targetKey,
                        type: target.type, // 'clone' or 'jump'
                        captures
                    });
                }
            }
        }
        return moves;
    }

    /**
     * Get list of enemy keys that will be converted if player lands at target
     */
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

    /**
     * Apply move to create a new state
     */
    static applyMove(state, move, player) {
        const nextBoard = { ...state.board };

        if (move.type === 'jump') {
            delete nextBoard[move.fromKey];
        }
        nextBoard[move.toKey] = player;

        // Convert neighbors
        for (const captureKey of move.captures) {
            nextBoard[captureKey] = player;
        }

        return {
            ...state,
            board: nextBoard
        };
    }

    /**
     * Heuristic evaluation function for a player
     */
    static evaluate(state, maximizingPlayer, allPlayers) {
        const { board, cells } = state;
        let myScore = 0;
        let oppScore = 0;
        let myMobility = 0;
        let oppMobility = 0;

        const opponent = allPlayers.find(p => p !== maximizingPlayer);

        for (const key of cells) {
            const owner = board[key];
            if (!owner) continue;

            const pos = HexMath.parseKey(key);
            const distCenter = Math.max(Math.abs(pos.q), Math.abs(pos.r), Math.abs(pos.s));

            // Edge stability bonus (edges are harder to surround)
            const stabilityWeight = distCenter >= 3 ? 1.4 : 1.0;

            if (owner === maximizingPlayer) {
                myScore += 10 * stabilityWeight;
            } else {
                oppScore += 10 * stabilityWeight;
            }
        }

        // Mobility bonus (approximate based on adjacent spaces)
        const myMoves = HexxagonAI.getLegalMoves(state, maximizingPlayer).length;
        const oppMoves = opponent ? HexxagonAI.getLegalMoves(state, opponent).length : 0;
        myMobility = myMoves * 0.5;
        oppMobility = oppMoves * 0.5;

        // If opponent is wiped out, huge win
        if (oppScore === 0 && myScore > 0) return 99999;
        if (myScore === 0 && oppScore > 0) return -99999;

        return (myScore - oppScore) + (myMobility - oppMobility);
    }

    /**
     * Minimax with Alpha-Beta Pruning
     */
    static minimax(state, depth, alpha, beta, isMaximizing, player, opponent, allPlayers) {
        const moves = HexxagonAI.getLegalMoves(state, isMaximizing ? player : opponent);

        // Terminal state or depth limit
        if (depth === 0 || moves.length === 0) {
            return {
                score: HexxagonAI.evaluate(state, player, allPlayers),
                move: null
            };
        }

        // Sort moves: Prioritize clones with high captures first for better alpha-beta cutoffs
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
                if (beta <= alpha) break; // Beta cut-off
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
                if (beta <= alpha) break; // Alpha cut-off
            }
            return { score: minEval, move: bestMove };
        }
    }

    /**
     * Decide the best move according to the configured difficulty
     */
    async getBestMove(state, player, allPlayers) {
        const moves = HexxagonAI.getLegalMoves(state, player);
        if (moves.length === 0) return null;

        const opponent = allPlayers.find(p => p !== player) || 'ruby';

        // Add a slight thinking delay for realism
        await new Promise(resolve => setTimeout(resolve, 350 + Math.random() * 250));

        if (this.difficulty === 'easy') {
            // Easy AI: 70% greedy best immediate score with 30% randomness
            if (Math.random() < 0.35) {
                return moves[Math.floor(Math.random() * moves.length)];
            }
            // Evaluate 1-ply immediate value
            moves.sort((a, b) => {
                const scoreA = (a.type === 'clone' ? 1 : 0) + a.captures.length * 2 + (Math.random() * 0.8);
                const scoreB = (b.type === 'clone' ? 1 : 0) + b.captures.length * 2 + (Math.random() * 0.8);
                return scoreB - scoreA;
            });
            return moves[0];
        }

        if (this.difficulty === 'medium') {
            // Medium AI: 2-ply search
            const result = HexxagonAI.minimax(state, 2, -Infinity, Infinity, true, player, opponent, allPlayers);
            return result.move || moves[0];
        }

        // Master AI: 3-ply search (or 4-ply if few moves remain)
        const emptyCount = state.cells.length - Object.keys(state.board).length;
        const depth = (moves.length < 15 || emptyCount < 12) ? 4 : 3;
        const result = HexxagonAI.minimax(state, depth, -Infinity, Infinity, true, player, opponent, allPlayers);
        return result.move || moves[0];
    }
}
