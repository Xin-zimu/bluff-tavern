import type { CharacterId, ItemId } from '@bluff-tavern/shared';

export const CHARACTER_IDS: CharacterId[] = ['WOLF', 'FOX', 'BEAR', 'RABBIT', 'CAT', 'RACCOON', 'FROG', 'PANDA'];

export const CHARACTER_ART: Record<CharacterId, { name: string; image: string }> = {
  WOLF: { name: '灰狼', image: '/assets/characters/wolf/idle.png' },
  FOX: { name: '赤狐', image: '/assets/characters/fox/idle.png' },
  BEAR: { name: '棕熊', image: '/assets/characters/bear/idle.png' },
  RABBIT: { name: '白兔', image: '/assets/characters/rabbit/idle.png' },
  CAT: { name: '黑猫', image: '/assets/characters/cat/idle.png' },
  RACCOON: { name: '浣熊', image: '/assets/characters/raccoon/idle.png' },
  FROG: { name: '青蛙', image: '/assets/characters/frog/idle.png' },
  PANDA: { name: '熊猫', image: '/assets/characters/panda/idle.png' },
};

export type CharacterMood = 'idle' | 'suspicious' | 'bluff' | 'shocked' | 'laugh' | 'nervous' | 'eliminated' | 'victory';

const COMPLETE_EXPRESSION_SETS = new Set<CharacterId>([
  'WOLF',
  'FOX',
  'RABBIT',
  'BEAR',
  'CAT',
  'FROG',
  'PANDA',
  'RACCOON',
]);

export function characterImage(character: CharacterId, mood: CharacterMood = 'idle') {
  if (mood === 'idle' || !COMPLETE_EXPRESSION_SETS.has(character)) return CHARACTER_ART[character].image;
  return `/assets/characters/${character.toLowerCase()}/${mood}.png`;
}

export const ITEM_NAMES: Record<ItemId, string> = {
  SPYGLASS: '窥牌镜',
  SWAP_GLOVE: '换牌手套',
  WAX_SEAL: '封口蜡印',
  TAVERN_MUG: '酒馆木杯',
  POCKET_WATCH: '旧怀表',
};

export const ITEM_ART: Record<ItemId, string> = {
  SPYGLASS: '/assets/items/spyglass.png',
  SWAP_GLOVE: '/assets/items/swap_glove.png',
  WAX_SEAL: '/assets/items/wax_seal.png',
  TAVERN_MUG: '/assets/items/wooden_mug.png',
  POCKET_WATCH: '/assets/items/pocket_watch.png',
};

export const CINEMATIC_ART = {
  revolver: '/assets/cinematics/revolver_side_v1.png',
  muzzleFlashSmoke: '/assets/cinematics/muzzle_flash_smoke_v1.png',
} as const;
