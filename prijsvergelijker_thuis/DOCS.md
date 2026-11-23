# Prijsvergelijker thuis-scraper

Haalt elke dag (standaard 06:30) de prijzen op van listings met `scrape_methode = thuis`:
AH, Kruidvat, Etos, Action, HEMA, bol, een deel van Amazon en Picnic. Dat gebeurt via een
gewone Chromium-browser op je eigen thuisverbinding. Picnic gaat via de app-API met jouw
account. De ruwe prijs en het actielabel gaan naar de Worker (`POST /api/observations`),
die omrekent naar prijs per eenheid.

## Installeren
1. Kies **Instellingen → Add-ons → Add-on-winkel → ⋮ → Repositories** en voeg toe:
   `https://github.com/rubenhartong/prijsvergelijker`
2. Installeer **Prijsvergelijker thuis-scraper**. De eerste build duurt op een HA Green
   10–20 minuten, omdat Chromium wordt geïnstalleerd (~1 GB).
3. Vul onder **Configuratie** in:
   - `api_key`: je API-sleutel van de Worker;
   - `picnic_email` en `picnic_password`: je Picnic-inlog.
4. Zet voor de eerste keer `direct_bij_start` aan en start de add-on. Volg het **Logboek**.

## Picnic-inlog (2FA)
Bij de eerste start vraagt de add-on een sms-code aan. In het logboek staat dan
"sms-code aangevraagd". Vul de code in bij `picnic_2fa_code`, sla op en herstart. Daarna
wordt het token bewaard en is geen code meer nodig. Je kunt `picnic_2fa_code` dan weer
leegmaken.

## Opties
| optie | betekenis |
|---|---|
| `tijd` | start van de dagelijkse ronde (NL-tijd) |
| `direct_bij_start` | ook meteen een ronde draaien bij het starten (handig om te testen) |
| `pauze_seconden` | pauze tussen twee pagina's: willekeurig tussen x en 2x seconden |
| `winkels` | welke winkels deze add-on doet |

## Regels
- Max 1 poging per listing per dag: listings die vandaag al een waarneming hebben, worden
  overgeslagen.
- Eén pagina tegelijk, winkels om-en-om.
- Geen captcha- of bot-omzeiling. Een geblokkeerde pagina wordt als fout gemeld, met
  statuscode en paginatitel. Na 3 dagen staat de listing in `/api/summary` →
  `listings_3_dagen_fout`.
