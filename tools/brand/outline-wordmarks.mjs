import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Optional source-authoring step. Ordinary exports use the committed outlines.
// CANVAS_PACKAGE may point to a local @napi-rs/canvas package.json.
const require = createRequire(process.env.CANVAS_PACKAGE ? resolve(process.env.CANVAS_PACKAGE) : import.meta.url);
const { GlobalFonts, createCanvas, SvgExportFlag } = require('@napi-rs/canvas');
const root = resolve(import.meta.dirname, '../..');
const data = {};
for (const [lang, alias, file, text] of [
  ['fa', 'BrandPersian', 'Vazirmatn-wght.woff2', 'ترب‌تیکت'],
  ['en', 'BrandEnglish', 'InterVariable.woff2', 'TorobTicket'],
]) {
  if (!GlobalFonts.register(readFileSync(resolve(root, 'assets/fonts', file)), alias)) throw Error(`Cannot load ${file}`);
  const canvas = createCanvas(900, 160, SvgExportFlag.ConvertTextToPaths);
  const ctx = canvas.getContext('2d');
  ctx.font = `800 100px ${alias}`;
  // HarfBuzz handles the Persian run. Left anchoring avoids canvas RTL metric
  // offset bugs without changing the run's actual right-to-left glyph shaping.
  ctx.direction = 'ltr'; ctx.textAlign = 'left';
  const metrics = ctx.measureText(text);
  ctx.fillText(text, 10, 115);
  const paths = [...canvas.getContent().toString().matchAll(/<path\s+([^>]+)\/?\s*>/g)].map(match => ({
    d: match[1].match(/\bd="([^"]*)"/)[1],
    transform: match[1].match(/\btransform="([^"]*)"/)?.[1],
  }));
  data[lang] = { text, font: file, weight: 800, viewBox: [10 - metrics.actualBoundingBoxLeft, 115 - metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent], paths };
}
writeFileSync(resolve(root, 'libs/ui/src/brand/wordmarks.json'), JSON.stringify(data) + '\n');
