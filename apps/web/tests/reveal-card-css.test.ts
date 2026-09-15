import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'apps/web/src/styles.css'), 'utf8');
const removedSealClass = ['verdict', 'seal'].join('__');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ruleBody(selector: string) {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

describe('reveal card CSS transform safety', () => {
  it('keeps flipped reveal cards on their front face during REVEAL', () => {
    expect(ruleBody('.reveal-card.is-flipped')).toContain('rotateY(180deg)');
  });

  it('keeps the animated reveal card body focused only on 3D flipping', () => {
    const body = ruleBody('.reveal-card');

    expect(body).toContain('transform-style: preserve-3d');
    expect(body).toMatch(/\btransition:\s*transform\b/);
    expect(body).not.toMatch(/\bfilter\s*:/);
    expect(body).not.toMatch(/\banimation(?:-[\w-]+)?\s*:/);
  });

  it('does not style settled reveal card bodies with filter, transform, or animation', () => {
    const settledRevealCardRules = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
      .filter((match) => (match[1] ?? '').includes('.reveal-cards.is-settled .reveal-card'))
      .map((match) => ({
        selector: (match[1] ?? '').trim(),
        body: match[2] ?? '',
      }));

    expect(settledRevealCardRules).toEqual([]);

    for (const rule of settledRevealCardRules) {
      expect(rule.body, rule.selector).not.toMatch(/\bfilter\s*:/);
      expect(rule.body, rule.selector).not.toMatch(/\btransform\s*:/);
      expect(rule.body, rule.selector).not.toMatch(/\banimation(?:-[\w-]+)?\s*:/);
    }
  });

  it('keeps settled visual emphasis on the front pseudo-element only', () => {
    const honestBody = ruleBody('.reveal-card.is-honest.is-flipped .reveal-card__front::after');
    const bluffBody = ruleBody('.reveal-card.is-bluff.is-flipped .reveal-card__front::after');

    expect(honestBody).toContain('box-shadow:');
    expect(bluffBody).toContain('box-shadow:');
    expect(honestBody).not.toMatch(/\btransform\s*:/);
    expect(bluffBody).not.toMatch(/\btransform\s*:/);
    expect(honestBody).not.toMatch(/\banimation(?:-[\w-]+)?\s*:/);
    expect(bluffBody).not.toMatch(/\banimation(?:-[\w-]+)?\s*:/);
  });

  it('does not animate or transform settled bluff cards', () => {
    const body = ruleBody('.reveal-card.is-bluff.is-flipped .reveal-card__front::after');

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

  it('renders post-REVEAL public cards as static face-up cards', () => {
    const body = ruleBody('.static-reveal-card');

    expect(body).toContain('animation: none');
    expect(body).not.toMatch(/\btransform\s*:/);
    expect(body).not.toContain('rotateY');
    expect(css).not.toContain(`.${removedSealClass}`);
  });
});
