# Robematcher

Din garderob, fotograferad. Fota dina kläder, så sätter appen ihop outfits efter **färg**, **stil** och **vädret där du är**.

## Funktioner

- **Kläderna läggs in via foto.** Fota ett plagg eller välj många bilder på en gång och gå igenom dem en i taget ("Plagg 2 av 8"). Appen:
  - **frilägger plagget** från bakgrunden (säng, golv eller vägg) och beskär bilden, så att outfits ser ut som ett lookbook,
  - **läser av huvudfärg och detaljfärg** från det frilagda plagget,
  - **minns senaste kategorin**, så att det går fort att fota alla tröjor i rad,
  - fyller i namn, värme, formalitet, stilar och regntålighet utifrån plaggtypen. Allt går att ändra under "Fler detaljer".
- **Vädret där du är.** Appen hämtar din position automatiskt (webbläsarens platstjänst), visar ortnamnet och prognosen för morgon, lunch och kväll, upplevd temperatur, regnrisk och vind. Den uppdateras när du öppnar appen igen. Du kan också söka en ort eller ställa in vädret själv. Väder från [Open-Meteo](https://open-meteo.com) och ortnamn från BigDataCloud, båda gratis och utan API-nyckel.
- **Outfitgenerator** som poängsätter varje kombination på:
  - **Färgharmoni**: neutral bas + accent, ton-i-ton, analoga färger, komplementfärger, triad. Dämpade komplementfärger premieras före skrikiga. Fler än tre kulörer straffas.
  - **Neutralklassning som i modevärlden**: svart, vitt, grått, offwhite, marinblått, denim, beige, kamel, cognac och oliv räknas som neutraler.
  - **Ljuskontrast** mellan över- och underdel. "Nästan samma färg" varnas för.
  - **Mönster**: max ett tydligt mönster. Bonus när en färg i mönstret plockas upp av ett annat plagg.
  - **Stil och formalitet**: Vardag, Smart casual, Business, Streetwear, Minimalistisk, Sportig, Boho, Klassisk, Fest.
  - **Väder**: ytterplagg krävs när det är svalt och måste vara varmt nog. Regn ger vattentätt och sorterar bort sandaler. Mössa och halsduk när det är kallt, solglasögon i sol.
  - **Variation**: plagg du burit nyligen prioriteras ned.
- **Behåll plagg**: tryck på ett plagg i en look så byggs nästa omgång kring det.
- **Sparat**, **Färg** (vad passar till en färg, ur din egen garderob) och stylingregler.
- Allt sparas lokalt på enheten (IndexedDB, även fotona). Backup kan exporteras och importeras som en fil.

> Platstjänster kräver https (eller localhost). Med GitHub Pages fungerar det direkt.

## Kom igång

Appen är ren HTML/CSS/JavaScript utan byggsteg. Den använder ES-moduler och behöver därför serveras över http (inte öppnas som fil):

```bash
npm start            # npx serve på http://localhost:8080
# eller
python3 -m http.server 8080
```

Tryck på **Ladda exempelgarderob** för att testa direkt med 34 plagg.

För att använda appen i mobilen kan den publiceras med GitHub Pages (Settings → Pages → branch). Öppna sedan sidan i mobilen och välj "Lägg till på hemskärmen".

## Tester

```bash
npm test
```

Testerna täcker färgklassning, harmonier och outfitmotorn (väder, stil, låsning, mönsterregler).

## Struktur

| Fil | Innehåll |
| --- | --- |
| `js/color.js` | Färglära: HSL, färgnamn, neutralklassning, harmonibedömning |
| `js/outfits.js` | Outfitmotorn: väder- och stilpassning, poängsättning, generering |
| `js/weather.js` | Position, ortnamn, prognos och översättning till klädbehov |
| `js/catalog.js` | Kategorier, plaggtyper, stilar och mönster |
| `js/image.js` | Frilägning, beskärning och färgavläsning av foton |
| `js/app.js` | Gränssnittet |
| `js/storage.js` | Lagring i IndexedDB (data + foton) och backup |
| `js/demo.js` | Exempelgarderob |
