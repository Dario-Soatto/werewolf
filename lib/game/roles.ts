import { RoleDefinition, RoleName } from './types';

export const ROLE_DEFINITIONS: Record<RoleName, RoleDefinition> = {
  werewolf: {
    name: 'werewolf',
    team: 'werewolf',
    wakeOrder: 1,
    description:
      'You are a Werewolf. At night, all Werewolves open their eyes and look for other werewolves. If no one else opens their eyes, the other Werewolves are in the center. Werewolves are on the werewolf team. Lone Wolf Option: If there is only one Werewolf, the Werewolf may view one center card. This is extremely beneficial to a Werewolf who doesn\'t have a partner, and provides him with a useful tool for deceiving the rest of the players.',
  },
  seer: {
    name: 'seer',
    team: 'village',
    wakeOrder: 2,
    description:
      "You are the Seer. At night, the Seer may look either at one other player's card or at two of the center cards, but does not move them. The Seer is on the village team.",
  },
  robber: {
    name: 'robber',
    team: 'village',
    wakeOrder: 3,
    description:
      'You are the Robber. At night, the Robber may choose to rob a card from another player and place his Robber card where the other card was. Then the Robber looks at his new card. The player who receives the Robber card is on the village team. The Robber is on the team ofthe card he takes, however, he does not do the action of his new role at night.',
  },
  troublemaker: {
    name: 'troublemaker',
    team: 'village',
    wakeOrder: 4,
    description:
      "You are the Troublemaker. t night, the Troublemaker may switch the cards of two other players without looking at those cards. The players who receive a different card are now the role (and team) of their new card, even though they don't know what role that is until the end of the game. The Troublemaker is on the village team.",
  },
  insomniac: {
    name: 'insomniac',
    team: 'village',
    wakeOrder: 5,
    description:
      'You are the Insomniac. The Insomniac wakes up and looks at her card (to see if it has changed). The Insomniac is on the village team.',
  },
  villager: {
    name: 'villager',
    team: 'village',
    wakeOrder: null,
    description:
      'You are a Villager. The Villager has no special abilities, but he is definitely not a werewolf. Players may often claim to be a Villager. The Villager is on the village team.',
  },
  tanner: {
    name: 'tanner',
    team: 'tanner',
    wakeOrder: null,
    description:
      'You are the Tanner. The Tanner hates his job so much that he wants to die. The Tanner only wins if he dies. If the Tanner dies and no Werewolves die, the Werewolves do not win. If the Tanner dies and a Werewolf also dies, the village team wins too. The Tanner is considered a member of the village (but is not on their team), so ifthe Tanner dies when all werewolves are in the center, the village team loses. The Tanneris not on the werewolfor the villager team.',
  },
};

// The 8 roles in this game
export const GAME_ROLES: RoleName[] = [
  'werewolf',
  'werewolf',
  'seer',
  'robber',
  'troublemaker',
  'tanner',
  'villager',
  'insomniac',
];

export function getRoleDefinition(role: RoleName): RoleDefinition {
  return ROLE_DEFINITIONS[role];
}

export function getWakeOrder(): RoleName[] {
  return Object.values(ROLE_DEFINITIONS)
    .filter((r) => r.wakeOrder !== null)
    .sort((a, b) => a.wakeOrder! - b.wakeOrder!)
    .map((r) => r.name);
}