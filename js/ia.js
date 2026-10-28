// Idées de plats proposées par l'IA à partir du stock, via le relais Cloudflare.
// Réservé aux membres d'un foyer partagé : le relais vérifie le jeton Firebase.
// Chaque foyer a 3 idées offertes, puis un abonnement payé par Flooz ou T-Money (abonnement.js).

import { IA_URL } from './ia-config.js';
import { foyer, tous, catalogue, recettes, aliment, creerAliment, ecrire } from './store.js';
import { jetonFirebase } from './sync.js';
import { TYPE } from './data/referentiel.js';
import { norm, uid, majuscule } from './util.js';

export const iaDisponible = () => Boolean(IA_URL);

// Dernier état de l'abonnement reçu du relais (null tant qu'on ne l'a pas demandé).
let etatIA = null;
let etatFoyer = null;
export const etatConnu = () => (etatFoyer === foyer()?.id ? etatIA : null);

async function appeler(chemin, corps) {
  const f = foyer();
  if (!f) throw new Error("Les idées de l'IA sont réservées au foyer partagé : créez-en un ou rejoignez-le dans Réglages.");
  if (!navigator.onLine) throw new Error("Pas de connexion internet : l'IA en a besoin.");
  const rep = await fetch(`${IA_URL}${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await jetonFirebase()}` },
    body: JSON.stringify({ foyerId: f.id, ...corps }),
  });
  const donnees = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    const err = new Error(donnees.erreur || `Le relais IA a répondu ${rep.status}.`);
    // 402 : les idées offertes sont utilisées et le foyer n'a pas d'abonnement en cours.
    err.abonnement = rep.status === 402;
    if (err.abonnement) retenir({ statut: 'fin', essaisRestants: 0 });
    throw err;
  }
  return donnees;
}

function retenir(etat) {
  etatFoyer = foyer()?.id;
  etatIA = { ...etatIA, ...etat };
  return etatIA;
}

export const etatAbonnement = async () => retenir(await appeler('/etat', {}));
export const declarerPaiement = async (paiement) => retenir(await appeler('/paiement', paiement));

// Une phrase sur l'accès aux idées, pour les cartes et les réglages.
export function resumeAbonnement(e = etatConnu()) {
  if (!e) return '';
  if (e.statut === 'offert') return 'Idées illimitées offertes à ce foyer';
  if (e.statut === 'abonne') {
    const fin = new Date(e.jusqua).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `Abonné jusqu'au ${fin} · ${e.restantsMois} idée${e.restantsMois > 1 ? 's' : ''} restante${e.restantsMois > 1 ? 's' : ''} ce mois`;
  }
  if (e.statut === 'essai') return `${e.essaisRestants} demande${e.essaisRestants > 1 ? 's' : ''} offerte${e.essaisRestants > 1 ? 's' : ''} pour essayer`;
  return e.attente?.length ? 'Paiement en cours de vérification' : 'Essai terminé : abonnez-vous pour continuer';
}

export async function demanderIdees({ envie, personnes }) {
  const stock = tous('stock').filter((s) => s.quantite > 0)
    .map((s) => ({ id: s.alimentId, nom: aliment(s.alimentId)?.nom, ou: s.emplacement }))
    .filter((s) => s.nom);
  if (!stock.length) throw new Error("Le stock est vide : notez d'abord ce qu'il y a à la maison.");

  const donnees = await appeler('/idees', {
    stock,
    catalogue: catalogue().filter((a) => a.cat !== 'entretien').map((a) => ({ id: a.id, nom: a.nom })),
    connues: recettes().map((r) => r.nom),
    envie,
    personnes,
  });
  if (donnees.etat) retenir(donnees.etat);
  return (donnees.idees || []).map(versRecette);
}

// Retrouve un aliment du catalogue par son nom quand l'IA n'a pas donné d'identifiant.
function trouverAliment(nom) {
  const n = norm(nom);
  if (!n) return null;
  return catalogue().find((a) => norm(a.nom) === n || (a.alias || []).some((x) => norm(x) === n)) || null;
}

// Recette provisoire : rien n'est enregistré tant qu'on ne la garde pas.
function versRecette(idee) {
  return {
    id: `ia-${uid()}`,
    nom: idee.nom,
    type: TYPE[idee.type] ? idee.type : 'Autre',
    emoji: idee.emoji,
    portions: idee.portions,
    duree: idee.duree,
    accompagnement: idee.accompagnement,
    pourquoi: idee.pourquoi,
    source: 'ia',
    ingredients: (idee.ingredients || []).map((i) => {
      const id = aliment(i.id) ? i.id : trouverAliment(i.nom)?.id || null;
      return { id, nom: i.nom, q: i.quantite, alt: [], opt: Boolean(i.facultatif) };
    }),
    etapes: idee.etapes || [],
  };
}

// Donne un aliment du catalogue à chaque ingrédient, en créant ceux qui manquent.
export function rattacherIngredients(rec) {
  for (const i of rec.ingredients) {
    if (!i.id) i.id = creerAliment({ nom: majuscule(i.nom) }).id;
  }
  return rec;
}

export function garderRecette(rec) {
  const { pourquoi, ...recette } = rattacherIngredients(rec);
  return ecrire('recettes', { ...recette, id: undefined, source: 'ia' });
}
