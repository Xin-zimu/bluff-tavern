export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const MIN_NICKNAME_LENGTH = 1;
export const MAX_NICKNAME_LENGTH = 16;
export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;
export const CARDS_PER_RANK_BY_PLAYER_COUNT = [
  { maxPlayers: 4, copiesPerRank: 6, jokers: 2 },
  { maxPlayers: 6, copiesPerRank: 9, jokers: 3 },
  { maxPlayers: 8, copiesPerRank: 12, jokers: 4 },
] as const;
export const MAX_CARDS_PER_PLAY = 3;
