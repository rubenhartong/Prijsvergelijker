# Genereert seed/seed.sql. Bron van de URL's: zoekresultaten + verificatie via /api/probe
# (Jumbo/Amazon gecontroleerd vanuit de Worker op 2026-11-23; overige winkels geblokkeerd).
# Hoeveelheid: doekje/tablet = aantal stuks per verpakking; ml = ml; liter = liter.
CATS = [
  (1, 'Babydoekjes op waterbasis', 'doekje', 0.018),
  (2, 'Vaatwastabletten Finish Ultimate (Plus) / Dreft Platinum (Plus)', 'tablet', None),
  (3, 'Sensodyne tandpasta', 'ml', None),
  (4, 'Taft Power Styling Wax hold 5 (75 ml)', 'ml', None),
  (5, 'Slimpie siroop aardbei/sinaasappel', 'liter', None),
]
PIC = 'https://picnic.app/nl/producten/'  # pseudo-URL: Picnic-product-id voor de thuis-scraper
AH = 'https://www.ah.nl/producten/product/'
J = 'https://www.jumbo.com/producten/'
PL = 'https://www.plus.nl/product/'
KV = 'https://www.kruidvat.nl/'
ET = 'https://www.etos.nl/producten/'
AC = 'https://www.action.com/nl-nl/p/'
BOL = 'https://www.bol.com/nl/nl/p/'
AMZ = 'https://www.amazon.nl/dp/'
L = [
 # --- 1 babydoekjes
 (1,'amazon','Huggies','Huggies Pure 18x56',AMZ+'B0111AIZ68',1008),
 (1,'amazon','Huggies','Huggies Pure 10x56',AMZ+'B01MAZKGHM',560),
 (1,'amazon','Huggies','Huggies Pure 56',AMZ+'B00FKYEC6Y',56),
 (1,'amazon','WaterWipes','WaterWipes 4x60',AMZ+'B007L3JHEO',240),
 (1,'amazon','WaterWipes','WaterWipes Sensitive+ (9x60)',AMZ+'B08MXT5VDK',540),
 (1,'amazon','WaterWipes','WaterWipes 12x60 plasticvrij',AMZ+'B0D5LJ4N7D',720),
 (1,'picnic','WaterWipes','Waterwipes babydoekjes 3x48',PIC+'s1168151',144),
 (1,'picnic','WaterWipes','Waterwipes babydoekjes soothing 48',PIC+'s1188229',48),
 (1,'picnic','Hello World','Hello World billendoekjes 99% water 2x56',PIC+'s1188037',112),
 (1,'ah','Huggies','Huggies babydoekjes pure extra care 56',AH+'wi215006/huggies-babydoekjes-pure-extra-care',56),
 (1,'ah','WaterWipes','WaterWipes babydoekjes 48',AH+'wi516435/waterwipes-babydoekjes',48),
 (1,'ah','AH','AH Baby waterdoekjes 60',AH+'wi498269/baby-waterdoekjes',60),
 (1,'jumbo','WaterWipes','WaterWipes voordeelpak 3x60',J+'waterwipes-baby-billendoekjes-gevoelige-huid-voordeelpak-3-x-60-stuks-442634PAK',180),
 (1,'plus','Huggies','Huggies babydoekjes pure 56',PL+'huggies-babydoekjes-pure-zak-56-st-565435',56),
 (1,'plus','WaterWipes','Waterwipes babydoekjes 48',PL+'waterwipes-babydoekjes-zak-48-st-535313',48),
 (1,'plus','WaterWipes','Waterwipes babydoekjes 3x48',PL+'waterwipes-babydoekjes-3x48-stuks-zak-144-st-533856',144),
 (1,'plus','Bonbebe','Bonbebe waterdoekjes 60',PL+'bonbebe-waterdoekjes-wikkel-60-st-489672',60),
 (1,'kruidvat','WaterWipes','WaterWipes babydoekjes 9x60',KV+'waterwipes-babydoekjes/p/5492824',540),
 (1,'kruidvat','Kruidvat','Kruidvat Baby Pure waterdoekjes 62',KV+'kruidvat-baby-pure-waterdoekjes/p/5050669',62),
 (1,'kruidvat','Kruidvat','Kruidvat Baby Pure waterdoekjes 12x62',KV+'kruidvat-baby-pure-waterdoekjes/p/4478027',744),
 (1,'kruidvat','Kruidvat','Kruidvat water babydoekjes 24x60',KV+'kruidvat-water-babydoekjes/p/6588405',1440),
 (1,'etos','WaterWipes','WaterWipes 48',ET+'waterwipes-billendoekjes-48-stuks-120762093.html',48),
 (1,'etos','WaterWipes','WaterWipes voordeeldoos 9x60',ET+'waterwipes-billendoekjes-voordeeldoos-9-x-60-stuks-120409468.html',540),
 (1,'etos','WaterWipes','WaterWipes 12x60',ET+'waterwipes-billendoekjes-12x60-stuks-120565671.html',720),
 (1,'etos','Etos','Etos Baby waterdoekjes 24x60',ET+'etos-baby-waterdoekjes-60x24-stuks-120602410.html',1440),
 (1,'hema','HEMA','HEMA babydoekjes 99.4% water 60','https://www.hema.nl/baby/babyverzorging/babydoekjes/babydoekjes-met-99.4%25-water-11335161.html',60),
 (1,'action','Huggies','Huggies Pure babydoekjes 56',AC+'2549970/huggies-pure-babydoekjes/',56),
 (1,'action','WaterWipes','Waterwipes babydoekjes 52',AC+'3226439/waterwipes-babydoekjes/',52),
 (1,'bol','Huggies','Huggies Pure 18x56',BOL+'huggies-billendoekjes-pure-99-water-1008-doekjes/9200000089243401/',1008),
 (1,'bol','Huggies','Huggies Pure 60x56',BOL+'huggies-pure-billendoekjes-3360-babydoekjes-60-x-56/9300000169515099/',3360),
 (1,'bol','WaterWipes','WaterWipes 4x60',BOL+'waterwipes-babydoekjes-4-x-60-stuks/9200000092517451/',240),
 (1,'bol','WaterWipes','WaterWipes Bio 12x60',BOL+'waterwipes-billendoekjes-bio-12-x-60-stuks-720-doekjes/9200000112216749/',720),
 # --- 2 vaatwastabletten
 (2,'picnic','Finish','Finish ultimate+ regular 30',PIC+'s1167126',30),
 (2,'picnic','Finish','Finish ultimate regular 27',PIC+'s1170334',27),
 (2,'picnic','Finish','Finish ultimate plus 47',PIC+'s1187686',47),
 (2,'picnic','Finish','Finish ultimate all-in-1 16',PIC+'s1187185',16),
 (2,'picnic','Finish','Finish ultimate plus citroen 32',PIC+'s1187196',32),
 (2,'picnic','Finish','Finish ultimate all-in-1 34',PIC+'s1145582',34),
 (2,'picnic','Dreft','Dreft platinum 51',PIC+'s1188633',51),
 (2,'picnic','Dreft','Dreft platinum citroen 39',PIC+'s1114092',39),
 (2,'picnic','Dreft','Dreft platinum citroen 66',PIC+'s1138919',66),
 (2,'picnic','Dreft','Dreft platinum plus 25',PIC+'s1188632',25),
 (2,'picnic','Dreft','Dreft platinum plus 48',PIC+'s1188634',48),
 (2,'ah','Finish','Finish Ultimate plus all in 1 18',AH+'wi550907/finish-ultimate-plus-all-in-1-vaatwastabletten',18),
 (2,'ah','Dreft','Dreft Platinum plus all in one 29',AH+'wi556438/dreft-platinum-plus-all-in-one',29),
 (2,'ah','Dreft','Dreft Platinum plus 6-pack 72',AH+'wi538460/dreft-platinum-plus-vaatwastabletten-6-pack',72),
 (2,'jumbo','Finish','Finish Ultimate Regular 16',J+'finish-ultimate-regular-16-753142ZK',16),
 (2,'jumbo','Finish','Finish Ultimate Regular 27',J+'finish-ultimate-all-in-one-regular-vaatwastabletten-25-capsules-620022ZK',27),
 (2,'jumbo','Finish','Finish Ultimate Plus Regular 18',J+'finish-ultimate-plus-all-in-one-regular-vaatwastabletten-22-capsules-688540ZK',18),
 (2,'jumbo','Dreft','Dreft Platinum All In One Original 34',J+'dreft-platinum-all-in-one-vaatwastabletten-original-34-capsules-620970ZK',34),
 (2,'jumbo','Dreft','Dreft Platinum All In One Original 39',J+'dreft-platinum-vaatwastabletten-regular-58-capsules-207349STK',39),
 (2,'jumbo','Dreft','Dreft Platinum Plus citroen 19',J+'dreft-platinum-plus-citroen-vaatwascapsules-19-stuks-738188ZK',19),
 (2,'jumbo','Dreft','Dreft Platinum Plus bries 25',J+'dreft-platinum-plus-bries-vaatwascapsules-25-x-738713ZK',25),
 (2,'plus','Finish','Finish Ultimate regular 26',PL+'finish-ultimate-regular-vaatwascapsules-zak-26-st-682631',26),
 (2,'plus','Dreft','Dreft Platinum plus original 25',PL+'dreft-platinum-plus-vaatwascapsules-original-zak-25-st-163552',25),
 (2,'plus','Dreft','Dreft Platinum plus citroen 72',PL+'dreft-platinum-plus-vaatwascapsules-citroen-zak-72-st-897566-897566',72),
 (2,'kruidvat','Finish','Finish Powerball Ultimate All-in-1 3x44',KV+'finish-powerball-ultimate-all-in-1-vaatwascapsules/p/6276954',132),
 (2,'kruidvat','Finish','Finish Powerball Ultimate Plus All-in-1 120',KV+'finish-powerball-ultimate-plus-all-in-1-vaatwascapsules/p/6276940',120),
 (2,'kruidvat','Dreft','Dreft Platinum All-In-One 204',KV+'dreft-platinum-all-in-one-vaatwascapsules/p/6500065',204),
 (2,'kruidvat','Dreft','Dreft Platinum Plus All-In-One 72',KV+'dreft-platinum-plus-all-in-one-vaatwascapsules/p/6026207',72),
 (2,'etos','Dreft','Dreft Platinum Plus citroen 30',ET+'dreft-vaatwas-platinum-plus-citroen-30-stuks-120909631.html',30),
 (2,'action','Dreft','Dreft Fresh Platinum citroen 66',AC+'3015624/dreft-fresh-platinum-vaatwastabletten-citroen/',66),
 (2,'action','Dreft','Dreft Fresh Platinum citroen 34',AC+'3015625/dreft-fresh-platinum-vaatwastabletten-citroen/',34),
 (2,'bol','Finish','Finish Ultimate Plus All in One citroen 33',BOL+'finish-ultimate-plus-all-in-one-citroen-vaatwastabletten-33-capsules/9300000139427896/',33),
 (2,'bol','Finish','Finish Ultimate regular halfjaarbox 188',BOL+'finish-ultimate-regular-188-capsules-halfjaarbox/9300000240771202/',188),
 (2,'bol','Dreft','Dreft Platinum Plus All In One 5x19',BOL+'dreft-platinum-plus-all-in-one-vaatwastabletten-voordeelverpakking-5x19-stuks/9300000023540540/',95),
 (2,'bol','Dreft','Dreft Platinum Plus All-in-One maxipack 150',BOL+'dreft-vaatwastabletten-platinum-plus-all-in-one-maxipack-150-tabletten-voordeelverpakking-4-stuks/9300000236602674/',150),
 (2,'amazon','Finish','Finish Ultimate+ All in 1 regular 73',AMZ+'B0BXLYKV5J',73),
 (2,'amazon','Finish','Finish Ultimate All in 1 citroen 80',AMZ+'B09HV4V2NM',80),
 (2,'amazon','Dreft','Dreft Platinum Plus All-in-One 4x59',AMZ+'B0G3XCPQL2',236),
 (2,'amazon','Dreft','Dreft Platinum Plus All In One lemon 95',AMZ+'B09FM5YWX5',95),
 (2,'amazon','Dreft','Dreft Platinum All In One regular 75',AMZ+'B0CMR2R4CK',75),
 # --- 3 Sensodyne (ml)
 (3,'picnic','Sensodyne','Repair & protect whitening',PIC+'s1013744',75),
 (3,'picnic','Sensodyne','Multicare',PIC+'s1001717',75),
 (3,'picnic','Sensodyne','ProGlasur',PIC+'s1010521',75),
 (3,'picnic','Sensodyne','Gentle whitening',PIC+'s1010557',75),
 (3,'picnic','Sensodyne','Rapid relief',PIC+'s1012832',75),
 (3,'picnic','Sensodyne','Fresh mint 2x75',PIC+'s1072730',150),
 (3,'picnic','Sensodyne','Fresh mint',PIC+'s1010502',75),
 (3,'picnic','Sensodyne','Repair & protect extra fresh',PIC+'s1072731',75),
 (3,'picnic','Sensodyne','Extra fresh gel',PIC+'s1011281',75),
 (3,'picnic','Sensodyne','Repair & protect',PIC+'s1012853',75),
 (3,'picnic','Sensodyne','Gentle whitening duo 2x75',PIC+'s1072735',150),
 (3,'ah','Sensodyne','Extra fresh',AH+'wi214399/sensodyne-extra-fresh-tandpasta',75),
 (3,'ah','Sensodyne','Rapid relief mint',AH+'wi414708/sensodyne-rapid-relief-mint-tandpasta',75),
 (3,'ah','Sensodyne','Gentle whitening',AH+'wi214397/sensodyne-gentle-whitening-tandpasta',75),
 (3,'ah','Sensodyne','Complete protection cool mint',AH+'wi218491/complete-protection-cool-mint-tandpasta',75),
 (3,'ah','Sensodyne','Gevoeligheid & tandvlees',AH+'wi450955/sensodyne-gevoeligheid-en-tandvlees-tandpasta',75),
 (3,'ah','Sensodyne','Repair & protect whitening',AH+'wi197268/sensodyne-repair-en-protect-whitening-tandpasta',75),
 (3,'ah','Sensodyne','Multi care',AH+'wi214643/sensodyne-multi-care-tandpasta',75),
 (3,'jumbo','Sensodyne','Repair & Protect Whitening',J+'sensodyne-repair-protect-whitening-tandpasta-voor-gevoelige-tanden-75-ml-415389DS',75),
 (3,'jumbo','Sensodyne','Fresh Mint',J+'sensodyne-fresh-mint-75-ml-tube-616707TUB',75),
 (3,'jumbo','Sensodyne','Repair & Protect Extra Fresh',J+'sensodyne-repair-protect-extra-fresh-tandpasta-75-ml-727280DS',75),
 (3,'jumbo','Sensodyne','Rapid Relief',J+'sensodyne-rapid-relief-tandpasta-voor-gevoelige-tanden-75-ml-431833DS',75),
 (3,'jumbo','Sensodyne','Gevoeligheid & Tandvlees Extra Fresh',J+'sensodyne-gevoeligheid-tandvlees-extra-fresh-tandpasta-voor-gevoelige-tanden-75-ml-451418DS',75),
 (3,'plus','Sensodyne','Extra fresh',PL+'sensodyne-tandpasta-extra-fresh-tube-75-ml-380307',75),
 (3,'plus','Sensodyne','Repair & protect',PL+'sensodyne-tandpasta-repair-protect-tube-75-ml-380324',75),
 (3,'plus','Sensodyne','ProGlasur daily protection',PL+'sensodyne-tandpasta-proglasur-daily-protection-tube-75-ml-380316',75),
 (3,'plus','Sensodyne','Rapid relief',PL+'sensodyne-rapid-relief-doos-75-ml-729271',75),
 (3,'plus','Sensodyne','Complete protection',PL+'sensodyne-tandpasta-complete-protection-doos-75-ml-322379',75),
 (3,'kruidvat','Sensodyne','Rapid Relief',KV+'sensodyne-rapid-relief-tandpasta/p/4121559',75),
 (3,'kruidvat','Sensodyne','Gentle Whitening',KV+'sensodyne/sensodyne-gentle-whitening-tandpasta/p/2882993',75),
 (3,'kruidvat','Sensodyne','Repair & Protect Extra Fresh',KV+'sensodyne/sensodyne-repair-protect-extra-fresh-tandpasta/p/4453177',75),
 (3,'kruidvat','Sensodyne','Complete Protection Cool Mint',KV+'sensodyne-complete-protection-cool-mint-tandpasta/p/2956710',75),
 (3,'kruidvat','Sensodyne','ProGlasur Fresh & Clean Multi Action',KV+'proglasur-fresh-clean-multi-action-tandpasta/p/2868671',75),
 (3,'etos','Sensodyne','Rapid Relief',ET+'sensodyne-rapid-relief-tandpasta-voor-gevoelige-tanden-75-ml-120267391.html',75),
 (3,'etos','Sensodyne','Repair & Protect Whitening',ET+'sensodyne-repair-protect-whitening-tandpasta-75-ml-111249132.html',75),
 (3,'etos','Sensodyne','Complete Protection+ Cool Mint',ET+'sensodyne-complete-protection-%2B-cool-mint-tandpasta---75-ml-112133115.html',75),
 (3,'etos','Sensodyne','Multicare',ET+'sensodyne-multicare-tandpasta-75-ml-112105528.html',75),
 (3,'action','Sensodyne','Anti-Cariës',AC+'2570113/sensodyne-tandpasta-anti-caries/',75),
 (3,'action','Sensodyne','Daily Protection',AC+'3210255/sensodyne-tandpasta-daily-protection/',75),
 (3,'bol','Sensodyne','Rapid Relief',BOL+'sensodyne-tandpasta-rapid-relief-75-ml/9200000077118993/',75),
 (3,'bol','Sensodyne','Fresh Mint',BOL+'sensodyne-tandpasta-fresh-mint-75-ml/9200000093185737/',75),
 (3,'bol','Sensodyne','Repair & Protect Deep Repair',BOL+'sensodyne-repair-protect-deep-repair-tandpasta-voor-gevoelige-tanden-75-ml/9300000019904769/',75),
 (3,'amazon','Sensodyne','Repair & Protect verse munt',AMZ+'B0BZQ7GXWD',75),
 (3,'amazon','Sensodyne','Repair & Protect Whitening',AMZ+'B01MA1DJ8O',75),
 # --- 4 Taft
 (4,'ah','Taft','Taft Power styling wax 75 ml',AH+'wi71456',75),
 (4,'kruidvat','Taft','Taft Hold 5 Power Styling Wax 75 ml',KV+'taft-hold-5-power-styling-wax/p/5374818',75),
 (4,'etos','Taft','Taft Styling Power Wax 75 ml',ET+'taft-styling-power-wax-75-ml-120541223.html',75),
 (4,'bol','Taft','Taft Power Wax 75 ml',BOL+'taft-power-wax-75-ml/9300000026201718/',75),
 (4,'bol','Taft','Taft Power Wax 6x75 ml',BOL+'taft-power-wax-6-x-75ml-grootverpakking/9300000026201688/',450),
 (4,'amazon','Taft','Taft Styling Wax Power houdgraad 5 75 ml',AMZ+'B08Y8SX5RR',75),
 # --- 5 Slimpie (liter)
 (5,'picnic','Slimpie','Slimpie siroop aardbei 650 ml',PIC+'s1163321',0.65),
 (5,'picnic','Slimpie','Slimpie siroop sinaasappel 650 ml',PIC+'s1002302',0.65),
 (5,'ah','Slimpie','Slimpie aardbei siroop 0% suiker 650 ml',AH+'wi500280/aardbei-siroop-0-suiker',0.65),
 (5,'ah','Slimpie','Slimpie sinaasappel siroop 0% suiker 650 ml',AH+'wi500279/sinaasappel-siroop-0-suiker',0.65),
 (5,'jumbo','Slimpie','Slimpie aardbei siroop 650 ml',J+'slimpie-aardbei-siroop-650-ml-441008FLS',0.65),
 (5,'jumbo','Slimpie','Slimpie sinaasappel siroop 650 ml',J+'slimpie-sinaasappel-siroop-650-ml-439988FLS',0.65),
 (5,'plus','Slimpie','Slimpie limonadesiroop aardbei 650 ml',PL+'slimpie-limonadesiroop-aardbei-fles-650-ml-649828',0.65),
]
CLOUD = {'jumbo', 'amazon'}  # zie VERKENNING.md
q = lambda s: "'" + str(s).replace("'", "''") + "'"
out = ['-- GEGENEREERD door seed/listings.py; niet met de hand bewerken.', 'DELETE FROM price_observation; DELETE FROM listing; DELETE FROM category; DELETE FROM sqlite_sequence;']
for cid, naam, e, b in CATS:
    out.append(f"INSERT INTO category (id, naam, eenheid, benchmark_prijs) VALUES ({cid}, {q(naam)}, {q(e)}, {'NULL' if b is None else b});")
seen = set()
for cid, w, merk, naam, url, n in L:
    assert url not in seen, url; seen.add(url)
    out.append(f"INSERT INTO listing (category_id, winkel, merk, productnaam, url, stuks_per_verpakking, scrape_methode) VALUES ({cid}, {q(w)}, {q(merk)}, {q(naam)}, {q(url)}, {n}, {q('cloud' if w in CLOUD else 'thuis')});")
# benchmark-listing: Huggies Pure 18x56 op Amazon
out.append("UPDATE category SET benchmark_listing_id = (SELECT id FROM listing WHERE url = 'https://www.amazon.nl/dp/B0111AIZ68') WHERE id = 1;")
open('seed/seed.sql', 'w').write('\n'.join(out) + '\n')
print(len(L), 'listings')
