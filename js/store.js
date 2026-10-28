// Données du foyer, enregistrées sur ce téléphone (localStorage).
// Chaque enregistrement porte id, majLe, majPar et supprime : ces champs
// serviront à la synchronisation avec Firebase en phase 2.

import { uid, maintenant, parNom } from './util.js';
import { ALIMENTS } from './data/aliments.js';
import { RECETTES } from './data/recettes.js';

const CLE = 'assimeto:v1';
const COLLECTIONS = ['liste', 'stock', 'recettes', 'aliments'];
const OUBLI_SUPPRESSIONS = 60 * 86400000; // on oublie les suppressions après 60 jours

const vide = () => ({
  version: 1,
  reglages: { prenom: '', bienvenueVue: false },
  liste: {}, stock: {}, recettes: {}, aliments: {},
});

let etat = charger();
let enLot = 0;
const abonnes = new Set();

function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return nettoyer(JSON.parse(brut));
  } catch (err) {
    console.error('Lecture des données impossible', err);
  }
  return vide();
}

function nettoyer(donnees) {
  const e = { ...vide(), ...donnees, reglages: { ...vide().reglages, ...donnees.reglages } };
  const limite = Date.now() - OUBLI_SUPPRESSIONS;
  for (const c of COLLECTIONS) {
    e[c] = { ...e[c] };
    for (const [id, r] of Object.entries(e[c])) {
      if (r.supprime && Date.parse(r.majLe) < limite) delete e[c][id];
    }
  }
  return e;
}

function enregistrer() {
  if (enLot) return;
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
  } catch (err) {
    console.error(err);
    alert("Impossible d'enregistrer : la mémoire du téléphone est peut-être pleine.");
  }
  abonnes.forEach((f) => f());
}

// Regroupe plusieurs écritures : une seule sauvegarde et un seul rafraîchissement.
export function lot(fn) {
  enLot++;
  try {
    return fn();
  } finally {
    enLot--;
    enregistrer();
  }
}

export const abonner = (f) => {
  abonnes.add(f);
  return () => abonnes.delete(f);
};

export const tous = (c) => Object.values(etat[c]).filter((r) => !r.supprime);
export const lire = (c, id) => {
  const r = etat[c][id];
  return r && !r.supprime ? r : null;
};

export function ecrire(c, rec) {
  const r = { ...rec, id: rec.id || uid(), majLe: maintenant(), majPar: etat.reglages.prenom || null, supprime: false };
  etat[c][r.id] = r;
  enregistrer();
  return r;
}

export function supprimer(c, id) {
  if (!etat[c][id]) return;
  etat[c][id] = { id, supprime: true, majLe: maintenant(), majPar: etat.reglages.prenom || null };
  enregistrer();
}

export const reglages = () => etat.reglages;
export function majReglages(patch) {
  etat.reglages = { ...etat.reglages, ...patch };
  enregistrer();
}

// Catalogue : base livrée avec l'appli + modifications et aliments du foyer.
const BASE = new Map(ALIMENTS.map((x) => [x.id, x]));

export function aliment(id) {
  if (!id) return null;
  const base = BASE.get(id);
  const perso = lire('aliments', id);
  if (!base && !perso) return null;
  return { ...base, ...perso, cons: { ...base?.cons, ...perso?.cons }, alias: base?.alias || perso?.alias || [], perso: !base };
}

export function catalogue() {
  const ids = new Set([...BASE.keys(), ...tous('aliments').map((x) => x.id)]);
  return [...ids].map(aliment).filter(Boolean).sort(parNom);
}

export function majAliment(id, patch) {
  const actuel = lire('aliments', id) || { id };
  return ecrire('aliments', { ...actuel, ...patch, id });
}

export function creerAliment({ nom, cat = 'autre', unite = 'pièce', lieu = 'marche' }) {
  return ecrire('aliments', {
    id: `perso-${uid()}`, nom, cat, unite, lieu, alias: [],
    cons: { ou: 'reserve', duree: '', conseil: '', apres: null },
  });
}

export const estAlimentDeBase = (id) => BASE.has(id);

// Recettes : base (éventuellement modifiée ou masquée) + recettes du foyer.
const RECETTES_BASE = new Map(RECETTES.map((x) => [x.id, x]));

export function recettes() {
  const parId = new Map(RECETTES_BASE);
  for (const p of tous('recettes')) parId.set(p.id, p);
  return [...parId.values()].filter((x) => !x.masquee).sort(parNom);
}

export function recette(id) {
  const r = lire('recettes', id) || RECETTES_BASE.get(id) || null;
  return r && !r.masquee ? r : null;
}

export const estRecetteDeBase = (id) => RECETTES_BASE.has(id);

// Sauvegarde dans un fichier et restauration.
export function exporter() {
  return JSON.stringify({ app: 'assimeto', exporteLe: maintenant(), ...etat });
}

export function importer(texte) {
  const d = JSON.parse(texte);
  if (d.app !== 'assimeto' || !COLLECTIONS.every((c) => d[c] && typeof d[c] === 'object')) {
    throw new Error("Ce fichier n'est pas une sauvegarde ASSIMETO.");
  }
  delete d.app;
  delete d.exporteLe;
  etat = nettoyer(d);
  enregistrer();
}

export function toutEffacer() {
  etat = { ...vide(), reglages: etat.reglages };
  enregistrer();
}

export const compter = () => Object.fromEntries(COLLECTIONS.map((c) => [c, tous(c).length]));
