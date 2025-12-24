import {
    GameState,
    Player,
    RoleName,
    CenterCards,
    NightAction,
    DayMessage,
    Vote,
  } from './types';
  import { GAME_ROLES } from './roles';
  
  function generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
  
  function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  const PLAYER_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
  
  export function createGame(maxRounds: number = 3): GameState {
    const shuffledRoles = shuffle(GAME_ROLES);
  
    // 5 players get 5 roles, 3 go to center
    const playerRoles = shuffledRoles.slice(0, 5);
    const centerRoles = shuffledRoles.slice(5);
  
    const players: Player[] = playerRoles.map((role, index) => ({
      id: generateId(),
      name: PLAYER_NAMES[index],
      originalRole: role,
      currentRole: role,
      nightKnowledge: [],
    }));
  
    const centerCards: CenterCards = {
      left: centerRoles[0],
      middle: centerRoles[1],
      right: centerRoles[2],
    };
  
    return {
      id: generateId(),
      phase: 'setup',
      players,
      centerCards,
      nightActions: [],
      dayMessages: [],
      votes: [],
      eliminatedPlayerId: null,
      winners: [],
      currentRound: 0,
      maxRounds,
    };
  }
  
  export function getPlayerById(state: GameState, playerId: string): Player | undefined {
    return state.players.find((p) => p.id === playerId);
  }
  
  export function getPlayerByName(state: GameState, name: string): Player | undefined {
    return state.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  }
  
  export function getOtherPlayers(state: GameState, playerId: string): Player[] {
    return state.players.filter((p) => p.id !== playerId);
  }
  
  export function getWerewolves(state: GameState): Player[] {
    return state.players.filter((p) => p.originalRole === 'werewolf');
  }
  
  // Night action executors
  export function executeWerewolfNight(
    state: GameState,
    playerId: string
  ): { state: GameState; result: string } {
    const werewolves = getWerewolves(state);
    const player = getPlayerById(state, playerId)!;
  
    let result: string;
  
    if (werewolves.length === 1) {
      // Lone wolf can look at a center card
      result = `You are the only Werewolf. The left center card is ${state.centerCards.left}.`;
    } else {
      const otherWerewolf = werewolves.find((w) => w.id !== playerId)!;
      result = `The other Werewolf is ${otherWerewolf.name}.`;
    }
  
    const action: NightAction = {
      playerId,
      role: 'werewolf',
      action: 'Looked for other werewolves',
      result,
    };
  
    const updatedPlayer = { ...player, nightKnowledge: [...player.nightKnowledge, result] };
  
    return {
      state: {
        ...state,
        players: state.players.map((p) => (p.id === playerId ? updatedPlayer : p)),
        nightActions: [...state.nightActions, action],
      },
      result,
    };
  }
  
  export function executeSeerNight(
    state: GameState,
    playerId: string,
    choice:
      | { type: 'player'; targetId: string }
      | { type: 'center'; positions: ('left' | 'middle' | 'right')[] }
  ): { state: GameState; result: string } {
    const player = getPlayerById(state, playerId)!;
    let result: string;
  
    if (choice.type === 'player') {
      const target = getPlayerById(state, choice.targetId)!;
      result = `${target.name}'s card is ${target.currentRole}.`;
    } else {
      const cards = choice.positions.map((pos) => `${pos}: ${state.centerCards[pos]}`);
      result = `Center cards - ${cards.join(', ')}.`;
    }
  
    const action: NightAction = {
      playerId,
      role: 'seer',
      action:
        choice.type === 'player'
          ? `Looked at ${getPlayerById(state, choice.targetId)!.name}'s card`
          : 'Looked at center cards',
      result,
    };
  
    const updatedPlayer = { ...player, nightKnowledge: [...player.nightKnowledge, result] };
  
    return {
      state: {
        ...state,
        players: state.players.map((p) => (p.id === playerId ? updatedPlayer : p)),
        nightActions: [...state.nightActions, action],
      },
      result,
    };
  }
  
  export function executeRobberNight(
    state: GameState,
    playerId: string,
    targetId: string
  ): { state: GameState; result: string } {
    const player = getPlayerById(state, playerId)!;
    const target = getPlayerById(state, targetId)!;
  
    // Swap roles
    const newRole = target.currentRole;
    const result = `You swapped cards with ${target.name} and are now the ${newRole}.`;
  
    const action: NightAction = {
      playerId,
      role: 'robber',
      action: `Swapped with ${target.name}`,
      result,
    };
  
    const updatedPlayers = state.players.map((p) => {
      if (p.id === playerId) {
        return { ...p, currentRole: newRole, nightKnowledge: [...p.nightKnowledge, result] };
      }
      if (p.id === targetId) {
        return { ...p, currentRole: 'robber' as RoleName };
      }
      return p;
    });
  
    return {
      state: {
        ...state,
        players: updatedPlayers,
        nightActions: [...state.nightActions, action],
      },
      result,
    };
  }
  
  export function executeTroublemakerNight(
    state: GameState,
    playerId: string,
    targetId1: string,
    targetId2: string
  ): { state: GameState; result: string } {
    const player = getPlayerById(state, playerId)!;
    const target1 = getPlayerById(state, targetId1)!;
    const target2 = getPlayerById(state, targetId2)!;
  
    const result = `You swapped ${target1.name}'s and ${target2.name}'s cards.`;
  
    const action: NightAction = {
      playerId,
      role: 'troublemaker',
      action: `Swapped ${target1.name} and ${target2.name}`,
      result,
    };
  
    // Store roles before swap
    const role1 = target1.currentRole;
    const role2 = target2.currentRole;
  
    const updatedPlayers = state.players.map((p) => {
      if (p.id === playerId) {
        return { ...p, nightKnowledge: [...p.nightKnowledge, result] };
      }
      if (p.id === targetId1) {
        return { ...p, currentRole: role2 };
      }
      if (p.id === targetId2) {
        return { ...p, currentRole: role1 };
      }
      return p;
    });
  
    return {
      state: {
        ...state,
        players: updatedPlayers,
        nightActions: [...state.nightActions, action],
      },
      result,
    };
  }
  
  export function executeInsomniacNight(
    state: GameState,
    playerId: string
  ): { state: GameState; result: string } {
    const player = getPlayerById(state, playerId)!;
  
    const result =
      player.currentRole === player.originalRole
        ? `Your card is still ${player.currentRole}.`
        : `Your card is now ${player.currentRole}!`;
  
    const action: NightAction = {
      playerId,
      role: 'insomniac',
      action: 'Looked at own card',
      result,
    };
  
    const updatedPlayer = { ...player, nightKnowledge: [...player.nightKnowledge, result] };
  
    return {
      state: {
        ...state,
        players: state.players.map((p) => (p.id === playerId ? updatedPlayer : p)),
        nightActions: [...state.nightActions, action],
      },
      result,
    };
  }
  
  export function addDayMessage(
    state: GameState,
    playerId: string,
    message: string
  ): GameState {
    const player = getPlayerById(state, playerId)!;
    const dayMessage: DayMessage = {
      playerId,
      playerName: player.name,
      message,
      round: state.currentRound,
    };
  
    return {
      ...state,
      dayMessages: [...state.dayMessages, dayMessage],
    };
  }
  
  export function addVote(state: GameState, voterId: string, targetId: string): GameState {
    const vote: Vote = { voterId, targetId };
    return {
      ...state,
      votes: [...state.votes, vote],
    };
  }
  
  export function resolveVotes(state: GameState): GameState {
    const voteCounts = new Map<string, number>();
  
    for (const vote of state.votes) {
      voteCounts.set(vote.targetId, (voteCounts.get(vote.targetId) || 0) + 1);
    }
  
    // Find max votes
    let maxVotes = 0;
    let eliminated: string[] = [];
  
    for (const [playerId, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = [playerId];
      } else if (count === maxVotes) {
        eliminated.push(playerId);
      }
    }
  
    // If everyone has 1 vote (all tied), no one dies
    // Otherwise the player(s) with most votes die
    // For simplicity, if there's a tie at the top, we pick the first one
    const eliminatedPlayerId =
      eliminated.length === state.players.length ? null : eliminated[0] || null;
  
    return {
      ...state,
      eliminatedPlayerId,
      phase: 'end',
    };
  }
  
  export function determineWinners(state: GameState): GameState {
    const eliminatedPlayer = state.eliminatedPlayerId
      ? getPlayerById(state, state.eliminatedPlayerId)
      : null;
  
    // Check if Tanner was eliminated - Tanner wins alone
    if (eliminatedPlayer?.currentRole === 'tanner') {
      return { ...state, winners: ['tanner'] };
    }
  
    // Check if a Werewolf was eliminated
    const werewolfEliminated = eliminatedPlayer?.currentRole === 'werewolf';
  
    // Find if any werewolves are among players (by current role)
    const werewolvesInGame = state.players.filter((p) => p.currentRole === 'werewolf');
  
    if (werewolvesInGame.length === 0) {
      // No werewolves among players - village wins only if no one died
      if (!eliminatedPlayer) {
        return { ...state, winners: ['village'] };
      } else {
        // Village killed a villager when no werewolves existed
        return { ...state, winners: ['werewolf'] };
      }
    } else {
      // Werewolves exist among players
      if (werewolfEliminated) {
        return { ...state, winners: ['village'] };
      } else {
        return { ...state, winners: ['werewolf'] };
      }
    }
  }
  
  export function setPhase(state: GameState, phase: GameState['phase']): GameState {
    return { ...state, phase };
  }
  
  export function advanceRound(state: GameState): GameState {
    return { ...state, currentRound: state.currentRound + 1 };
  }