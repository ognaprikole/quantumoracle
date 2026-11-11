
export type Direction = 'UP' | 'DOWN' | 'FLAT';

export interface Player {
  userId: string;
  angle: number; // от -90 до +90
  betAmount: number;
  direction: Direction;
}

export interface CandleResult {
  open: number;
  close: number;
  high: number;
  low: number;
  winningDirection: Direction;
  totalPlayers: number;
  correctVotes: number;
}

export interface Bet {
  userId: string;
  direction: Direction;
  amount: number;
}

const MAX_ANGLE = 90;
const VOLATILITY = 0.05;
const BASE_MULTIPLIER = 1.8;
const RISK_BONUS_CAP = 0.4;

export function calculateMarketMove(players: Player[], lastClosePrice: number): CandleResult {
  if (players.length === 0) {
    return {
      open: lastClosePrice, close: lastClosePrice,
      high: lastClosePrice, low: lastClosePrice,
      winningDirection: 'FLAT', totalPlayers: 0, correctVotes: 0
    };
  }

  let totalAngle = 0;
  let upVotes = 0;
  let downVotes = 0;

  for (const player of players) {
    totalAngle += player.angle;
    if (player.angle > 5) upVotes++;
    else if (player.angle < -5) downVotes++;
  }

  const avgAngle = totalAngle / players.length;
  const directionFactor = avgAngle / MAX_ANGLE;
  
  const open = lastClosePrice;
  const change = open * VOLATILITY * directionFactor;
  const close = open + change;
  
  const winningDirection: Direction = close > open ? 'UP' : 'DOWN';
  const correctVotes = winningDirection === 'UP' ? upVotes : downVotes;

  return {
    open,
    close,
    high: Math.max(open, close),
    low: Math.min(open, close),
    winningDirection,
    totalPlayers: players.length,
    correctVotes
  };
}

export function calculatePayout(bet: Bet, candleResult: CandleResult): number {
  if (bet.direction !== candleResult.winningDirection) {
    return 0;
  }

  if (candleResult.totalPlayers === 0) return bet.amount;

  const winRate = candleResult.correctVotes / candleResult.totalPlayers;
  const multiplier = BASE_MULTIPLIER + (1.0 - winRate) * RISK_BONUS_CAP;

  return bet.amount * multiplier;
}