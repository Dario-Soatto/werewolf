import { GameState } from './types';
import {
  createGame,
  getPlayerById,
  getPlayerByName,
  executeWerewolfNight,
  executeSeerNight,
  executeRobberNight,
  executeTroublemakerNight,
  executeInsomniacNight,
  addDayMessage,
  addVote,
  resolveVotes,
  determineWinners,
  setPhase,
  advanceRound,
} from './engine';
import { getWakeOrder } from './roles';
import { queryLLM, queryLLMStructured } from '../llm/client';
import {
  buildSystemPrompt,
  buildNightActionPrompt,
  buildDayDiscussionPrompt,
  buildVotingPrompt,
} from '../llm/prompts';
import { GameSession, StepType, setGame, advanceStep, updateGameState } from './store';

export interface StepResult {
  event: {
    type: string;
    data: Record<string, unknown>;
  };
  completed: boolean;
  nextStepDescription: string | null;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Build the full list of steps for a game
function buildSteps(state: GameState): StepType[] {
  const steps: StepType[] = [];
  
  // Setup
  steps.push({ kind: 'setup' });
  
  // Night phase
  steps.push({ kind: 'night_start' });
  
  const wakeOrder = getWakeOrder();
  for (const role of wakeOrder) {
    const playersWithRole = state.players.filter((p) => p.originalRole === role);
    for (let i = 0; i < playersWithRole.length; i++) {
      const playerIndex = state.players.findIndex((p) => p.id === playersWithRole[i].id);
      steps.push({ kind: 'night_action', role, playerIndex });
    }
  }
  
  // Day phase
  steps.push({ kind: 'day_start' });
  
  for (let round = 1; round <= state.maxRounds; round++) {
    steps.push({ kind: 'day_round_start', round });
    for (let playerIndex = 0; playerIndex < state.players.length; playerIndex++) {
      steps.push({ kind: 'day_discussion', round, playerIndex });
    }
  }
  
  // Voting phase
  steps.push({ kind: 'voting_start' });
  for (let playerIndex = 0; playerIndex < state.players.length; playerIndex++) {
    steps.push({ kind: 'vote', playerIndex });
  }
  
  // Resolution
  steps.push({ kind: 'resolution' });
  steps.push({ kind: 'game_end' });
  
  return steps;
}

// Create a new game and return the game ID
export function initializeGame(maxRounds: number = 3): { gameId: string; session: GameSession } {
  const state = createGame(maxRounds);
  const gameId = generateId();
  const steps = buildSteps(state);
  
  const session: GameSession = {
    state,
    stepIndex: 0,
    steps,
    completed: false,
  };
  
  setGame(gameId, session);
  
  return { gameId, session };
}

// Get description of what the next step will do
function getStepDescription(step: StepType, state: GameState): string {
  switch (step.kind) {
    case 'setup':
      return 'Show game setup';
    case 'night_start':
      return 'Begin night phase';
    case 'night_action': {
      const player = state.players[step.playerIndex];
      return `${player.name} (${step.role}) performs night action`;
    }
    case 'day_start':
      return 'Begin day phase';
    case 'day_round_start':
      return `Start discussion round ${step.round}`;
    case 'day_discussion': {
      const player = state.players[step.playerIndex];
      return `${player.name} speaks`;
    }
    case 'voting_start':
      return 'Begin voting phase';
    case 'vote': {
      const player = state.players[step.playerIndex];
      return `${player.name} votes`;
    }
    case 'resolution':
      return 'Resolve votes and determine outcome';
    case 'game_end':
      return 'Show final results';
  }
}

// Execute a single step and return the result
export async function executeStep(gameId: string, session: GameSession): Promise<StepResult> {
  const step = session.steps[session.stepIndex];
  let state = session.state;
  
  let event: StepResult['event'];
  
  switch (step.kind) {
    case 'setup': {
      event = {
        type: 'setup',
        data: {
          players: state.players.map((p) => ({
            name: p.name,
            originalRole: p.originalRole,
          })),
          centerCards: state.centerCards,
        },
      };
      break;
    }
    
    case 'night_start': {
      state = setPhase(state, 'night');
      updateGameState(gameId, state);
      event = {
        type: 'phase_change',
        data: { phase: 'night' },
      };
      break;
    }
    
    case 'night_action': {
      const player = state.players[step.playerIndex];
      const result = await executeNightActionForPlayer(state, player);
      
      if (result) {
        state = result.state;
        updateGameState(gameId, state);
        event = {
          type: 'night_action',
          data: {
            player: player.name,
            role: step.role,
            result: result.result,
            systemPrompt: result.systemPrompt,
            userPrompt: result.userPrompt,
            llmResponse: result.llmResponse,
            reasoning: result.reasoning,
          },
        };
      } else {
        // No action taken (shouldn't happen with our roles)
        event = {
          type: 'night_action',
          data: {
            player: player.name,
            role: step.role,
            result: 'No action taken',
          },
        };
      }
      break;
    }
    
    case 'day_start': {
      state = setPhase(state, 'day');
      updateGameState(gameId, state);
      event = {
        type: 'phase_change',
        data: { phase: 'day' },
      };
      break;
    }
    
    case 'day_round_start': {
      state = advanceRound(state);
      updateGameState(gameId, state);
      event = {
        type: 'phase_change',
        data: { phase: 'day', round: step.round },
      };
      break;
    }
    
    case 'day_discussion': {
      const player = state.players[step.playerIndex];
      const systemPrompt = buildSystemPrompt(player, state);
      const userPrompt = buildDayDiscussionPrompt(player, state, step.round);
      
      const response = await queryLLM(systemPrompt, userPrompt);
      state = addDayMessage(state, player.id, response.content);
      updateGameState(gameId, state);
      
      event = {
        type: 'day_message',
        data: {
          player: player.name,
          message: response.content,
          round: step.round,
          systemPrompt,
          userPrompt,
          llmResponse: response.content,
          reasoning: response.reasoning,
        },
      };
      break;
    }
    
    case 'voting_start': {
      state = setPhase(state, 'voting');
      updateGameState(gameId, state);
      event = {
        type: 'phase_change',
        data: { phase: 'voting' },
      };
      break;
    }
    
    case 'vote': {
      const player = state.players[step.playerIndex];
      const systemPrompt = buildSystemPrompt(player, state);
      const { prompt: userPrompt, schema } = buildVotingPrompt(player, state);
      
      const response = await queryLLMStructured<{ vote: string }>(
        systemPrompt,
        userPrompt,
        schema as Record<string, unknown>
      );
      
      const target = getPlayerByName(state, response.vote);
      if (target && target.id !== player.id) {
        state = addVote(state, player.id, target.id);
        updateGameState(gameId, state);
      }
      
      event = {
        type: 'vote',
        data: {
          voter: player.name,
          target: target?.name || response.vote,
          systemPrompt,
          userPrompt,
          llmResponse: JSON.stringify({ vote: response.vote }),
          reasoning: response._reasoning,
        },
      };
      break;
    }
    
    case 'resolution': {
      state = resolveVotes(state);
      state = determineWinners(state);
      updateGameState(gameId, state);
      
      const eliminatedPlayer = state.eliminatedPlayerId
        ? getPlayerById(state, state.eliminatedPlayerId)
        : null;
      
      event = {
        type: 'resolution',
        data: {
          eliminated: eliminatedPlayer?.name || 'No one',
          eliminatedRole: eliminatedPlayer?.currentRole,
          votes: state.votes.map((v) => ({
            voter: getPlayerById(state, v.voterId)?.name,
            target: getPlayerById(state, v.targetId)?.name,
          })),
        },
      };
      break;
    }
    
    case 'game_end': {
      event = {
        type: 'game_end',
        data: {
          winners: state.winners,
          finalRoles: state.players.map((p) => ({
            name: p.name,
            originalRole: p.originalRole,
            currentRole: p.currentRole,
          })),
          centerCards: state.centerCards,
        },
      };
      break;
    }
  }
  
  // Advance to next step
  advanceStep(gameId);
  
  // Get next step description
  const nextStepIndex = session.stepIndex + 1;
  const completed = nextStepIndex >= session.steps.length;
  const nextStepDescription = completed
    ? null
    : getStepDescription(session.steps[nextStepIndex], state);
  
  return {
    event,
    completed,
    nextStepDescription,
  };
}

// Execute night action for a specific player
async function executeNightActionForPlayer(
  state: GameState,
  player: GameState['players'][0]
): Promise<{
  state: GameState;
  result: string;
  systemPrompt?: string;
  userPrompt?: string;
  llmResponse?: string;
  reasoning?: string;
} | null> {
  switch (player.originalRole) {
    case 'werewolf': {
      const result = executeWerewolfNight(state, player.id);
      return {
        ...result,
        // No LLM for werewolf
      };
    }

    case 'seer': {
      const promptData = buildNightActionPrompt(player, state);
      if (!promptData) return null;

      const systemPrompt = buildSystemPrompt(player, state);
      const response = await queryLLMStructured<{
        action: 'look_at_player' | 'look_at_center';
        target_player: string | null;
        center_cards: ('left' | 'middle' | 'right')[] | null;
      }>(systemPrompt, promptData.prompt, promptData.schema as Record<string, unknown>);

      let result: { state: GameState; result: string } | null = null;

      if (response.action === 'look_at_player' && response.target_player) {
        const target = getPlayerByName(state, response.target_player);
        if (target) {
          result = executeSeerNight(state, player.id, { type: 'player', targetId: target.id });
        }
      } else if (response.action === 'look_at_center' && response.center_cards) {
        result = executeSeerNight(state, player.id, {
          type: 'center',
          positions: response.center_cards.slice(0, 2),
        });
      }

      if (result) {
        return {
          ...result,
          systemPrompt,
          userPrompt: promptData.prompt,
          llmResponse: JSON.stringify({ action: response.action, target_player: response.target_player, center_cards: response.center_cards }),
          reasoning: response._reasoning,
        };
      }
      return null;
    }

    case 'robber': {
      const promptData = buildNightActionPrompt(player, state);
      if (!promptData) return null;

      const systemPrompt = buildSystemPrompt(player, state);
      const response = await queryLLMStructured<{ target_player: string }>(
        systemPrompt,
        promptData.prompt,
        promptData.schema as Record<string, unknown>
      );

      const target = getPlayerByName(state, response.target_player);
      if (target) {
        const result = executeRobberNight(state, player.id, target.id);
        return {
          ...result,
          systemPrompt,
          userPrompt: promptData.prompt,
          llmResponse: JSON.stringify({ target_player: response.target_player }),
          reasoning: response._reasoning,
        };
      }
      return null;
    }

    case 'troublemaker': {
      const promptData = buildNightActionPrompt(player, state);
      if (!promptData) return null;

      const systemPrompt = buildSystemPrompt(player, state);
      const response = await queryLLMStructured<{ player1: string; player2: string }>(
        systemPrompt,
        promptData.prompt,
        promptData.schema as Record<string, unknown>
      );

      const target1 = getPlayerByName(state, response.player1);
      const target2 = getPlayerByName(state, response.player2);
      if (target1 && target2 && target1.id !== target2.id) {
        const result = executeTroublemakerNight(state, player.id, target1.id, target2.id);
        return {
          ...result,
          systemPrompt,
          userPrompt: promptData.prompt,
          llmResponse: JSON.stringify({ player1: response.player1, player2: response.player2 }),
          reasoning: response._reasoning,
        };
      }
      return null;
    }

    case 'insomniac': {
      const result = executeInsomniacNight(state, player.id);
      return {
        ...result,
        // No LLM for insomniac
      };
    }

    default:
      return null;
  }
}
