// En exempelgarderob så att man kan testa appen direkt.

const raw = [
  ['Vit t-shirt', 'top', 'T-shirt', '#f7f7f5', null, 'solid', ['casual', 'minimal', 'street'], 1, 1],
  ['Svart t-shirt', 'top', 'T-shirt', '#151515', null, 'solid', ['casual', 'minimal', 'street'], 1, 1],
  ['Ljusblå oxfordskjorta', 'top', 'Oxfordskjorta', '#b9cfe8', null, 'solid', ['smart', 'classic', 'business'], 2, 3],
  ['Vit skjorta', 'top', 'Skjorta', '#ffffff', null, 'solid', ['business', 'classic', 'smart', 'minimal'], 2, 4],
  ['Marinblå stickad', 'top', 'Stickad tröja', '#1f2a44', null, 'solid', ['smart', 'classic', 'minimal'], 3, 3],
  ['Gråmelerad hoodie', 'top', 'Hoodie', '#9a9a9a', null, 'subtle', ['casual', 'street', 'sporty'], 3, 1],
  ['Rostfärgad polo', 'top', 'Polotröja', '#a0461f', null, 'solid', ['smart', 'classic'], 3, 3],
  ['Salviagrön linneskjorta', 'top', 'Skjorta', '#9caf88', null, 'solid', ['casual', 'boho', 'smart'], 1, 2],
  ['Randig tröja', 'top', 'Långärmad tröja', '#f3efe4', '#1f2a44', 'subtle', ['casual', 'classic'], 2, 2],
  ['Blommig blus', 'top', 'Blus', '#e8c4c4', '#6b6b2a', 'bold', ['boho', 'party', 'casual'], 1, 3],
  ['Raka jeans', 'bottom', 'Jeans', '#4f6d8f', null, 'solid', ['casual', 'street', 'smart'], 3, 2],
  ['Svarta jeans', 'bottom', 'Jeans', '#1c1c1c', null, 'solid', ['casual', 'street', 'minimal', 'party'], 3, 2],
  ['Beige chinos', 'bottom', 'Chinos', '#d9c5a0', null, 'solid', ['smart', 'classic', 'casual'], 3, 3],
  ['Grå kostymbyxor', 'bottom', 'Kostymbyxor', '#5a5f66', null, 'solid', ['business', 'classic', 'minimal'], 3, 5],
  ['Vita linnebyxor', 'bottom', 'Linnebyxor', '#f3efe4', null, 'solid', ['boho', 'casual', 'minimal'], 2, 2],
  ['Marinblå shorts', 'bottom', 'Shorts', '#1f2a44', null, 'solid', ['casual', 'sporty'], 1, 1],
  ['Svart midikjol', 'bottom', 'Kjol', '#151515', null, 'solid', ['minimal', 'party', 'smart'], 2, 3],
  ['Terrakotta sommarklänning', 'dress', 'Sommarklänning', '#c8664a', null, 'solid', ['boho', 'casual'], 1, 2],
  ['Svart stickad klänning', 'dress', 'Stickad klänning', '#151515', null, 'solid', ['minimal', 'party', 'smart'], 3, 3],
  ['Kamelfärgad kappa', 'outerwear', 'Kappa', '#c19a6b', null, 'solid', ['classic', 'smart', 'business', 'minimal'], 4, 4],
  ['Svart dunjacka', 'outerwear', 'Dunjacka', '#151515', null, 'solid', ['casual', 'street', 'sporty'], 5, 1, true],
  ['Beige trenchcoat', 'outerwear', 'Trenchcoat', '#d9c5a0', null, 'solid', ['classic', 'smart', 'business'], 3, 4, true],
  ['Jeansjacka', 'outerwear', 'Jeansjacka', '#6d8bb0', null, 'solid', ['casual', 'street'], 2, 1],
  ['Marinblå kavaj', 'outerwear', 'Kavaj', '#1f2a44', null, 'solid', ['smart', 'business', 'classic'], 2, 4],
  ['Gul regnjacka', 'outerwear', 'Regnjacka', '#f5d327', null, 'solid', ['casual', 'sporty', 'street'], 2, 1, true],
  ['Vita sneakers', 'shoes', 'Sneakers', '#f7f7f5', null, 'solid', ['casual', 'street', 'minimal', 'smart', 'sporty'], 2, 2],
  ['Bruna loafers', 'shoes', 'Loafers', '#6b4226', null, 'solid', ['smart', 'classic', 'business'], 2, 4],
  ['Svarta chelsea boots', 'shoes', 'Chelsea boots', '#151515', null, 'solid', ['smart', 'minimal', 'classic', 'party'], 3, 3, true],
  ['Bruna kängor', 'shoes', 'Kängor', '#7a4a2a', null, 'solid', ['casual', 'street', 'classic'], 4, 2, true],
  ['Sandaler', 'shoes', 'Sandaler', '#c19a6b', null, 'solid', ['casual', 'boho'], 1, 1],
  ['Brunt skärp', 'accessory', 'Skärp', '#6b4226', null, 'solid', ['smart', 'classic', 'casual'], 0, 3],
  ['Grå halsduk', 'accessory', 'Halsduk', '#8a8a8a', null, 'solid', ['classic', 'minimal', 'casual'], 0, 2],
  ['Vinröd mössa', 'accessory', 'Mössa', '#6d1a2a', null, 'solid', ['casual', 'street'], 0, 1],
  ['Solglasögon', 'accessory', 'Solglasögon', '#2a2a2a', null, 'solid', ['casual', 'street', 'boho', 'minimal'], 0, 2],
];

export function demoWardrobe() {
  return raw.map(([name, category, subtype, color, color2, pattern, styles, warmth, formality, waterproof], i) => ({
    id: `demo${i}`,
    name, category, subtype, color, color2, pattern, styles, warmth, formality,
    waterproof: !!waterproof,
    photo: null,
    addedAt: Date.now(),
  }));
}
