import { readFileSync, writeFileSync } from 'node:fs';

// The pinned source stays intact; the study exposes profiles and noise strength.
const html = readFileSync(new URL('../reference/shan-shui-original.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
export const original = [scripts[0], ...scripts.slice(2, 6)].join('\n').split('  document.addEventListener("mousemove"')[0];
let source = original;
const start = source.indexOf('    this.mountain = function');
const end = source.indexOf('    this.flatMount = function', start);
let mountain = source.slice(start, end);
function replaceOnce(before, after) {
  if (mountain.split(before).length !== 2) throw new Error(`Upstream marker changed: ${before}`);
  mountain = mountain.replace(before, after);
}
replaceOnce('var canv = "";', 'var canv = \'<g data-part="detail">\';');
replaceOnce('var h = hei;', 'var noiseAmount = args.noiseAmount === undefined ? 1 : args.noiseAmount;\n      var h = hei;');
replaceOnce('y *= Noise.noise(x + 10, j * 0.15, seed);', 'y *= (1 - noiseAmount) + noiseAmount * Noise.noise(x + 10, j * 0.15, seed);');
replaceOnce('-y * h * p + hoff,', '-y * h * p + hoff * noiseAmount,');
replaceOnce('function vegetate(treeFunc, growthRule, proofRule)', 'if (args.capture) args.capture(ptlist);\n\n      function vegetate(treeFunc, growthRule, proofRule)');
replaceOnce('//WHITE BG', 'canv += \'</g><g data-part="body">\';\n      //WHITE BG');
replaceOnce('//OUTLINE', 'canv += \'</g><g data-part="ridge">\';\n      //OUTLINE');
replaceOnce('canv += foot(ptlist', 'canv += \'</g><g data-part="ink">\';\n      canv += foot(ptlist');
replaceOnce('//TOP\n', 'canv += \'</g><g data-part="detail">\';\n      //TOP\n');
replaceOnce('if (ret == 0) {', 'canv += "</g>";\n      if (ret == 0) {');
source = source.slice(0, start) + mountain + source.slice(end);
writeFileSync(new URL('../public/vendor/shan-shui.js', import.meta.url),
  '// Adapted from Lingdong Huang, shan-shui-inf (2018), MIT. See LICENSE and NOTICE.md.\n' + source);
