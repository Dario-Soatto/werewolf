import { GameState, Player } from '../game/types';
import { getRoleDefinition } from '../game/roles';

const ALL_ROLES_EXPLANATION = `
ROLES IN THIS GAME (8 cards total: 5 dealt to players, 3 in center):

WEREWOLF TEAM:
• Werewolf (x2): Werewolves wake at night and see each other. If you're the only werewolf among players, you may look at one center card. Your goal is to avoid being eliminated.

VILLAGE TEAM:
• Seer: At night, look at one player's card OR two center cards. Use this information to find werewolves.
• Robber: At night, swap your card with another player's card, then look at your new card. You become whatever role you stole and are now on THAT team.
• Troublemaker: At night, swap two OTHER players' cards without looking. Those players are now swapped roles (but don't know it).
• Villager: No night action. Listen carefully during the day to find werewolves.
• Insomniac: Wakes at the END of night to look at your own card, seeing if it changed.

SOLO:
• Tanner: You WANT to die. You only win if YOU are eliminated. You're not on any team.

CENTER CARDS:
Three cards are placed in the center and not dealt to any player. This means:
- Some roles might not be in play (both Werewolves could be in the center!)
- The Seer can look at center cards to see what's NOT in players' hands
- If no Werewolves are among players, the village must vote to eliminate NO ONE to win
`;

const ROLE_SWAP_RULES = `
CRITICAL - ROLE SWAPPING:
Your card (role) may be swapped during the night by the Robber or Troublemaker WITHOUT your knowledge.
- The Robber swaps their card with yours and sees their new role
- The Troublemaker swaps two other players' cards blindly
- If your card was swapped, you are NOW the new role on your card
- Your winning team is determined by the card in front of you at game end, NOT what you started as
- You do NOT know if your card was swapped unless you are the Insomniac (who checks at end of night)
- The Robber knows their new role, but not if it was later swapped by Troublemaker
`;

export function buildSystemPrompt(player: Player, state: GameState): string {
  const role = getRoleDefinition(player.originalRole);
  const otherPlayerNames = state.players
    .filter((p) => p.id !== player.id)
    .map((p) => p.name)
    .join(', ');

  return `You are playing One Night Ultimate Werewolf as ${player.name}.

YOUR STARTING ROLE: ${role.name.toUpperCase()}
${role.description}

OTHER PLAYERS: ${otherPlayerNames}
${ALL_ROLES_EXPLANATION}
GAME FLOW:
1. NIGHT: Roles wake in order (Werewolves → Seer → Robber → Troublemaker → Insomniac) and perform actions
2. DAY: Everyone discusses, tries to figure out who the werewolves are (or were swapped into being werewolves)
3. VOTE: Everyone simultaneously votes to eliminate one player
4. RESOLUTION: The eliminated player reveals their FINAL card (which may differ from starting role)

WIN CONDITIONS:
- Village team wins if at least one Werewolf (by current card) is eliminated
- Werewolf team wins if no Werewolf is eliminated
- If NO werewolves are among the 5 players (both in center), village must eliminate NO ONE to win
- Tanner wins ONLY if the Tanner (by current card) is eliminated - this is a solo victory

IMPORTANT:
- Stay in character as ${player.name}
- Be conversational and natural
- You may do anything: lie, bluff, or tell the truth strategically
- Pay attention to contradictions in what others claim
- Keep responses concise (2-3 sentences for discussion)`;
}

export function buildNightActionPrompt(
  player: Player,
  state: GameState
): { prompt: string; schema: object } | null {
  const otherPlayers = state.players.filter((p) => p.id !== player.id);
  const playerNames = otherPlayers.map((p) => p.name);

  switch (player.originalRole) {
    case 'seer':
      return {
        prompt: `It is night. As the Seer, you may either:
1. Look at ONE other player's card
2. Look at TWO center cards

Other players: ${playerNames.join(', ')}
Center positions: left, middle, right

What do you choose?`,
        schema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['look_at_player', 'look_at_center'],
            },
            target_player: {
              type: ['string', 'null'],
              description: 'Player name if looking at a player, null otherwise',
            },
            center_cards: {
              type: ['array', 'null'],
              items: { type: 'string', enum: ['left', 'middle', 'right'] },
              description: 'Two center positions if looking at center, null otherwise',
            },
          },
          required: ['action', 'target_player', 'center_cards'],
          additionalProperties: false,
        },
      };

    case 'robber':
      return {
        prompt: `It is night. As the Robber, you MUST exchange your card with another player's card and see your new role.

Other players: ${playerNames.join(', ')}

Who do you want to rob?`,
        schema: {
          type: 'object',
          properties: {
            target_player: { type: 'string' },
          },
          required: ['target_player'],
          additionalProperties: false,
        },
      };

    case 'troublemaker':
      return {
        prompt: `It is night. As the Troublemaker, you may exchange the cards of two OTHER players (not yourself). You won't see what the cards are.

Other players: ${playerNames.join(', ')}

Which two players do you want to swap? (Pick two different players)`,
        schema: {
          type: 'object',
          properties: {
            player1: { type: 'string' },
            player2: { type: 'string' },
          },
          required: ['player1', 'player2'],
          additionalProperties: false,
        },
      };

    default:
      return null; // Werewolf, Insomniac, Villager, Tanner don't make choices
  }
}

export function buildDayDiscussionPrompt(
  player: Player,
  state: GameState,
  round: number
): string {
  const previousMessages = state.dayMessages
    .map((m) => `${m.playerName}: "${m.message}"`)
    .join('\n');

  const knowledgeSection =
    player.nightKnowledge.length > 0
      ? `\nWHAT YOU LEARNED AT NIGHT:\n${player.nightKnowledge.join('\n')}`
      : '\nYou did not learn anything specific during the night.';

  // Determine what the player knows about their current state
  let roleStateSection: string;
  if (player.originalRole === 'insomniac') {
    // Insomniac knows their current role from checking at end of night
    // The nightKnowledge will contain this info
    roleStateSection = `\nYOUR ROLE STATUS: You are the Insomniac. You checked your card at the end of the night (see what you learned above).`;
  } else if (player.originalRole === 'robber') {
    // Robber knows they swapped but Troublemaker may have swapped them after
    roleStateSection = `\nYOUR ROLE STATUS: You started as the Robber and swapped cards (see what you learned above). However, the Troublemaker acts AFTER you - if they swapped your card with someone else's, you wouldn't know. Your card might not be what you think it is.`;
  } else {
    roleStateSection = `\nYOUR ROLE STATUS: You started as the ${player.originalRole}. You do NOT know if your card was swapped by the Robber or Troublemaker during the night. Your actual card right now might be different from what you started with!`;
  }
  
  const swapReminder = `
REMEMBER: Win/lose is based on the card in front of you NOW, not your starting role. If you were swapped to Werewolf, you're on the Werewolf team even if you don't know it.`;

  return `Day phase - Round ${round} of ${state.maxRounds}. Time to discuss and find the werewolves!
${knowledgeSection}
${roleStateSection}
${swapReminder}

${previousMessages ? `DISCUSSION SO FAR:\n${previousMessages}\n` : 'No one has spoken yet. You are speaking first.'}

What do you say? Be strategic. You can do anything, including but not limited to:
- Claim a role (truthfully or as a bluff)
- Share information you learned (real or fake)
- Accuse someone of being a werewolf
- Defend yourself
- Ask questions to find contradictions

Respond with just your statement (1-3 sentences).`;
}

export function buildVotingPrompt(
  player: Player,
  state: GameState
): { prompt: string; schema: object } {
  const otherPlayers = state.players.filter((p) => p.id !== player.id);
  const playerNames = otherPlayers.map((p) => p.name);

  const discussionSummary = state.dayMessages
    .map((m) => `${m.playerName}: "${m.message}"`)
    .join('\n');

  const knowledgeSection =
    player.nightKnowledge.length > 0
      ? `\nWHAT YOU KNOW FROM NIGHT:\n${player.nightKnowledge.join('\n')}`
      : '';

  // Build role uncertainty reminder
  let roleReminder: string;
  if (player.originalRole === 'insomniac') {
    roleReminder = `You are the Insomniac and checked your card at the end of the night - you know your current role.`;
  } else if (player.originalRole === 'robber') {
    roleReminder = `You started as Robber and know what you robbed, BUT the Troublemaker acts after you. Your card may have been swapped again without your knowledge.`;
  } else if (player.originalRole === 'tanner') {
    roleReminder = `You started as Tanner. If you're still Tanner, you WIN by being eliminated. But if someone swapped your card, you might be something else now and shouldn't want to die!`;
  } else if (player.originalRole === 'werewolf') {
    roleReminder = `You started as Werewolf. Your card may have been swapped - if the Robber took your Werewolf card, THEY are now the Werewolf and you want them eliminated! Vote strategically based on what you heard.`;
  } else {
    roleReminder = `You started as ${player.originalRole}. Your card may have been swapped by Robber or Troublemaker. You might be a Werewolf now without knowing it!`;
  }

  return {
    prompt: `Time to vote! You must vote for one player to eliminate.
${knowledgeSection}

ROLE UNCERTAINTY: ${roleReminder}

WINNING REMINDER:
- If you are currently a Werewolf (by card), you want NO werewolf eliminated
- If you are currently a Villager/Seer/etc (by card), you want a Werewolf eliminated  
- If you are currently Tanner (by card), you want to be eliminated yourself
- If no Werewolves are among players (both in center), village should eliminate no one - but you can't vote for "no one", so vote for who you think is most suspicious

DISCUSSION RECAP:
${discussionSummary || '(No discussion occurred)'}

Players you can vote for: ${playerNames.join(', ')}

Based on the discussion and what you know, who do you vote to eliminate?`,
    schema: {
      type: 'object',
      properties: {
        vote: { type: 'string', description: 'Name of the player you vote for' },
        reasoning: { type: 'string', description: 'Brief private reasoning (not shared with others)' },
      },
      required: ['vote', 'reasoning'],
      additionalProperties: false,
    },
  };
}
