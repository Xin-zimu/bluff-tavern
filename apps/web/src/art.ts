import type { CharacterAbilityId, CharacterId, ItemId } from '@bluff-tavern/shared';

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
  SPYGLASS: '望远镜',
  SWAP_GLOVE: '换牌手套',
  WAX_SEAL: '封口蜡印',
  TAVERN_MUG: '酒杯',
  POCKET_WATCH: '旧怀表',
};

export const CHARACTER_ABILITIES: Record<CharacterId, { id: CharacterAbilityId; title: string; description: string }> = {
  WOLF: { id: 'WOLF_TABLE_READ', title: '牌桌嗅觉', description: '每轮自己的第一次回合获得公开局势和手牌目标数提示。' },
  FOX: { id: 'FOX_HAND_HINT', title: '花言', description: '本局第一次自己的回合获得一次低风险出牌建议。' },
  BEAR: { id: 'BEAR_OPENING_NERVE', title: '稳坐', description: '作为本轮先手时，自己的开局回合小幅延长。' },
  RABBIT: { id: 'RABBIT_QUICK_STEP', title: '抢秒', description: '本局第一次自己的回合小幅延长。' },
  CAT: { id: 'CAT_NIGHT_EYE', title: '夜眼', description: '每轮开始时获得下一次自己受罚的高低风险提示。' },
  RACCOON: { id: 'RACCOON_POCKET_FIND', title: '摸袋', description: '若同时启用道具，开局额外摸到一件低风险道具。' },
  FROG: { id: 'FROG_STEADY_BREATH', title: '沉息', description: '本局第一次被迫质疑时额外获得思考时间。' },
  PANDA: { id: 'PANDA_REVEAL_MEMORY', title: '记牌', description: '每次揭牌结论时获得本次已公开牌面的记牌摘要。' },
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
