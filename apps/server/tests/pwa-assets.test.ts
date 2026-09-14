import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const webPublic = new URL('../../web/public/', import.meta.url);

describe('V1.5 PWA assets', () => {
  it('declares a standalone manifest, original icon, and cache worker', async () => {
    const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', webPublic), 'utf8')) as { display: string; icons: Array<{ src: string }> };
    const worker = await readFile(new URL('sw.js', webPublic), 'utf8');
    const icon = await readFile(new URL('icons/app-icon.svg', webPublic), 'utf8');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons[0]?.src).toBe('/icons/app-icon.svg');
    expect(worker).toContain("caches.open(CACHE)");
    expect(worker).toContain('bluff-tavern-v7.0-final-core1');
    expect(worker).toContain("event.request.mode === 'navigate'");
    expect(worker).toContain("url.pathname.startsWith('/socket.io')");
    expect(icon).toContain('<svg');
  });
});
