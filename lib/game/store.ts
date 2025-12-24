import { GameState } from './types';
import { RoleName } from './types';

// Step types for tracking game progress
export type StepType =
  | { kind: 'setup' }
  | { kind: 'night_start' }
  | { kind: 'night_action'; role: RoleName; playerIndex: number }
  | { kind: 'day_start' }
  | { kind: 'day_round_start'; round: number }
  | { kind: 'day_discussion'; round: number; playerIndex: number }
  | { kind: 'voting_start' }
  | { kind: 'vote'; playerIndex: number }
  | { kind: 'resolution' }
  | { kind: 'game_end' };

export interface GameSession {
  state: GameState;
  stepIndex: number;
  steps: StepType[];
  completed: boolean;
}

// Use global to persist across hot reloads in development
const globalForGames = globalThis as unknown as {
  games: Map<string, GameSession> | undefined;
};

// In-memory store for game sessions - persists across hot reloads
const games = globalForGames.games ?? new Map<string, GameSession>();

if (process.env.NODE_ENV !== 'production') {
  globalForGames.games = games;
}

export function getGame(gameId: string): GameSession | undefined {
  return games.get(gameId);
}

export function setGame(gameId: string, session: GameSession): void {
  games.set(gameId, session);
}

export function deleteGame(gameId: string): void {
  games.delete(gameId);
}

export function updateGameState(gameId: string, state: GameState): void {
  const session = games.get(gameId);
  if (session) {
    session.state = state;
  }
}

export function advanceStep(gameId: string): void {
  const session = games.get(gameId);
  if (session) {
    session.stepIndex++;
    if (session.stepIndex >= session.steps.length) {
      session.completed = true;
    }
  }
}

export function getCurrentStep(gameId: string): StepType | null {
  const session = games.get(gameId);
  if (!session || session.stepIndex >= session.steps.length) {
    return null;
  }
  return session.steps[session.stepIndex];
}

