import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'apps/web/src/styles.css'), 'utf8');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ruleBody(selector: string) {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

describe('reveal card CSS transform safety', () => {
  it('keeps flipped and front-locked reveal cards on their front face', () => {
    expect(ruleBody('.reveal-card.is-flipped')).toContain('rotateY(180deg)');
    expect(ruleBody('.reveal-card.is-front-locked')).toContain('rotateY(180deg)');
  });

  it('does not animate or transform settled bluff cards', () => {
    const body = ruleBody('.reveal-cards.is-settled .reveal-card.is-bluff');

    expect(body).toContain('filter:');
    expect(body).not.toMatch(/\banimation(?:-[\w-]+)?\s*:/);
    expect(body).not.toMatch(/\btransform\s*:/);
  });

  it('keeps verdict shake on the verdict text instead of reveal cards', () => {
    expect(ruleBody('.verdict--bluff h2')).toMatch(/\banimation:\s*verdict-shake\b/);

    const revealCardAnimatedRules = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
      .filter((match) => {
        const selector = match[1] ?? '';
        const body = match[2] ?? '';
        const animationValue = body.match(/\banimation\s*:\s*([^;]+)/)?.[1]?.trim();
        return selector.includes('.reveal-card') && animationValue !== undefined && !animationValue.startsWith('none');
      })
      .map((match) => (match[1] ?? '').trim());

    expect(revealCardAnimatedRules).toEqual([]);
  });
});
