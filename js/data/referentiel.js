// Listes de référence partagées par tous les écrans.

export const LIEUX = [
  { id: 'marche', nom: 'Marché', icone: '🧺' },
  { id: 'supermarche', nom: 'Supermarché', icone: '🛒' },
  { id: 'boutique', nom: 'Boutique', icone: '🏪' },
];

// Emplacements du stock. « conseil » sert dans le guide de conservation.
export const EMPLACEMENTS = [
  { id: 'reserve', nom: 'Réserve', icone: '🏠', conseil: 'Hors du frigo' },
  { id: 'frigo', nom: 'Frigo', icone: '❄️', conseil: 'Au frigo' },
  { id: 'congelateur', nom: 'Congélateur', icone: '🧊', conseil: 'Au congélateur' },
];
export const EMPL = Object.fromEntries(EMPLACEMENTS.map((e) => [e.id, e]));

export const CATEGORIES = [
  { id: 'feuilles', nom: 'Légumes-feuilles', icone: '🥬' },
  { id: 'legumes', nom: 'Légumes', icone: '🍅' },
  { id: 'tubercules', nom: 'Tubercules et plantains', icone: '🍠' },
  { id: 'fruits', nom: 'Fruits', icone: '🥭' },
  { id: 'cereales', nom: 'Céréales, farines et graines', icone: '🌾' },
  { id: 'viandes', nom: 'Viandes et œufs', icone: '🍗' },
  { id: 'poissons', nom: 'Poissons et fruits de mer', icone: '🐟' },
  { id: 'laitiers', nom: 'Produits laitiers', icone: '🥛' },
  { id: 'condiments', nom: 'Condiments et épices', icone: '🧂' },
  { id: 'huiles', nom: 'Huiles', icone: '🫒' },
  { id: 'epicerie', nom: 'Épicerie et conserves', icone: '🥫' },
  { id: 'prepares', nom: 'Pain et plats préparés', icone: '🍞' },
  { id: 'boissons', nom: 'Boissons', icone: '🧃' },
  { id: 'entretien', nom: 'Entretien et maison', icone: '🧼' },
  { id: 'autre', nom: 'Autres', icone: '🛍️' },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const UNITES = [
  'pièce', 'kg', 'g', 'L', 'tas', 'bol', 'botte', 'sachet', 'boîte', 'bouteille',
  'paquet', 'sac', 'pot', 'boule', 'plateau', 'pack', 'tête', 'morceau', 'régime',
];

// Types de recettes : emoji et teinte de l'assiette sur les cartes.
export const TYPES_RECETTE = [
  { id: 'Sauce', nom: 'Sauces', emoji: '🍲', teinte: '#f7a23b' },
  { id: 'Pâte', nom: 'Pâtes', emoji: '🌽', teinte: '#ffcf3f' },
  { id: 'Riz', nom: 'Riz', emoji: '🍚', teinte: '#f4b860' },
  { id: 'Plat', nom: 'Plats', emoji: '🍽️', teinte: '#9ccb63' },
  { id: 'Friture', nom: 'Fritures', emoji: '🍌', teinte: '#f2b84b' },
  { id: 'Grillade', nom: 'Grillades', emoji: '🍗', teinte: '#ee7b3a' },
  { id: 'Bouillie', nom: 'Bouillies', emoji: '🥣', teinte: '#e6c98f' },
  { id: 'Autre', nom: 'Autres', emoji: '🍴', teinte: '#c9b8a6' },
];
export const TYPE = Object.fromEntries(TYPES_RECETTE.map((t) => [t.id, t]));
