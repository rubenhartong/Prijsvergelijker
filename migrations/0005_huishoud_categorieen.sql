-- Huishoudcategorieën (groep 'huishouden'). trefwoorden = folders koppelen (heel woord, langste wint);
-- zoektermen = producten ontdekken bij Picnic/AH; omschrijving = wat telt als gelijkwaardig.
INSERT INTO category (naam, eenheid, groep, trefwoorden, zoektermen, omschrijving) VALUES
 ('Allesreiniger', 'liter', 'huishouden', 'allesreiniger', 'allesreiniger', 'elk merk, Action-huismerk telt mee'),
 ('WC-reiniger', 'liter', 'huishouden', 'wc reiniger,toiletreiniger,wc gel,toiletgel', 'wc reiniger', 'gel, elk merk'),
 ('Glasreiniger', 'liter', 'huishouden', 'glasreiniger', 'glasreiniger', 'elk merk'),
 ('Ontvetter / keukenspray', 'liter', 'huishouden', 'ontvetter,keukenspray,keukenreiniger', 'ontvetter,keukenspray', 'elk merk'),
 ('Schoonmaakdoekjes / sponsjes', 'stuk', 'huishouden', 'schuursponzen,sponzen,sponsjes,schoonmaakdoekjes,vaatdoekjes,microvezeldoekjes', 'schuursponzen,vaatdoekjes', 'elk merk'),
 ('Afwasmiddel', 'liter', 'huishouden', 'afwasmiddel', 'afwasmiddel', 'Dreft of gelijkwaardig'),
 ('Wasmiddel', 'wasbeurt', 'huishouden', 'wasmiddel,wascapsules,wasgel,vloeibaar wasmiddel', 'wasmiddel,wascapsules', 'vloeibaar of capsules'),
 ('Wasverzachter', 'wasbeurt', 'huishouden', 'wasverzachter', 'wasverzachter', 'elk merk'),
 ('Toiletpapier', 'rol', 'huishouden', 'toiletpapier,wc papier', 'toiletpapier', 'minimaal 3-laags'),
 ('Keukenrol', 'rol', 'huishouden', 'keukenrol,keukenpapier', 'keukenpapier', 'elk merk'),
 ('Vuilniszakken 60 L', 'zak', 'huishouden', 'afvalzakken,vuilniszakken', 'afvalzakken', '60 L met trekband'),
 ('Bakpapier / aluminiumfolie', 'meter', 'huishouden', 'bakpapier,aluminiumfolie,aluminium folie', 'bakpapier,aluminiumfolie', 'elk merk'),
 ('Diepvrieszakjes', 'stuk', 'huishouden', 'diepvrieszakjes,vrieszakjes,vrieszakken', 'diepvrieszakjes', 'elk merk');
