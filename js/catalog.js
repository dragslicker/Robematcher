// Kategorier, stilar och plaggtyper.

export const CATEGORIES = {
  top: { label: 'Överdel', icon: '👕' },
  bottom: { label: 'Underdel', icon: '👖' },
  dress: { label: 'Klänning / jumpsuit', icon: '👗' },
  outerwear: { label: 'Ytterplagg', icon: '🧥' },
  shoes: { label: 'Skor', icon: '👟' },
  accessory: { label: 'Accessoar', icon: '🧣' },
};

// Plaggtyper med förvalda värden för värme (1–5) och formalitet (1–5).
export const SUBTYPES = {
  top: [
    ['T-shirt', 1, 1], ['Linne', 1, 1], ['Piké', 2, 2], ['Blus', 2, 3], ['Skjorta', 2, 3],
    ['Oxfordskjorta', 2, 3], ['Långärmad tröja', 2, 2], ['Hoodie', 3, 1], ['Sweatshirt', 3, 1],
    ['Stickad tröja', 3, 3], ['Polotröja', 3, 3], ['Kofta', 3, 2], ['Tjock stickad', 4, 2],
  ],
  bottom: [
    ['Shorts', 1, 1], ['Kjol', 2, 3], ['Chinos', 3, 3], ['Jeans', 3, 2], ['Kostymbyxor', 3, 5],
    ['Mjukisbyxor', 3, 1], ['Cargobyxor', 3, 1], ['Linnebyxor', 2, 2], ['Manchesterbyxor', 4, 2],
    ['Ullbyxor', 4, 4],
  ],
  dress: [
    ['Sommarklänning', 1, 2], ['Skjortklänning', 2, 3], ['Stickad klänning', 3, 2],
    ['Cocktailklänning', 2, 5], ['Jumpsuit', 2, 3],
  ],
  outerwear: [
    ['Kavaj', 2, 4], ['Jeansjacka', 2, 1], ['Overshirt', 2, 2], ['Bomberjacka', 3, 1],
    ['Skinnjacka', 3, 2], ['Trenchcoat', 3, 4], ['Regnjacka', 2, 1], ['Kappa', 4, 4],
    ['Ullrock', 4, 5], ['Dunjacka', 5, 1], ['Parkas', 5, 2],
  ],
  shoes: [
    ['Sandaler', 1, 1], ['Espadriller', 1, 2], ['Sneakers', 2, 1], ['Löparskor', 2, 1],
    ['Loafers', 2, 4], ['Ballerinor', 2, 3], ['Klackskor', 2, 5], ['Derbyskor', 2, 4],
    ['Oxfordskor', 2, 5], ['Chelsea boots', 3, 3], ['Kängor', 4, 2], ['Gummistövlar', 3, 1],
    ['Vinterkängor', 5, 1],
  ],
  accessory: [
    ['Skärp', 0, 3], ['Halsduk', 0, 2], ['Mössa', 0, 1], ['Keps', 0, 1], ['Väska', 0, 3],
    ['Slips', 0, 5], ['Klocka', 0, 3], ['Smycke', 0, 3], ['Solglasögon', 0, 2],
  ],
};

export const STYLES = {
  casual: { label: 'Vardag', formality: [1, 3] },
  smart: { label: 'Smart casual', formality: [2, 4] },
  business: { label: 'Business', formality: [4, 5] },
  street: { label: 'Streetwear', formality: [1, 2] },
  minimal: { label: 'Minimalistisk', formality: [2, 4] },
  sporty: { label: 'Sportig', formality: [1, 2] },
  boho: { label: 'Boho', formality: [1, 3] },
  classic: { label: 'Klassisk', formality: [3, 5] },
  party: { label: 'Fest', formality: [3, 5] },
};

export const PATTERNS = {
  solid: 'Enfärgad',
  subtle: 'Diskret mönster (melerad, tunn rand)',
  bold: 'Tydligt mönster (rutor, print, blommor)',
};

// Accessoarer som passar i viss väderlek.
export const COLD_ACCESSORIES = new Set(['Halsduk', 'Mössa']);
export const SUN_ACCESSORIES = new Set(['Solglasögon', 'Keps']);
