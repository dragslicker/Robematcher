import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTag, validateLooks, stylistPrompt, tagPrompt } from '../js/ai.js';
import { demoWardrobe } from '../js/demo.js';
import { conditionsFrom } from '../js/weather.js';

test('normaliserar Claudes plaggtaggar', () => {
  const t = normalizeTag({
    category: 'top', subtype: 'stickad tröja', name: 'Marinblå stickad tröja', color: '#1F2A44', color2: 'blå',
    pattern: 'zigzag', styles: ['smart', 'okänd'], warmth: 9, formality: '3', waterproof: 'ja',
  });
  assert.equal(t.subtype, 'Stickad tröja');
  assert.equal(t.color, '#1f2a44');
  assert.equal(t.color2, null);
  assert.equal(t.pattern, 'solid');
  assert.deepEqual(t.styles, ['smart']);
  assert.equal(t.warmth, 5);
  assert.equal(t.formality, 3);
  assert.equal(t.waterproof, false);
  assert.equal(normalizeTag({ category: 'hatt' }), null);
  assert.equal(normalizeTag({ category: 'shoes', subtype: 'Raketskor' }).subtype, 'Sandaler');
});

test('stylistens looks valideras mot garderoben', () => {
  const w = demoWardrobe();
  const id = (name) => w.find((i) => i.name === name).id;
  const looks = validateLooks({
    looks: [
      { title: 'Ok', itemIds: [id('Vit skjorta'), id('Beige chinos'), id('Bruna loafers'), 'påhittat-id', id('Bruna loafers')] },
      { title: 'Saknar underdel', itemIds: [id('Vit skjorta'), id('Bruna loafers')] },
      { title: 'Två överdelar', itemIds: [id('Vit skjorta'), id('Svart t-shirt'), id('Raka jeans')] },
      { title: 'Klänning', itemIds: [id('Terrakotta sommarklänning'), id('Vit t-shirt'), id('Sandaler')] },
    ],
  }, w);
  assert.equal(looks.length, 3);
  assert.deepEqual(looks[0].items.map((i) => i.name), ['Vit skjorta', 'Beige chinos', 'Bruna loafers']);
  assert.deepEqual(looks[1].items.map((i) => i.name), ['Vit skjorta', 'Raka jeans']);
  assert.deepEqual(looks[2].items.map((i) => i.name), ['Terrakotta sommarklänning', 'Sandaler']);
  assert.deepEqual(validateLooks('nonsens', w), []);
});

test('prompterna innehåller det Claude behöver', () => {
  const w = demoWardrobe();
  const p = stylistPrompt({ wardrobe: w, conditions: conditionsFrom({ temp: 4, code: 63 }), style: 'smart', occasion: 'Middag', candidates: [] });
  assert.ok(p.includes('Middag'));
  assert.ok(p.includes('Smart casual'));
  assert.ok(p.includes('regn'));
  assert.ok(w.every((i) => p.includes(i.id)));
  assert.ok(tagPrompt(3).includes('Stickad tröja'));
});
