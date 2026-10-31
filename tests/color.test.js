import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorFamily, colorName, pairHarmony, paletteHarmony, hexToHsl, hslToHex } from '../js/color.js';

test('klassar neutraler och jordtoner', () => {
  assert.equal(colorFamily('#000000'), 'neutral');
  assert.equal(colorFamily('#ffffff'), 'neutral');
  assert.equal(colorFamily('#8a8a8a'), 'neutral');
  assert.equal(colorFamily('#f3efe4'), 'neutral'); // offwhite
  assert.equal(colorFamily('#36454f'), 'neutral'); // kolgrå
  assert.equal(colorFamily('#c19a6b'), 'earth'); // kamel
  assert.equal(colorFamily('#6b6b2a'), 'earth'); // oliv
  assert.equal(colorFamily('#1f2a44'), 'navy');
  assert.equal(colorFamily('#4f6d8f'), 'denim');
  assert.equal(colorFamily('#c8102e'), 'chromatic');
  assert.equal(colorFamily('#f5d327'), 'chromatic');
});

test('namnger färger', () => {
  assert.equal(colorName('#1e2a45'), 'Marinblå');
  assert.equal(colorName('#c29b6a'), 'Kamel');
  assert.equal(colorName('#000000'), 'Svart');
});

test('känner igen harmonityper', () => {
  assert.equal(pairHarmony('#1f4fa0', '#c8702a').type, 'complementary'); // blått + orange
  assert.equal(pairHarmony('#a0461f', '#d4a017').type, 'analogous'); // rost + senap
  assert.equal(pairHarmony('#add8e6', '#2b5f8a').type, 'monochrome');
  assert.equal(pairHarmony('#e01010', '#10a010').type, 'triadic'); // rött + grönt (120°)
  assert.equal(pairHarmony('#e01010', '#9acd10').type, 'clash'); // rött + gulgrönt (~80°)
});

test('kraftiga komplementfärger får lägre poäng än dämpade', () => {
  const vivid = pairHarmony('#0047ab', '#f28c28').score;
  const muted = pairHarmony('#2c3e66', '#a0582f').score;
  assert.ok(muted > vivid);
});

test('neutral bas + en accent slår många krockande kulörer', () => {
  const accent = paletteHarmony([{ hex: '#1f2a44' }, { hex: '#f3efe4' }, { hex: '#c8664a' }]);
  const busy = paletteHarmony([{ hex: '#c8102e' }, { hex: '#f5d327' }, { hex: '#0047ab' }, { hex: '#c71585' }]);
  assert.equal(accent.type, 'accent');
  assert.equal(busy.type, 'busy');
  assert.ok(accent.score > busy.score + 0.4);
});

test('hsl round-trip', () => {
  const hex = '#3a7bd5';
  const { h, s, l } = hexToHsl(hex);
  assert.equal(hslToHex(h, s, l), hex);
});
