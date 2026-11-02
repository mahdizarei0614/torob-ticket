import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandMetadata } from './vite-brand-metadata.mts';

const template = '<head><meta name="theme-color" content="" data-brand-theme-color/><link rel="mask-icon" href="/safari-pinned-tab.svg"/></head>';
test('build metadata uses semantic colors, leaves no empty theme color and omits unknown deployment URLs', () => {
  const previous = process.env.TOROBTICKET_PUBLIC_ORIGIN;
  delete process.env.TOROBTICKET_PUBLIC_ORIGIN;
  try {
    const result = brandMetadata().transformIndexHtml(template);
    assert.match(result, /data-light-color="#[\da-f]{6}" data-dark-color="#[\da-f]{6}"/);
    assert(!result.includes('content=""'));
    assert(!result.includes('property="og:image"'));
    assert(!result.includes('property="og:url"'));
    assert.match(result, /og:title/);
  } finally { if (previous === undefined) delete process.env.TOROBTICKET_PUBLIC_ORIGIN; else process.env.TOROBTICKET_PUBLIC_ORIGIN = previous; }
});
test('a configured production origin produces escaped absolute social/card URLs, with no admin advertising metadata', () => {
  const previous = process.env.TOROBTICKET_PUBLIC_ORIGIN;
  process.env.TOROBTICKET_PUBLIC_ORIGIN = 'https://release.example';
  try {
    const result = brandMetadata().transformIndexHtml(template);
    assert.match(result, /property="og:image" content="https:\/\/release\.example\/brand\/social-light\.png"/);
    assert.match(result, /name="twitter:image" content="https:\/\/release\.example\/brand\/social-light\.png"/);
    assert(!brandMetadata(true).transformIndexHtml(template).includes('og:image'));
    for (const origin of ['https://user:secret@release.example', 'https://release.example/path', 'javascript:alert(1)', 'https://release.example/?q=bad']) {
      process.env.TOROBTICKET_PUBLIC_ORIGIN = origin;
      assert.throws(() => brandMetadata().transformIndexHtml(template));
    }
  } finally { if (previous === undefined) delete process.env.TOROBTICKET_PUBLIC_ORIGIN; else process.env.TOROBTICKET_PUBLIC_ORIGIN = previous; }
});
