# Draaitafel 🎵

Eigen muziekapp in de stijl van een streamingdienst, met nummers van YouTube.

- Zoeken naar nummers/artiesten (of plak een YouTube-link) — geen API-sleutel nodig
- Afspelen met wachtrij, volgende/vorige, shuffle, herhalen (alles / 1 nummer), spoelen, volume
- Leuke nummers (hartje), eigen afspeellijsten maken/hernoemen/verwijderen, onlangs afgespeeld
- Genres om te ontdekken, bediening via vergrendelscherm/koptelefoon (Media Session)
- Werkt op telefoon (installeerbaar als app via "Zet op beginscherm") en desktop
- Sneltoetsen: spatie = afspelen/pauze, Shift+→/← = volgende/vorige, / = zoeken
- Bibliotheek staat in de browser (localStorage); exporteren/importeren via Bibliotheek

## Opzet
```
worker.js          Cloudflare Worker: /api/search haalt YouTube-zoekresultaten op (1 uur gecachet)
public/index.html  de hele app (HTML/CSS/JS, geen build-stap)
public/*           icoon, manifest, service worker
```

## Online zetten (gratis Cloudflare-plan)
```
cd muziek
npx wrangler deploy
```
Daarna draait hij op `https://draaitafel.<jouw-subdomein>.workers.dev`.

Lokaal proberen: `npx wrangler dev` in deze map.

## Beperkingen
- Het afspelen loopt via de officiële YouTube-speler (de video is zichtbaar in "Nu speelt").
  Sommige video's mogen niet buiten YouTube spelen; die worden automatisch overgeslagen.
- Op een telefoon stopt het geluid meestal als het scherm op slot gaat of je de browser
  verlaat (beperking van YouTube-embeds), tenzij je browser achtergrondafspelen toestaat.
- Reclame en beschikbaarheid volgen YouTube zelf.
