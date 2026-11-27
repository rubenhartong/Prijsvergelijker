# Claude Music 🎵

Eigen muziekapp in de stijl van een streamingdienst, met nummers van YouTube.

- Zoeken naar nummers/artiesten (of plak een YouTube-link) — geen API-sleutel nodig
- Afspelen met wachtrij, volgende/vorige, shuffle, herhalen (alles / 1 nummer), spoelen, volume
- Leuke nummers (hartje), eigen afspeellijsten maken/hernoemen/verwijderen, onlangs afgespeeld
- ⊕-knop bij elk nummer/elke kaart en in de spelerbalk: kiezer met al je lijsten (aanvinken/uitvinken, zoeken, direct nieuwe lijst maken)
- Op een afspeellijst zelf: zoeken + aanbevolen nummers met één klik toevoegen
- Sets, genres, zoekresultaten en de wachtrij in één keer opslaan als afspeellijst; slepen naar een lijst in de zijbalk (desktop)
- **Live sets**: Defqon.1 2026, Korsakoff, Sefa, Dr. Peacock, Harmony of Hardcore, Qlimax, hardstyle mixes + eigen artiesten/festivals toevoegen
- Lange sets onthouden waar je was ("Verder luisteren"), slaaptimer (maantje bij Nu speelt)
- "Omdat je X luistert": rijen op basis van wat je het meest afspeelt en leuk vindt
- Zoeken in Nummers of Live sets & mixes
- Genres om te ontdekken (hardstyle, raw, hardcore, frenchcore, euphoric, uptempo, ...), bediening via vergrendelscherm/koptelefoon (Media Session)
- Werkt op telefoon (installeerbaar als app via "Zet op beginscherm") en desktop
- Sneltoetsen: spatie = afspelen/pauze, Shift+→/← = volgende/vorige, / = zoeken
- Synchroniseren tussen apparaten met een code (Bibliotheek → Synchroniseren), opgeslagen in Cloudflare KV
- Tracklist bij sets (uit YouTube-hoofdstukken of tijden in de beschrijving): huidig nummer in beeld, klik om te springen
- Automatisch doorspelen met vergelijkbare nummers/sets als de wachtrij op is
- "Nieuwe sets deze week" op het startscherm
- Back-up exporteren/importeren via Bibliotheek

## Opzet
```
youtube.js         zoekresultaten van YouTube uitlezen
worker.js          Cloudflare Worker: serveert de app (public/ wordt meegebundeld), /api/search, /api/video (tracklist + vergelijkbaar), /api/sync/<code> (KV)
public/index.html  de hele app (HTML/CSS/JS, geen build-stap)
public/*           icoon, manifest, service worker
```

## Online zetten (gratis Cloudflare-plan)
```
cd muziek
npx wrangler deploy
```
Live: https://claude-music.overtime-web.workers.dev

Lokaal proberen: `npx wrangler dev` in deze map.

## Beperkingen
- Het afspelen loopt via de officiële YouTube-speler (de video is zichtbaar in "Nu speelt").
  Sommige video's mogen niet buiten YouTube spelen; die worden automatisch overgeslagen.
- Op een telefoon stopt het geluid meestal als het scherm op slot gaat of je de browser
  verlaat (beperking van YouTube-embeds), tenzij je browser achtergrondafspelen toestaat.
- Reclame en beschikbaarheid volgen YouTube zelf.
