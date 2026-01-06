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
