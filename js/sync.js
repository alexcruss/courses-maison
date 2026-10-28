// Partage du foyer avec Firebase (Firestore + connexion anonyme).
// Les données vivent d'abord sur le téléphone (store.js). Ce module envoie chaque
// modification au foyer et applique celles des autres membres : la version la plus
// récente gagne (les règles Firestore refusent d'écraser une version plus récente).
// Le SDK Firebase n'est chargé que si ce téléphone fait partie d'un foyer.

import { FIREBASE_CONFIG } from './firebase-config.js';
import {
  COLLECTIONS, OUBLI_SUPPRESSIONS, fiches, appliquerDistants, surEcriture,
  foyer, majFoyer, reglages, viderDonnees,
} from './store.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.6.0';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans I, L, O, 0, 1 qu'on confond

let fb = null;
let arrets = [];
let parCollection = {};
const etatSync = { statut: 'local', membres: [], erreur: '' };
const abonnes = new Set();

export const configure = () => Boolean(FIREBASE_CONFIG?.apiKey);
export const etat = () => etatSync;
export const abonnerSync = (f) => {
  abonnes.add(f);
  return () => abonnes.delete(f);
};
const publier = (patch) => {
  Object.assign(etatSync, patch);
  abonnes.forEach((f) => f(etatSync));
};

export const formaterCode = (c) => (c ? `${c.slice(0, 3)}-${c.slice(3)}` : '');
const lireCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function nouveauCode() {
  return [...crypto.getRandomValues(new Uint8Array(6))].map((n) => ALPHABET[n % ALPHABET.length]).join('');
}

async function firebase() {
  if (fb) return fb;
  const [app, au, fs] = await Promise.all(['app', 'auth', 'firestore'].map((m) => import(`${SDK}/firebase-${m}.js`)));
  const appli = app.initializeApp(FIREBASE_CONFIG);
  let db;
  try {
    // Cache sur le téléphone : lecture hors ligne et envoi différé des modifications.
    db = fs.initializeFirestore(appli, { localCache: fs.persistentLocalCache() });
  } catch (err) {
    console.warn('Cache Firestore indisponible', err);
    db = fs.getFirestore(appli);
  }
  fb = { au, fs, db, auth: au.getAuth(appli) };
  return fb;
}

async function connecter() {
  const { au, auth } = await firebase();
  await auth.authStateReady();
  if (!auth.currentUser) await au.signInAnonymously(auth);
  return auth.currentUser.uid;
}

export const messageErreur = (err) => {
  if (err?.code === 'unavailable' || /offline/i.test(err?.message || '')) return 'Pas de connexion internet.';
  if (err?.code === 'permission-denied') return "Accès refusé : ce téléphone ne fait plus partie du foyer.";
  return err?.message || 'Erreur inconnue.';
};

// ——— Créer, rejoindre, quitter ———

export async function creerFoyer(nom) {
  const uid = await connecter();
  const { fs, db } = fb;
  let code = nouveauCode();
  for (let i = 0; i < 5 && (await fs.getDoc(fs.doc(db, 'codes', code))).exists(); i++) code = nouveauCode();
  const ref = fs.doc(fs.collection(db, 'foyers'));
  const maintenant = new Date().toISOString();
  await fs.setDoc(ref, { nom, code, creePar: uid, creeLe: maintenant });
  await fs.setDoc(fs.doc(db, 'foyers', ref.id, 'membres', uid), { prenom: reglages().prenom || '', code, rejointLe: maintenant });
  await fs.setDoc(fs.doc(db, 'codes', code), { foyerId: ref.id });
  majFoyer({ id: ref.id, nom, code });
  await demarrer();
  return code;
}

export async function rejoindreFoyer(saisie, garderDonnees) {
  const code = lireCode(saisie);
  if (code.length !== 6) throw new Error('Le code a 6 caractères, par exemple K7M-2QX.');
  const uid = await connecter();
  const { fs, db } = fb;
  const c = await fs.getDoc(fs.doc(db, 'codes', code));
  if (!c.exists()) throw new Error('Code inconnu : vérifiez-le auprès de la personne qui vous invite.');
  const { foyerId } = c.data();
  await fs.setDoc(fs.doc(db, 'foyers', foyerId, 'membres', uid), {
    prenom: reglages().prenom || '', code, rejointLe: new Date().toISOString(),
  });
  const f = await fs.getDoc(fs.doc(db, 'foyers', foyerId));
  if (!garderDonnees) viderDonnees();
  majFoyer({ id: foyerId, nom: f.data().nom, code });
  await demarrer();
  return f.data().nom;
}

export async function quitterFoyer() {
  const f = foyer();
  if (fb && f) {
    const uid = fb.auth.currentUser?.uid;
    if (uid) fb.fs.deleteDoc(fb.fs.doc(fb.db, 'foyers', f.id, 'membres', uid)).catch(() => {});
  }
  arreter();
  majFoyer(null);
  publier({ statut: 'local', membres: [], erreur: '' });
}

// Met à jour le prénom affiché aux autres membres.
export async function majMembre() {
  const f = foyer();
  if (!fb || !f || !fb.auth.currentUser) return;
  const { fs, db } = fb;
  fs.updateDoc(fs.doc(db, 'foyers', f.id, 'membres', fb.auth.currentUser.uid), { prenom: reglages().prenom || '' })
    .catch((err) => console.warn(err));
}

// ——— Synchronisation ———

function arreter() {
  arrets.forEach((a) => a());
  arrets = [];
  parCollection = {};
}

export async function demarrer() {
  arreter();
  const f = foyer();
  if (!configure() || !f) return publier({ statut: 'local', membres: [], erreur: '' });
  publier({ statut: 'connexion', erreur: '' });
  try {
    const uid = await connecter();
    await verifierMembre(uid, f);
    const { fs, db } = fb;
    for (const c of COLLECTIONS) {
      parCollection[c] = { serveur: false, fusionne: false, enAttente: false };
      arrets.push(fs.onSnapshot(
        fs.collection(db, 'foyers', f.id, c),
        { includeMetadataChanges: true },
        (snap) => recevoir(c, snap),
        (err) => publier({ statut: 'erreur', erreur: messageErreur(err) }),
      ));
    }
    arrets.push(fs.onSnapshot(
      fs.collection(db, 'foyers', f.id, 'membres'),
      (snap) => publier({ membres: snap.docs.map((d) => ({ uid: d.id, ...d.data(), moi: d.id === uid })) }),
      () => {},
    ));
    arrets.push(surEcriture(envoyer));
  } catch (err) {
    console.warn(err);
    publier({ statut: navigator.onLine ? 'erreur' : 'hors-ligne', erreur: messageErreur(err) });
  }
}

// Si la connexion anonyme a changé (données du navigateur effacées), on rejoint
// à nouveau le foyer avec le code gardé sur le téléphone.
async function verifierMembre(uid, f) {
  const { fs, db } = fb;
  const ref = fs.doc(db, 'foyers', f.id, 'membres', uid);
  let existe = true;
  try {
    existe = (await fs.getDoc(ref)).exists();
  } catch {
    return; // hors ligne : on vérifiera au prochain démarrage
  }
  if (!existe) {
    await fs.setDoc(ref, { prenom: reglages().prenom || '', code: f.code, rejointLe: new Date().toISOString() });
  }
}

function recevoir(c, snap) {
  const recus = snap.docChanges().filter((ch) => ch.type !== 'removed').map((ch) => ch.doc.data());
  if (recus.length) appliquerDistants(c, recus);

  const etatC = parCollection[c];
  if (!etatC) return;
  etatC.serveur = !snap.metadata.fromCache;
  etatC.enAttente = snap.metadata.hasPendingWrites;

  // Première réponse du serveur : envoyer ce que ce téléphone a de plus récent
  // (modifications faites hors ligne, ou données gardées en rejoignant le foyer).
  if (etatC.serveur && !etatC.fusionne) {
    etatC.fusionne = true;
    const distants = new Map(snap.docs.map((d) => [d.id, d.data()]));
    for (const r of fiches(c)) {
      const d = distants.get(r.id);
      if (!d || r.majLe > d.majLe) envoyer(c, r);
    }
    oublierVieillesSuppressions(c, snap);
  }

  const toutes = Object.values(parCollection);
  const aJour = toutes.every((x) => x.serveur) && !toutes.some((x) => x.enAttente);
  publier({ statut: aJour ? 'a-jour' : (navigator.onLine ? 'envoi' : 'hors-ligne'), erreur: '' });
}

function envoyer(c, r) {
  const f = foyer();
  if (!fb || !f || !COLLECTIONS.includes(c)) return;
  const { fs, db } = fb;
  // JSON : retire les valeurs undefined, que Firestore refuse.
  fs.setDoc(fs.doc(db, 'foyers', f.id, c, r.id), JSON.parse(JSON.stringify(r))).catch((err) => {
    // Refus attendu quand un autre téléphone a enregistré une version plus récente.
    if (err.code !== 'permission-denied') console.warn(err);
  });
}

function oublierVieillesSuppressions(c, snap) {
  const limite = new Date(Date.now() - OUBLI_SUPPRESSIONS).toISOString();
  const { fs } = fb;
  snap.docs.filter((d) => d.data().supprime && d.data().majLe < limite)
    .forEach((d) => fs.deleteDoc(d.ref).catch(() => {}));
}

window.addEventListener('online', () => { if (etatSync.statut === 'erreur' || etatSync.statut === 'hors-ligne') demarrer(); });
window.addEventListener('offline', () => { if (foyer() && etatSync.statut !== 'local') publier({ statut: 'hors-ligne' }); });
