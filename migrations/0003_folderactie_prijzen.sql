ALTER TABLE folder_actie ADD COLUMN prijs_was REAL;          -- prijs zonder actie (zoals in de folder)
ALTER TABLE folder_actie ADD COLUMN prijs_per_eenheid REAL;  -- alleen als de hoeveelheid uit de titel blijkt
