# Robematcher

Din digitala garderob. Fota dina kläder, så föreslår appen outfits som matchar **färg**, **stil** och **väder**.

## Funktioner

- **Garderob med foto.** Ta en bild på plagget så läser appen av huvudfärg och eventuell andrafärg (bakgrunden filtreras bort). Den föreslår också ett namn, till exempel "Marinblå stickad tröja". Värme, formalitet och vattentålighet fylls i från plaggtypen och går att justera.
- **Outfitgenerator** som poängsätter varje kombination på:
  - **Färgharmoni**: neutral bas + accent, ton-i-ton, analoga färger, komplementfärger, triad. Dämpade komplementfärger premieras före skrikiga. Fler än tre kulörer straffas.
  - **Neutralklassning som i modevärlden**: svart, vitt, grått, offwhite, marinblått, denim, beige, kamel, cognac och oliv räknas som neutraler.
  - **Ljuskontrast** mellan över- och underdel. "Nästan samma färg" varnas för.
  - **Mönster**: max ett tydligt mönster. Bonus när en färg i mönstret plockas upp av ett annat plagg.
  - **Stil och formalitet**: välj Vardag, Smart casual, Business, Streetwear, Minimalistisk, Sportig, Boho, Klassisk eller Fest. Plagg som skiljer sig mycket i formalitet straffas.
  - **Väder**: upplevd temperatur, vind, regn och snö från [Open-Meteo](https://open-meteo.com) (gratis, ingen API-nyckel). Ytterplagg krävs när det är svalt. Regn ger vattentäta skor och jackor, och sandaler sorteras bort. Mössa och halsduk läggs till när det är kallt, solglasögon när det är sol.
  - **Detaljer**: skärp som matchar skorna ger bonus. Plagg du burit senaste dagarna prioriteras ned för variation.
- **Lås plagg.** Tryck på ett plagg i ett förslag så byggs nästa omgång kring det.
- **Spara favoriter** och markera "Har på mig idag".
- **Färglära**: välj en färg och se vad som passar, både generellt och bland dina egna plagg. Där finns också stylingreglerna (60-30-10, ett mönster i taget med flera).
- **Idag / Imorgon**, väder via stad eller GPS, eller manuellt inställt väder.
- Allt sparas lokalt i webbläsaren. Exportera och importera backup som JSON.
- Mobilanpassad, mörkt läge och går att lägga till på hemskärmen.

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
| `js/weather.js` | Open-Meteo och översättning av väder till klädbehov |
| `js/catalog.js` | Kategorier, plaggtyper, stilar och mönster |
| `js/image.js` | Förminskning av foton och utvinning av dominerande färger |
| `js/app.js` | Gränssnittet |
| `js/storage.js` | Lokal lagring och backup |
| `js/demo.js` | Exempelgarderob |
