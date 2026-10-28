// Règles métier : liste de courses, fin des courses, stock et plats réalisables.

import { tous, lire, ecrire, supprimer, lot, aliment, majAliment, recettes, catalogue } from './store.js';
import { LIEUX } from './data/referentiel.js';
import { maintenant, norm, fcfa, qteUnite } from './util.js';

export const nomDe = (item) => aliment(item.alimentId)?.nom || '(aliment supprimé)';

// ——— Liste de courses ———

export const prixUnitaire = (item) => aliment(item.alimentId)?.prix || 0;
export const estimation = (item) => (item.quantite || 0) * prixUnitaire(item);
export const montant = (item) => (item.achete && item.prixPaye != null ? item.prixPaye : estimation(item));

export function totaux(items) {
  let reste = 0;
  let depense = 0;
  for (const it of items) {
    if (it.achete) depense += montant(it);
    else reste += montant(it);
  }
  return { reste, depense };
}

export const dansLaListe = (alimentId) => tous('liste').some((i) => !i.achete && i.alimentId === alimentId);

// Ajoute un article, ou augmente la quantité s'il est déjà sur la liste dans la même unité.
export function ajouterALaListe(alimentId, quantite, unite) {
  const al = aliment(alimentId);
  const u = unite || al?.unite || 'pièce';
  const existant = tous('liste').find((i) => !i.achete && i.alimentId === alimentId && i.unite === u);
  if (existant) {
    ecrire('liste', { ...existant, quantite: (existant.quantite || 0) + (quantite || 1) });
    return 'fusion';
  }
  ecrire('liste', {
    alimentId, quantite: quantite || 1, unite: u, lieu: al?.lieu || 'marche',
    achete: false, prixPaye: null, ajouteLe: maintenant(),
  });
  return 'ajout';
}

// Range les articles cochés dans le stock, à l'endroit conseillé, et retient le prix payé.
export function terminerCourses() {
  const achetes = tous('liste').filter((i) => i.achete);
  const ranges = { reserve: [], frigo: [], congelateur: [] };
  lot(() => {
    for (const it of achetes) {
      const al = aliment(it.alimentId);
      if (al && it.prixPaye && it.quantite) majAliment(al.id, { prix: Math.round(it.prixPaye / it.quantite) });
      const deja = tous('stock').find((s) => s.alimentId === it.alimentId && s.unite === it.unite);
      const ou = deja?.emplacement || al?.cons?.ou || 'reserve';
      if (deja) {
        ecrire('stock', { ...deja, quantite: (deja.quantite || 0) + (it.quantite || 0), ajouteLe: maintenant() });
      } else {
        ecrire('stock', {
          alimentId: it.alimentId, emplacement: ou, quantite: it.quantite || 1,
          unite: it.unite, seuil: 0, ajouteLe: maintenant(),
        });
      }
      if (!ranges[ou].includes(it.alimentId)) ranges[ou].push(it.alimentId);
      supprimer('liste', it.id);
    }
  });
  return ranges;
}

export function texteListe() {
  const items = tous('liste').filter((i) => !i.achete);
  const lignes = [`🛒 Liste de courses du ${new Date().toLocaleDateString('fr-FR')}`];
  for (const lieu of LIEUX) {
    const duLieu = items.filter((i) => i.lieu === lieu.id).sort((a, b) => nomDe(a).localeCompare(nomDe(b), 'fr'));
    if (!duLieu.length) continue;
    lignes.push('', `${lieu.icone} ${lieu.nom.toUpperCase()}`);
    for (const i of duLieu) {
      const p = estimation(i);
      lignes.push(`• ${nomDe(i)} : ${qteUnite(i.quantite, i.unite)}${p ? ` (≈ ${fcfa(p)})` : ''}`);
    }
  }
  const { reste } = totaux(items);
  if (reste) lignes.push('', `Total estimé : ${fcfa(reste)}`);
  return lignes.join('\n');
}

// ——— Stock ———

export const estBas = (s) => (s.quantite || 0) <= (s.seuil || 0);

// Ajoute au stock à l'emplacement choisi, ou augmente la quantité existante.
export function ajouterAuStock(alimentId, emplacement, quantite, unite) {
  const al = aliment(alimentId);
  const u = unite || al?.unite || 'pièce';
  const deja = tous('stock').find((s) => s.alimentId === alimentId && s.emplacement === emplacement && s.unite === u);
  if (deja) {
    ecrire('stock', { ...deja, quantite: (deja.quantite || 0) + (quantite || 1), ajouteLe: maintenant() });
    return 'fusion';
  }
  ecrire('stock', { alimentId, emplacement, quantite: quantite || 1, unite: u, seuil: 0, ajouteLe: maintenant() });
  return 'ajout';
}

export function changerQuantite(id, delta) {
  const s = lire('stock', id);
  if (s) ecrire('stock', { ...s, quantite: Math.max(0, Math.round(((s.quantite || 0) + delta) * 100) / 100) });
}

// Après avoir cuisiné : met à zéro les produits finis et les remet sur la liste.
export function marquerEpuises(alimentIds, versListe) {
  lot(() => {
    for (const s of tous('stock')) if (alimentIds.includes(s.alimentId)) ecrire('stock', { ...s, quantite: 0 });
    if (versListe) alimentIds.forEach((id) => { if (!dansLaListe(id)) ajouterALaListe(id); });
  });
}

// ——— Plats réalisables ———

export function analyseStock() {
  const presents = new Set();
  const auFrigo = new Set();
  for (const s of tous('stock')) {
    if (s.quantite > 0) {
      presents.add(s.alimentId);
      if (s.emplacement === 'frigo') auFrigo.add(s.alimentId);
    }
  }
  return { presents, auFrigo };
}

const choix = (ing) => [ing.id, ...(ing.alt || [])];
export const ingredientDispo = (ing, stock) => choix(ing).some((id) => stock.presents.has(id) || aliment(id)?.basique);
export const ingredientsEnStock = (ing, stock) => choix(ing).filter((id) => stock.presents.has(id));

export function analyser(rec, stock = analyseStock()) {
  const manquants = rec.ingredients.filter((i) => !i.opt && !ingredientDispo(i, stock));
  const frais = rec.ingredients.filter((i) => choix(i).some((id) => stock.auFrigo.has(id))).length;
  return { rec, manquants, frais, ok: manquants.length === 0 };
}

export function suggestions() {
  const stock = analyseStock();
  const toutes = recettes().map((r) => analyser(r, stock));
  return {
    stockVide: stock.presents.size === 0,
    realisables: toutes.filter((x) => x.ok).sort((a, b) => b.frais - a.frais),
    presque: toutes.filter((x) => !x.ok && x.manquants.length <= 2)
      .sort((a, b) => a.manquants.length - b.manquants.length || b.frais - a.frais),
    toutes,
  };
}

export function ajouterManquants(analyse) {
  lot(() => analyse.manquants.forEach((i) => { if (!dansLaListe(i.id)) ajouterALaListe(i.id); }));
  return analyse.manquants.length;
}

// ——— Recherche dans le catalogue ———

export function chercherAliments(texte, max = 8) {
  const q = norm(texte);
  if (!q) return [];
  const res = [];
  for (const al of catalogue()) {
    const noms = [al.nom, ...(al.alias || [])].map(norm);
    // Le nom principal passe avant les alias : « oignon » donne Oignons avant Ciboule (oignon vert).
    let rang = -1;
    if (noms[0].startsWith(q)) rang = 0;
    else if (noms.some((n) => n.startsWith(q))) rang = 1;
    else if (noms.some((n) => n.split(/[\s(/'-]+/).some((m) => m.startsWith(q)))) rang = 2;
    else if (noms.some((n) => n.includes(q))) rang = 3;
    if (rang >= 0) res.push([rang, al]);
  }
  return res.sort((a, b) => a[0] - b[0] || a[1].nom.localeCompare(b[1].nom, 'fr')).slice(0, max).map((x) => x[1]);
}
