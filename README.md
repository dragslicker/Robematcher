# Robematcher

Din garderob, fotograferad. Fota dina kläder, så sätter appen ihop outfits efter **färg**, **stil** och **vädret där du är**.

## Funktioner

- **Snabb skanning av hela garderoben.** "Skanna plagg" öppnar en kamera där du fotar i följd, utan att något formulär öppnas mellan bilderna. Du kan också välja många bilder på en gång. Allt bearbetas i bakgrunden och hamnar i **Att granska**:
  - bakgrunden tas bort och bilden beskärs, så att outfits ser ut som ett lookbook,
  - **flera plagg på samma foto** blir separata plagg om de inte rör varandra (ett skopar hålls ihop),
  - **Claude känner igen plaggen**: typ, svenskt namn, färger, mönster, stil, värme, formalitet och om plagget tål regn. Upp till sex bilder analyseras i samma anrop,
  - du kontrollerar listan och trycker **Spara alla**, eller öppnar ett plagg för att ändra det.
- **Stylisten (Claude).** Skriv vad du ska göra ("middag med vänner", "jobbintervju"). Claude ser hela garderoben, vädret och vald stil, och föreslår looks med motivering och stylingtips. Svaren kontrolleras mot garderoben, så att bara riktiga plagg i giltiga kombinationer visas. Regelmotorn finns kvar och ger förslag direkt, även utan Claude.
  - Öppnad via claude.ai används Claude på ditt eget konto, utan nyckel.
  - På andra adresser (t.ex. GitHub Pages) kan du ansluta en egen API-nyckel från Anthropic. Den sparas bara i webbläsaren och skickas bara till Anthropic.
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
| `js/ai.js` | Claude: plaggigenkänning, stylist, validering av svar |
| `js/app.js` | Gränssnittet, skanner och granskningslista |
| `js/storage.js` | Lagring i IndexedDB (data + foton) och backup |
| `js/demo.js` | Exempelgarderob |
