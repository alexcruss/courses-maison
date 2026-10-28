// Recettes de base togolaises et ouest-africaines, en version simple :
// chaque foyer les ajuste à son goût (bouton « Modifier la recette »).
//
// Ingrédient : [aliment, quantité indicative, { alt: aliments acceptés à la place, opt: facultatif }]
// Un plat est « réalisable » quand tous ses ingrédients non facultatifs sont en stock.

const r = (id, nom, type, emoji, portions, duree, accompagnement, ingredients, etapes) => ({
  id, nom, type, emoji, portions, duree, accompagnement, source: 'base',
  ingredients: ingredients.map(([aid, q, o = {}]) => ({ id: aid, q, alt: o.alt || [], opt: Boolean(o.opt) })),
  etapes,
});

const VIANDE_OU_POISSON = ['boeuf', 'mouton', 'poulet', 'crabe', 'poisson-frais'];

export const RECETTES = [
  r('akoume', 'Pâte de maïs (akoumé)', 'Pâte', '🌽', 6, 30, 'Gboma dessi, fétri dessi, adémè ou sauce claire', [
    ['farine-mais', '1 kg', { alt: ['pate-mais'] }],
    ['sel', '1 pincée'],
  ], [
    "Délayer environ un tiers de la farine dans 50 cl d'eau froide.",
    "Porter 1,5 L d'eau légèrement salée à ébullition et y verser le mélange en remuant : on obtient une bouillie.",
    "Ajouter le reste de la farine petit à petit en tournant énergiquement avec la spatule, jusqu'à une pâte ferme et lisse.",
    "Couvrir et laisser cuire 5 à 10 minutes à feu doux, puis retourner une dernière fois.",
    "Former les boules avec un bol mouillé.",
  ]),

  r('gboma-dessi', 'Gboma dessi', 'Sauce', '🥬', 6, 60, 'Pâte de maïs, riz blanc ou igname bouillie', [
    ['gboma', '3 bottes'],
    ['poisson-fume', '2 pièces', { alt: VIANDE_OU_POISSON }],
    ['tomate', '1 kg'],
    ['oignon', '2'],
    ['piment', '3 ou 4'],
    ['huile-palme', '20 cl'],
    ['cube', '2'],
    ['crevettes-sechees', '1 poignée', { opt: true }],
    ['ail', '3 gousses', { opt: true }],
    ['sel', ''],
  ], [
    "Laver le gboma, le hacher grossièrement, le blanchir 5 minutes à l'eau bouillante, puis l'égoutter et bien l'essorer.",
    "Cuire la viande, ou nettoyer le poisson fumé, avec un oignon, l'ail, le sel et un cube dans un peu d'eau.",
    "Faire chauffer l'huile rouge, y faire revenir l'autre oignon émincé, puis ajouter les tomates et le piment mixés. Laisser réduire 15 minutes.",
    "Ajouter la viande avec son jus, le poisson fumé et les crevettes séchées, puis mijoter 10 minutes.",
    "Incorporer le gboma, mélanger et cuire 10 à 15 minutes à feu doux. Rectifier le sel.",
  ]),

  r('ademe-dessi', 'Adémè dessi', 'Sauce', '🌿', 6, 45, 'Pâte de maïs (akoumé)', [
    ['ademe', '4 bottes'],
    ['poisson-fume', '2 pièces', { alt: VIANDE_OU_POISSON }],
    ['huile-palme', '15 cl'],
    ['oignon', '1'],
    ['piment', '3'],
    ['cube', '2'],
    ['tomate', '3', { opt: true }],
    ['gombo', '1 tas', { opt: true }],
    ['potasse', '1 pincée', { opt: true }],
    ['sel', ''],
  ], [
    "Effeuiller l'adémè, le laver et le hacher finement.",
    "Cuire la viande ou le poisson fumé avec l'oignon, le sel et un cube dans un peu d'eau.",
    "Ajouter l'huile rouge, le piment écrasé et, si vous aimez, les tomates mixées. Laisser cuire 10 minutes.",
    "Ajouter l'adémè (et le gombo haché) avec une pincée de potasse pour qu'il soit bien gluant. Battre et cuire 5 à 10 minutes sans couvrir pour qu'il reste vert.",
  ]),

  r('fetri-dessi', 'Fétri dessi (sauce gombo)', 'Sauce', '🍲', 6, 45, 'Pâte de maïs, akoumé ou riz', [
    ['gombo', '2 tas'],
    ['poisson-fume', '2 pièces', { alt: VIANDE_OU_POISSON }],
    ['huile-palme', '15 cl'],
    ['oignon', '1'],
    ['piment', '3'],
    ['cube', '2'],
    ['tomate', '3', { opt: true }],
    ['crevettes-sechees', '1 poignée', { opt: true }],
    ['potasse', '1 pincée', { opt: true }],
    ['sel', ''],
  ], [
    "Laver les gombos, couper les extrémités, puis les hacher finement ou les écraser.",
    "Cuire la viande, le crabe ou le poisson fumé avec l'oignon, le sel et un cube dans un peu d'eau.",
    "Ajouter l'huile rouge, le piment et les tomates mixées ; cuire 10 minutes.",
    "Ajouter le gombo et les crevettes séchées, battre et cuire 5 à 10 minutes sans couvrir.",
  ]),

  r('azindessi', 'Sauce arachide (azindessi)', 'Sauce', '🥜', 6, 75, 'Riz blanc, fufu ou pâte de maïs', [
    ['pate-arachide', '1 pot (400 g)'],
    ['poulet', '1', { alt: ['boeuf', 'mouton', 'poisson-fume'] }],
    ['tomate', '4'],
    ['oignon', '2'],
    ['piment', '2'],
    ['cube', '2'],
    ['tomate-concentree', '1 petite boîte', { opt: true }],
    ['ail', '3 gousses', { opt: true }],
    ['gingembre', '1 morceau', { opt: true }],
    ['sel', ''],
  ], [
    "Découper la viande, l'assaisonner (sel, ail, gingembre, un cube) et la faire revenir avec un oignon émincé.",
    "Ajouter les tomates mixées et la tomate concentrée ; cuire 10 minutes.",
    "Délayer la pâte d'arachide dans de l'eau tiède, la verser avec 1 L d'eau, puis ajouter le piment entier et le second cube.",
    "Laisser mijoter 40 minutes à feu doux en remuant de temps en temps : c'est prêt quand l'huile de l'arachide remonte en surface.",
  ]),

  r('sauce-graine', 'Sauce graine (noix de palme)', 'Sauce', '🌴', 6, 90, 'Fufu, riz ou pâte de maïs', [
    ['noix-palme', '1 tas, ou 1 boîte de crème'],
    ['poisson-fume', '2 pièces', { alt: VIANDE_OU_POISSON }],
    ['oignon', '1'],
    ['piment', '2'],
    ['cube', '2'],
    ['tomate', '3', { opt: true }],
    ['sel', ''],
  ], [
    "Faire bouillir les noix de palme 20 à 30 minutes, les piler, puis les malaxer avec de l'eau chaude et filtrer pour récupérer le jus. Avec de la crème de palme en boîte, la délayer simplement dans 1 L d'eau.",
    "Cuire la viande ou le poisson avec l'oignon, le sel et un cube.",
    "Verser le jus de palme, ajouter le piment, les tomates et l'autre cube.",
    "Laisser cuire 45 minutes environ à feu moyen, jusqu'à ce que la sauce épaississe et que l'huile remonte.",
  ]),

  r('sauce-claire', 'Sauce claire au poisson', 'Sauce', '🐠', 4, 40, 'Pâte de maïs, fufu ou riz', [
    ['poisson-frais', '1 kg'],
    ['tomate', '4'],
    ['oignon', '1'],
    ['piment', '2'],
    ['cube', '1'],
    ['gingembre', '1 morceau', { opt: true }],
    ['sel', ''],
  ], [
    "Écailler, vider et laver le poisson, le couper en morceaux, puis le saler.",
    "Faire bouillir les tomates entières, l'oignon et le piment dans 1 L d'eau pendant 10 minutes, puis les écraser ou les mixer et les remettre dans la marmite.",
    "Ajouter le gingembre râpé, le cube et le sel, puis le poisson.",
    "Cuire 15 minutes à feu doux sans remuer, pour que le poisson reste entier.",
  ]),

  r('fufu', "Fufu d'igname", 'Pâte', '🍠', 4, 50, 'Sauce arachide, sauce graine ou sauce claire', [
    ['igname', '1 grosse'],
  ], [
    "Éplucher l'igname, la couper en gros morceaux et la laver.",
    "La cuire à l'eau 20 à 30 minutes, jusqu'à ce qu'elle soit bien tendre.",
    "Piler au mortier en ajoutant un peu d'eau de cuisson, jusqu'à une pâte lisse et élastique.",
    "Former des boules avec les mains mouillées et servir chaud.",
  ]),

  r('ayimolou', 'Ayimolou (riz-haricot)', 'Riz', '🍚', 6, 75, 'Sauce tomate pimentée, gari, œufs durs, wagassi frit ou avocat', [
    ['riz', '500 g'],
    ['haricot', '300 g'],
    ['sel', ''],
  ], [
    "Trier et laver les haricots, puis les cuire à l'eau 45 minutes à 1 heure, jusqu'à ce qu'ils soient presque tendres.",
    "Ajouter le riz lavé et de l'eau salée (environ une fois et demie le volume du riz).",
    "Couvrir et cuire 20 minutes à feu doux, jusqu'à ce que l'eau soit absorbée.",
    "Servir avec la sauce tomate pimentée et du gari.",
  ]),

  r('sauce-tomate-pimentee', 'Sauce tomate pimentée', 'Sauce', '🌶️', 6, 40, 'Ayimolou, ablo, kom, igname ou alloco', [
    ['tomate', '1 kg'],
    ['oignon', '2'],
    ['piment', '4'],
    ['huile', '25 cl'],
    ['cube', '2'],
    ['tomate-concentree', '1 petite boîte', { opt: true }],
    ['ail', '3 gousses', { opt: true }],
    ['gingembre', '1 morceau', { opt: true }],
    ['sel', ''],
  ], [
    "Mixer les tomates avec le piment, l'ail et le gingembre.",
    "Faire chauffer l'huile et y faire dorer les oignons émincés.",
    "Ajouter la tomate concentrée, puis le mixage, le sel et les cubes.",
    "Cuire 25 à 30 minutes à feu doux en remuant, jusqu'à ce que l'huile remonte. On peut y ajouter du poisson frit ou des œufs durs.",
  ]),

  r('riz-au-gras', 'Riz au gras', 'Riz', '🍛', 6, 60, 'Salade, alloco ou poisson frit', [
    ['riz', '1 kg'],
    ['tomate-concentree', '1 boîte'],
    ['tomate', '4'],
    ['oignon', '2'],
    ['huile', '20 cl'],
    ['cube', '3'],
    ['poulet', '1', { alt: ['boeuf', 'mouton', 'poisson-frais'], opt: true }],
    ['carotte', '3', { opt: true }],
    ['poivron', '1', { opt: true }],
    ['ail', '3 gousses', { opt: true }],
    ['piment', '1', { opt: true }],
    ['sel', ''],
  ], [
    "Assaisonner la viande, la faire dorer dans l'huile, puis la réserver.",
    "Dans la même huile, faire revenir les oignons, puis la tomate concentrée 5 minutes, puis les tomates mixées. Cuire 10 minutes.",
    "Ajouter 1,5 L d'eau (ou le bouillon de la viande), les cubes, le sel et le piment ; porter à ébullition.",
    "Verser le riz lavé, couvrir et cuire 20 à 25 minutes à feu doux. Ajouter les carottes et le poivron coupés à mi-cuisson.",
    "Servir avec la viande posée dessus.",
  ]),

  r('djenkoume', 'Djenkoumé (pâte rouge)', 'Pâte', '🍅', 6, 45, 'Poulet ou poisson frit, piment', [
    ['farine-mais', '750 g'],
    ['tomate-concentree', '1 boîte'],
    ['oignon', '2'],
    ['huile', '15 cl'],
    ['piment', '2'],
    ['cube', '2'],
    ['tomate', '3', { opt: true }],
    ['ail', '2 gousses', { opt: true }],
    ['sel', ''],
  ], [
    "Faire revenir les oignons dans l'huile, ajouter la tomate concentrée, les tomates mixées, le piment, l'ail, le sel et les cubes. Cuire 10 minutes.",
    "Ajouter environ 1,5 L d'eau et porter à ébullition.",
    "Verser la farine de maïs en pluie en remuant vigoureusement, jusqu'à une pâte ferme et lisse.",
    "Couvrir et cuire 10 minutes à feu doux, puis servir avec le poulet ou le poisson frit.",
  ]),

  r('koklo-meme', 'Koklo mémé (poulet grillé)', 'Grillade', '🍗', 4, 90, 'Djenkoumé (pâte rouge), riz ou alloco', [
    ['poulet', '1'],
    ['oignon', '2'],
    ['ail', '4 gousses'],
    ['gingembre', '1 morceau'],
    ['piment', '2'],
    ['cube', '2'],
    ['huile', '5 cl'],
    ['citron', '1', { opt: true }],
    ['sel', ''],
  ], [
    "Découper le poulet. Mixer les oignons, l'ail, le gingembre, le piment, les cubes, le jus de citron et l'huile.",
    "Bien enrober le poulet de cette marinade et le laisser reposer au moins 1 heure (ou une nuit au frigo).",
    "Précuire le poulet 20 minutes à couvert avec la marinade et un peu d'eau.",
    "Le griller au charbon ou au four en le badigeonnant de marinade, jusqu'à ce que la peau soit bien dorée.",
  ]),

  r('alloco', 'Alloco (plantain frit)', 'Friture', '🍌', 4, 20, 'Sauce tomate pimentée, poisson frit ou œufs', [
    ['plantain', '4 bien mûres'],
    ['huile', '50 cl'],
    ['sel', ''],
    ['piment', '', { opt: true }],
  ], [
    "Éplucher les bananes plantains et les couper en rondelles ou en biais.",
    "Les saler légèrement.",
    "Les frire 3 à 4 minutes dans l'huile bien chaude, jusqu'à ce qu'elles soient dorées, puis les égoutter.",
  ]),

  r('igname-frite', 'Igname frite', 'Friture', '🍟', 4, 30, 'Piment écrasé, sauce tomate pimentée ou poisson frit', [
    ['igname', '1'],
    ['huile', '50 cl'],
    ['sel', ''],
  ], [
    "Éplucher l'igname, la couper en bâtonnets et la laver.",
    "Si vous aimez un cœur fondant, la précuire 5 minutes dans l'eau salée, puis bien l'égoutter.",
    "La frire dans l'huile chaude jusqu'à ce qu'elle soit dorée et croustillante.",
  ]),

  r('kaklo', 'Kaklo (beignets de banane mûre)', 'Friture', '🍩', 4, 30, 'Arachides grillées ou bouillie', [
    ['plantain', '4 très mûres'],
    ['farine-mais', '3 cuillères', { alt: ['farine-ble'] }],
    ['oignon', '1'],
    ['piment', '1'],
    ['huile', '50 cl'],
    ['gingembre', '1 morceau', { opt: true }],
    ['sel', ''],
  ], [
    "Écraser les plantains très mûrs en purée.",
    "Ajouter l'oignon, le gingembre et le piment mixés, le sel, puis assez de farine pour obtenir une pâte épaisse.",
    "Former des boulettes et les frire 4 à 5 minutes dans l'huile chaude, jusqu'à ce qu'elles soient bien brunes.",
  ]),

  r('agbeli-kaklo', 'Agbéli kaklo (beignets de manioc)', 'Friture', '🥥', 4, 40, 'Noix de coco ou arachides grillées', [
    ['manioc', '1 kg'],
    ['oignon', '1'],
    ['piment', '1'],
    ['huile', '50 cl'],
    ['sel', ''],
  ], [
    "Éplucher et râper le manioc, puis le presser fortement dans un linge pour en retirer le jus.",
    "Émietter la pâte et y mélanger l'oignon haché fin, le piment et le sel.",
    "Former des boulettes ou des petits boudins et les frire dans l'huile chaude jusqu'à ce qu'ils soient dorés.",
  ]),

  r('ablo', 'Ablo', 'Pâte', '🍙', 6, 60, 'Sauce tomate pimentée et poisson frit, ou crevettes', [
    ['pate-mais', '1 kg', { alt: ['farine-mais'] }],
    ['riz', '250 g'],
    ['sucre', '4 cuillères'],
    ['levure', '1 sachet'],
    ['sel', '1 cuillère'],
  ], [
    "Faire tremper le riz 2 heures, puis le mixer finement avec un peu d'eau (ou utiliser de la farine de riz).",
    "Cuire un quart de la pâte de maïs avec de l'eau pour faire une bouillie épaisse, et la laisser tiédir.",
    "Mélanger la bouillie, le reste de la pâte, le riz mixé, le sucre, le sel et la levure délayée dans de l'eau tiède. Couvrir et laisser lever 2 à 3 heures au chaud.",
    "Verser dans de petits moules ou des ramequins huilés et cuire 15 à 20 minutes à la vapeur.",
  ]),

  r('kom-poisson', 'Kom, poisson frit et piment', 'Plat', '🫔', 4, 30, 'Piment frais écrasé', [
    ['kom', '4 boules'],
    ['poisson-frais', '1 kg'],
    ['huile', '50 cl'],
    ['piment', '4'],
    ['oignon', '1'],
    ['tomate', '2'],
    ['sel', ''],
  ], [
    "Vider, laver et saler le poisson, puis le frire dans l'huile chaude jusqu'à ce qu'il soit croustillant.",
    "Écraser le piment, l'oignon et les tomates avec un peu de sel pour faire le piment frais.",
    "Servir le kom, réchauffé à la vapeur si besoin, avec le poisson et le piment.",
  ]),

  r('atieke-poisson', 'Atiéké poisson', 'Plat', '🐟', 4, 30, 'Crudités et piment', [
    ['atieke', '4 sachets'],
    ['poisson-frais', '1 kg'],
    ['huile', '50 cl'],
    ['oignon', '2'],
    ['tomate', '3'],
    ['piment', '2'],
    ['concombre', '1', { opt: true }],
    ['cube', '1', { opt: true }],
    ['sel', ''],
  ], [
    "Assaisonner le poisson (sel, cube) et le frire dans l'huile chaude.",
    "Couper les oignons, les tomates, le concombre et le piment en petits dés.",
    "Réchauffer l'atiéké à la vapeur, puis le servir avec le poisson, les crudités et un peu d'huile de friture.",
  ]),

  r('haricots-huile-rouge', "Haricots à l'huile rouge", 'Plat', '🫘', 4, 75, 'Gari et alloco', [
    ['haricot', '500 g'],
    ['huile-palme', '15 cl', { alt: ['huile'] }],
    ['oignon', '2'],
    ['tomate', '3'],
    ['piment', '2'],
    ['cube', '1'],
    ['gari', '', { opt: true }],
    ['sel', ''],
  ], [
    "Cuire les haricots à l'eau 45 minutes à 1 heure, jusqu'à ce qu'ils soient tendres, puis les égoutter.",
    "Faire chauffer l'huile rouge, y faire revenir les oignons, puis les tomates et le piment mixés, le cube et le sel. Cuire 15 minutes.",
    "Ajouter les haricots, mélanger et laisser mijoter 10 minutes. Servir avec du gari et de l'alloco.",
  ]),

  r('omelette', 'Omelette à la tomate', 'Plat', '🍳', 2, 15, 'Pain, riz, igname ou alloco', [
    ['oeufs', '4'],
    ['oignon', '1'],
    ['tomate', '2'],
    ['huile', '2 cuillères'],
    ['piment', '1', { opt: true }],
    ['sel', ''],
  ], [
    "Couper l'oignon, la tomate et le piment en petits dés.",
    "Battre les œufs avec le sel, puis y mélanger les légumes.",
    "Cuire dans l'huile chaude à feu moyen, 2 à 3 minutes de chaque côté.",
  ]),

  r('bouillie-mil', 'Bouillie de mil', 'Bouillie', '🥣', 4, 20, 'Beignets, kaklo ou pain', [
    ['farine-mil', '200 g'],
    ['sucre', 'selon le goût'],
    ['citron', '1', { opt: true }],
    ['gingembre', '1 morceau', { opt: true }],
    ['lait-poudre', '', { opt: true, alt: ['lait-concentre', 'lait-frais'] }],
  ], [
    "Délayer la farine dans 50 cl d'eau froide.",
    "Porter 1 L d'eau à ébullition avec le gingembre écrasé, puis verser la farine délayée en remuant sans arrêt.",
    "Cuire 10 à 15 minutes à feu doux en remuant.",
    "Sucrer, ajouter le jus de citron, et du lait si vous aimez.",
  ]),
];
