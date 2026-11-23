-- Prijsvergelijker: basisschema
CREATE TABLE category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  naam TEXT NOT NULL UNIQUE,
  -- eenheid: doekje | tablet  -> prijs per stuk
  --          ml               -> prijs per 100 ml
  --          liter            -> prijs per liter
  eenheid TEXT NOT NULL CHECK (eenheid IN ('doekje','tablet','ml','liter')),
  benchmark_prijs REAL,            -- laagste prijs per eenheid van de laatste 90 dagen (cache)
  benchmark_listing_id INTEGER REFERENCES listing(id)
);

CREATE TABLE listing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES category(id),
  winkel TEXT NOT NULL,            -- picnic|ah|jumbo|plus|kruidvat|etos|action|hema|bol|amazon
  merk TEXT NOT NULL,
  productnaam TEXT NOT NULL,
  url TEXT NOT NULL,
  -- hoeveelheid per verpakking in de eenheid van de categorie:
  -- doekje/tablet: aantal stuks; ml: aantal ml; liter: aantal liter (bv. 0.58)
  stuks_per_verpakking REAL NOT NULL CHECK (stuks_per_verpakking > 0),
  scrape_methode TEXT NOT NULL DEFAULT 'cloud' CHECK (scrape_methode IN ('cloud','thuis')),
  actief INTEGER NOT NULL DEFAULT 1,
  UNIQUE (url)
);
CREATE INDEX idx_listing_category ON listing(category_id);

CREATE TABLE price_observation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listing(id),
  datum TEXT NOT NULL,             -- YYYY-MM-DD (Europe/Amsterdam)
  prijs REAL,                      -- schapprijs per verpakking zoals getoond
  normale_prijs REAL,              -- prijs zonder actie (indien bekend)
  actie_label TEXT,                -- ruw label, bv. "1+1 gratis"
  min_aantal INTEGER,              -- minimaal aantal verpakkingen voor de actie
  effectieve_prijs_totaal REAL,    -- totaalprijs voor min_aantal verpakkingen
  prijs_per_eenheid REAL,          -- effectief per eenheid (zie category.eenheid)
  bron_ok INTEGER NOT NULL DEFAULT 1,
  bron TEXT NOT NULL DEFAULT 'cloud', -- cloud|thuis|handmatig
  foutmelding TEXT,
  aangemaakt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (listing_id, datum)
);
CREATE INDEX idx_obs_datum ON price_observation(datum);

CREATE TABLE scrape_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tijdstip TEXT NOT NULL DEFAULT (datetime('now')),
  bron TEXT NOT NULL,              -- cloud|thuis|probe
  aantal_ok INTEGER NOT NULL DEFAULT 0,
  aantal_fout INTEGER NOT NULL DEFAULT 0,
  foutmelding TEXT
);
