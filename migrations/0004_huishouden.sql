-- Huishoudartikelen: nieuwe eenheden, categorie-groep, zoekkandidaten, eenheden per waarneming.
--
-- category heeft een CHECK op eenheid die niet met ALTER kan worden aangepast. Omdat
-- category, listing, price_observation en folder_actie via foreign keys aan elkaar hangen,
-- en D1 bij DROP TABLE de FK's controleert, worden alle vier opnieuw aangemaakt ZONDER
-- FK-constraints (de Worker bewaakt de koppelingen). Volgorde: nieuw aanmaken, kopiëren,
-- de kringverwijzing category -> listing losmaken, oud weggooien (kinderen eerst), hernoemen.
PRAGMA defer_foreign_keys = on;

CREATE TABLE category_n (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  naam TEXT NOT NULL UNIQUE,
  -- per stuk: doekje, tablet, rol, wasbeurt, zak, stuk; per 100 ml: ml; per liter: liter; per meter: meter
  eenheid TEXT NOT NULL CHECK (eenheid IN ('doekje','tablet','ml','liter','rol','wasbeurt','zak','meter','stuk')),
  groep TEXT NOT NULL DEFAULT 'drogisterij' CHECK (groep IN ('drogisterij','huishouden')),
  benchmark_prijs REAL,
  benchmark_listing_id INTEGER,
  trefwoorden TEXT,
  zoektermen TEXT,     -- komma-gescheiden zoektermen om producten te ontdekken (Picnic/AH)
  omschrijving TEXT    -- wat telt als gelijkwaardig
);
INSERT INTO category_n (id, naam, eenheid, groep, benchmark_prijs, benchmark_listing_id, trefwoorden)
  SELECT id, naam, eenheid, CASE WHEN id = 2 THEN 'huishouden' ELSE 'drogisterij' END,
         benchmark_prijs, benchmark_listing_id, trefwoorden FROM category;

CREATE TABLE listing_n (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  winkel TEXT NOT NULL,
  merk TEXT NOT NULL,
  productnaam TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  -- eenheden per verpakking (handmatig/terugval): stuks, ml, liter, rollen, wasbeurten, zakken, meters
  stuks_per_verpakking REAL NOT NULL CHECK (stuks_per_verpakking > 0),
  scrape_methode TEXT NOT NULL DEFAULT 'thuis' CHECK (scrape_methode IN ('cloud','thuis')),
  actief INTEGER NOT NULL DEFAULT 1
);
INSERT INTO listing_n SELECT id, category_id, winkel, merk, productnaam, url, stuks_per_verpakking, scrape_methode, actief FROM listing;

CREATE TABLE price_observation_n (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL,
  datum TEXT NOT NULL,
  prijs REAL,
  normale_prijs REAL,
  actie_label TEXT,
  min_aantal INTEGER,
  effectieve_prijs_totaal REAL,
  prijs_per_eenheid REAL,
  bron_ok INTEGER NOT NULL DEFAULT 1,
  bron TEXT NOT NULL DEFAULT 'cloud',
  foutmelding TEXT,
  aangemaakt TEXT NOT NULL DEFAULT (datetime('now')),
  eenheden REAL,  -- eenheden per verpakking zoals gelezen (bv. "38 wasbeurten"); NULL = listing.stuks_per_verpakking
  UNIQUE (listing_id, datum)
);
INSERT INTO price_observation_n (id, listing_id, datum, prijs, normale_prijs, actie_label, min_aantal,
  effectieve_prijs_totaal, prijs_per_eenheid, bron_ok, bron, foutmelding, aangemaakt)
  SELECT id, listing_id, datum, prijs, normale_prijs, actie_label, min_aantal, effectieve_prijs_totaal,
         prijs_per_eenheid, bron_ok, bron, foutmelding, aangemaakt FROM price_observation;

CREATE TABLE folder_actie_n (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  winkel TEXT NOT NULL,
  category_id INTEGER,
  titel TEXT NOT NULL,
  actie_label TEXT,
  prijs REAL,
  geldig_van TEXT,
  geldig_tot TEXT,
  url TEXT NOT NULL UNIQUE,
  bron TEXT NOT NULL DEFAULT 'folderz',
  eerst_gezien TEXT NOT NULL DEFAULT (datetime('now')),
  laatst_gezien TEXT NOT NULL DEFAULT (datetime('now')),
  prijs_was REAL,
  prijs_per_eenheid REAL
);
INSERT INTO folder_actie_n SELECT id, winkel, category_id, titel, actie_label, prijs, geldig_van, geldig_tot, url,
  bron, eerst_gezien, laatst_gezien, prijs_was, prijs_per_eenheid FROM folder_actie;

-- kringverwijzing losmaken (waarde staat al in category_n), daarna kinderen eerst weggooien
UPDATE category SET benchmark_listing_id = NULL;
DROP TABLE price_observation;
DROP TABLE folder_actie;
DROP TABLE listing;
DROP TABLE category;

ALTER TABLE category_n RENAME TO category;
ALTER TABLE listing_n RENAME TO listing;
ALTER TABLE price_observation_n RENAME TO price_observation;
ALTER TABLE folder_actie_n RENAME TO folder_actie;
CREATE INDEX idx_listing_category ON listing(category_id);
CREATE INDEX idx_obs_datum ON price_observation(datum);
CREATE INDEX idx_folder_actie_cat ON folder_actie(category_id, geldig_tot);

CREATE TABLE kandidaat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  winkel TEXT NOT NULL,
  zoekterm TEXT,
  extern_id TEXT NOT NULL,     -- Picnic s1234567 / AH wi123456
  naam TEXT NOT NULL,
  merk TEXT,
  hoeveelheid TEXT,            -- zoals de winkel het noemt ("1 liter", "12 rollen")
  prijs REAL,
  url TEXT,
  gezien TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (category_id, winkel, extern_id)
);
