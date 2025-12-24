export type RoleName =
  | 'werewolf'
  | 'seer'
  | 'robber'
  | 'troublemaker'
  | 'tanner'
  | 'villager'
  | 'insomniac';

export type Team = 'werewolf' | 'village' | 'tanner';

export interface RoleDefinition {
  name: RoleName;
  team: Team;
  wakeOrder: number | null; // null = doesn't wake, lower = earlier
  description: string;
}

export interface Player {
  id: string;
  name: string;
  originalRole: RoleName;
  currentRole: RoleName; // Can change due to Robber/Troublemaker
  nightKnowledge: string[]; // What they learned at night
}

export interface CenterCards {
  left: RoleName;
  middle: RoleName;
  right: RoleName;
}

export type GamePhase = 'setup' | 'night' | 'day' | 'voting' | 'end';

export interface NightAction {
  playerId: string;
  role: RoleName;
  action: string;
  result: string;
}

export interface DayMessage {
  playerId: string;
  playerName: string;
  message: string;
  round: number;
}

export interface Vote {
  voterId: string;
  targetId: string;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  players: Player[];
  centerCards: CenterCards;
  nightActions: NightAction[];
  dayMessages: DayMessage[];
  votes: Vote[];
  eliminatedPlayerId: string | null;
  winners: Team[];
  currentRound: number;
  maxRounds: number;
}