-- Folderacties (bv. via Folderz) voor winkels die zelf niet uit te lezen zijn (Kruidvat, Action).
-- Alleen de actie (en prijs als die vermeld wordt); geen normale prijs.
ALTER TABLE category ADD COLUMN trefwoorden TEXT; -- komma-gescheiden merken/woorden, bv. "huggies"

CREATE TABLE folder_actie (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  winkel TEXT NOT NULL,
  category_id INTEGER REFERENCES category(id),
  titel TEXT NOT NULL,
  actie_label TEXT,
  prijs REAL,
  geldig_van TEXT,   -- YYYY-MM-DD
  geldig_tot TEXT,   -- YYYY-MM-DD
  url TEXT NOT NULL UNIQUE,
  bron TEXT NOT NULL DEFAULT 'folderz',
  eerst_gezien TEXT NOT NULL DEFAULT (datetime('now')),
  laatst_gezien TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_folder_actie_cat ON folder_actie(category_id, geldig_tot);

UPDATE category SET trefwoorden = 'huggies' WHERE id = 1;
UPDATE category SET trefwoorden = 'finish,dreft' WHERE id = 2;
UPDATE category SET trefwoorden = 'sensodyne,proglasur' WHERE id = 3;
UPDATE category SET trefwoorden = 'taft' WHERE id = 4;
UPDATE category SET trefwoorden = 'slimpie' WHERE id = 5;
