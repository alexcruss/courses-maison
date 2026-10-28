// Relais « Idées IA » d'ASSIMETO (Cloudflare Worker) vers l'API Claude.
//
// - La clé API reste ici (secret ANTHROPIC_API_KEY) : elle n'est jamais envoyée aux téléphones.
// - Seuls les membres d'un foyer sont servis : le jeton Firebase du téléphone est contrôlé
//   par Firestore lui-même, en lisant la fiche du foyer avec ce jeton (règles firestore.rules).
// - Abonnements (base D1 liée sous le nom DB) : 3 idées offertes par foyer, puis 300 F les 6 mois
//   ou 500 F l'année, payés par Flooz ou T-Money et validés à la main dans admin.html (secret ADMIN_CLE).
// - Le téléphone n'envoie que des listes d'aliments ; la consigne donnée à Claude est fixée ici.
//
// À coller dans le tableau de bord Cloudflare (Workers > assimeto-ia > Modifier le code).

const MODELE_ABONNES = 'claude-haiku-5-5'; // essai et abonnés
const MODELE_OFFERT = 'claude-opus-5-5'; // foyers offerts (cochés dans admin.html)
const ESSAIS = 3;
const PLAFOND_MOIS = 60;
const FORMULES = {
  '6mois': { nom: '6 mois', prix: 300, mois: 6 },
  '1an': { nom: '1 an', prix: 500, mois: 12 },
};
const MOYENS = { flooz: 'Flooz', tmoney: 'T-Money' };

const PROJET_FIREBASE = 'assimetoassimeto';
const ORIGINES = [
  'https://assimeto.pages.dev',
  'https://alexcruss.github.io',
  'http://localhost:8124',
  'http://localhost:8125',
];
const TYPES = ['Sauce', 'Pâte', 'Riz', 'Plat', 'Friture', 'Grillade', 'Bouillie', 'Autre'];

const CONSIGNE = `Tu aides une famille de Lomé (Togo) à décider quoi cuisiner avec ce qu'elle a à la maison.

Propose exactement 3 plats différents, de préférence togolais ou ouest-africains (sauces, pâtes, riz, fritures, grillades, bouillies), réalisables surtout avec le stock fourni.
- Privilégie les produits rangés au frigo : ils se gardent moins longtemps.
- Un plat peut demander 1 ou 2 ingrédients absents du stock s'il en vaut la peine. Le sel et l'eau sont toujours disponibles.
- Ne reprends pas un plat de la liste des recettes déjà connues, sauf variante nettement différente.
- Si une envie est indiquée, respecte-la.

Pour chaque ingrédient : dans « id », l'identifiant exact du catalogue quand l'aliment y figure, sinon une chaîne vide ; dans « nom », son nom en français. Quantités pour le nombre de personnes demandé, avec les unités du marché (tas, bol, botte, kg, pièce…).
Étapes : 3 à 6 phrases courtes et concrètes, à l'infinitif (« Couper le gombo… »), en français simple.
« pourquoi » : une phrase qui explique le choix, par exemple les produits du frigo utilisés.
« emoji » : un seul emoji qui évoque le plat. « duree » : en minutes, préparation comprise.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['idees'],
  properties: {
    idees: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nom', 'type', 'emoji', 'portions', 'duree', 'accompagnement', 'pourquoi', 'ingredients', 'etapes'],
        properties: {
          nom: { type: 'string' },
          type: { type: 'string', enum: TYPES },
          emoji: { type: 'string' },
          portions: { type: 'integer' },
          duree: { type: 'integer' },
          accompagnement: { type: 'string' },
          pourquoi: { type: 'string' },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'nom', 'quantite', 'facultatif'],
              properties: {
                id: { type: 'string' },
                nom: { type: 'string' },
                quantite: { type: 'string' },
                facultatif: { type: 'boolean' },
              },
            },
          },
          etapes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

// Tables créées au premier appel : rien à préparer dans la console D1.
const TABLES = [
  `CREATE TABLE IF NOT EXISTS foyers (
    id TEXT PRIMARY KEY,
    nom TEXT,
    code TEXT,
    essais INTEGER NOT NULL DEFAULT 0,
    jusqua TEXT,
    offert INTEGER NOT NULL DEFAULT 0,
    mois TEXT,
    demandes_mois INTEGER NOT NULL DEFAULT 0,
    vu_le TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS paiements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    foyer_id TEXT NOT NULL,
    formule TEXT NOT NULL,
    montant INTEGER NOT NULL,
    moyen TEXT NOT NULL,
    telephone TEXT,
    reference TEXT,
    statut TEXT NOT NULL DEFAULT 'attente',
    cree_le TEXT NOT NULL,
    traite_le TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS demandes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    foyer_id TEXT NOT NULL,
    le TEXT NOT NULL,
    modele TEXT NOT NULL,
    entree INTEGER,
    sortie INTEGER,
    cache_lu INTEGER,
    cache_ecrit INTEGER
  )`,
];

class Erreur extends Error {
  constructor(message, statut) {
    super(message);
    this.statut = statut;
  }
}

export default {
  async fetch(requete, env) {
    const origine = requete.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINES.includes(origine) ? origine : ORIGINES[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cle-Admin',
      Vary: 'Origin',
    };
    if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (requete.method !== 'POST') throw new Erreur('Méthode non autorisée.', 405);
      if (!env.DB) throw new Erreur('Base des abonnements absente : liez une base D1 au Worker sous le nom DB.', 500);
      // Les anciennes versions de l'appli appellent l'adresse racine pour les idées.
      const chemin = new URL(requete.url).pathname.replace(/\/+$/, '') || '/idees';
      const demande = await requete.json().catch(() => { throw new Erreur('Demande illisible.', 400); });
      await preparerBase(env.DB);
      if (chemin === '/admin') return repondre(await admin(env, requete, demande), 200, cors);

      const jeton = (requete.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const fiche = await ficheFoyer(env.DB, await verifierMembre(jeton, demande.foyerId));
      if (chemin === '/etat') return repondre(await etat(env, fiche), 200, cors);
      if (chemin === '/paiement') return repondre(await declarerPaiement(env, fiche, demande), 200, cors);
      if (chemin === '/idees') return repondre(await idees(env, fiche, demande), 200, cors);
      throw new Erreur('Adresse inconnue.', 404);
    } catch (err) {
      return repondre({ erreur: err.message || 'Erreur inconnue.' }, err.statut || 500, cors);
    }
  },
};

const repondre = (corps, statut, cors) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
});

let basePrete = null;
function preparerBase(db) {
  basePrete ??= db.batch(TABLES.map((sql) => db.prepare(sql))).catch((err) => {
    basePrete = null;
    throw err;
  });
  return basePrete;
}

// Firestore n'accepte la lecture de la fiche du foyer que si le jeton est valide
// et si cet utilisateur en est membre ; la fiche donne aussi le nom et le code du foyer.
async function verifierMembre(jeton, foyerId) {
  if (!jeton || typeof foyerId !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(foyerId)) {
    throw new Erreur('Réservé aux membres du foyer.', 403);
  }
  const url = `https://firestore.googleapis.com/v1/projects/${PROJET_FIREBASE}/databases/(default)/documents/foyers/${foyerId}`;
  const rep = await fetch(url, { headers: { Authorization: `Bearer ${jeton}` } });
  if (!rep.ok) throw new Erreur('Réservé aux membres du foyer.', 403);
  const champs = (await rep.json()).fields || {};
  return { id: foyerId, nom: champs.nom?.stringValue || '', code: champs.code?.stringValue || '' };
}

// Fiche du foyer dans D1, créée à sa première visite.
function ficheFoyer(db, f) {
  return db.prepare(`INSERT INTO foyers (id, nom, code, vu_le) VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT (id) DO UPDATE SET nom = ?2, code = ?3, vu_le = ?4 RETURNING *`)
    .bind(f.id, f.nom, f.code, new Date().toISOString()).first();
}

const moisCourant = () => new Date().toISOString().slice(0, 7);

// offert : idées sans limite (Opus) ; abonne : jusqu'à PLAFOND_MOIS par mois ;
// essai : il reste des idées offertes ; fin : il faut s'abonner.
function statut(fiche) {
  const demandesMois = fiche.mois === moisCourant() ? fiche.demandes_mois : 0;
  if (fiche.offert) return { statut: 'offert', modele: MODELE_OFFERT };
  if (fiche.jusqua && fiche.jusqua > new Date().toISOString()) {
    return { statut: 'abonne', modele: MODELE_ABONNES, jusqua: fiche.jusqua, restantsMois: Math.max(0, PLAFOND_MOIS - demandesMois) };
  }
  const essaisRestants = Math.max(0, ESSAIS - fiche.essais);
  return { statut: essaisRestants ? 'essai' : 'fin', modele: MODELE_ABONNES, essaisRestants, jusqua: fiche.jusqua || null };
}

const statutPublic = ({ modele, ...s }) => s;

async function etat(env, fiche) {
  const attente = await env.DB.prepare(`SELECT formule, montant, moyen, cree_le FROM paiements
    WHERE foyer_id = ?1 AND statut = 'attente' ORDER BY id`).bind(fiche.id).all();
  return {
    ...statutPublic(statut(fiche)),
    attente: attente.results,
    formules: Object.entries(FORMULES).map(([id, f]) => ({ id, ...f })),
    numeros: { flooz: env.NUMERO_FLOOZ || '', tmoney: env.NUMERO_TMONEY || '' },
    beneficiaire: env.BENEFICIAIRE || 'FATALITY 2KP',
    essais: ESSAIS,
    plafondMois: PLAFOND_MOIS,
  };
}

async function idees(env, fiche, demande) {
  const s = statut(fiche);
  if (s.statut === 'fin') {
    throw new Erreur(`Les ${ESSAIS} idées offertes sont utilisées. Abonnez-vous pour continuer : 300 F les 6 mois ou 500 F l'année.`, 402);
  }
  if (s.statut === 'abonne' && s.restantsMois <= 0) {
    throw new Erreur(`Les ${PLAFOND_MOIS} idées de ce mois sont utilisées. Elles reviennent le 1er du mois prochain.`, 429);
  }
  if (!env.ANTHROPIC_API_KEY) throw new Erreur('Clé API absente : ajoutez le secret ANTHROPIC_API_KEY au Worker.', 500);
  const { idees: liste, usage = {} } = await demanderIdees(env.ANTHROPIC_API_KEY, demande, s.modele);

  // Seules les demandes réussies sont comptées.
  const db = env.DB;
  const mois = moisCourant();
  const [maj] = await db.batch([
    db.prepare(`UPDATE foyers SET essais = essais + ?2,
        demandes_mois = CASE WHEN mois = ?3 THEN demandes_mois + 1 ELSE 1 END, mois = ?3
      WHERE id = ?1 RETURNING *`).bind(fiche.id, s.statut === 'essai' ? 1 : 0, mois),
    db.prepare(`INSERT INTO demandes (foyer_id, le, modele, entree, sortie, cache_lu, cache_ecrit)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`).bind(
      fiche.id, new Date().toISOString(), s.modele, usage.input_tokens ?? 0, usage.output_tokens ?? 0,
      usage.cache_read_input_tokens ?? 0, usage.cache_creation_input_tokens ?? 0,
    ),
  ]);
  return { idees: liste, etat: statutPublic(statut(maj.results[0])) };
}

async function declarerPaiement(env, fiche, d) {
  const formule = FORMULES[d.formule];
  if (!formule) throw new Erreur('Choisissez une formule.', 400);
  if (!MOYENS[d.moyen]) throw new Erreur('Choisissez Flooz ou T-Money.', 400);
  const telephone = String(d.telephone ?? '').replace(/\D/g, '').replace(/^228(?=\d{8}$)/, '');
  if (!/^\d{8}$/.test(telephone)) throw new Erreur('Numéro de téléphone à 8 chiffres attendu.', 400);
  const reference = texte(d.reference, 40);
  if (reference.length < 4) throw new Erreur('Recopiez la référence du SMS de paiement.', 400);
  const enAttente = await env.DB.prepare(`SELECT COUNT(*) AS n FROM paiements WHERE foyer_id = ?1 AND statut = 'attente'`)
    .bind(fiche.id).first('n');
  if (enAttente >= 2) throw new Erreur('Deux paiements attendent déjà la vérification. Patientez un peu.', 429);
  await env.DB.prepare(`INSERT INTO paiements (foyer_id, formule, montant, moyen, telephone, reference, cree_le)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(fiche.id, d.formule, formule.prix, d.moyen, telephone, reference, new Date().toISOString()).run();
  return etat(env, fiche);
}

// ——— Administration (admin.html) ———

async function verifierAdmin(env, requete) {
  const attendue = (env.ADMIN_CLE || '').trim();
  if (attendue.length < 16) throw new Erreur("Clé d'administration absente : ajoutez le secret ADMIN_CLE (16 caractères ou plus).", 500);
  const recue = (requete.headers.get('X-Cle-Admin') || '').trim();
  const [a, b] = await Promise.all([recue, attendue].map((s) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
  if (!crypto.subtle.timingSafeEqual(a, b)) throw new Erreur("Clé d'administration incorrecte.", 403);
}

async function admin(env, requete, d) {
  await verifierAdmin(env, requete);
  const db = env.DB;
  if (d.action === 'valider') await valider(db, Number(d.id));
  else if (d.action === 'refuser') {
    await db.prepare(`UPDATE paiements SET statut = 'refuse', traite_le = ?2 WHERE id = ?1 AND statut = 'attente'`)
      .bind(Number(d.id), new Date().toISOString()).run();
  } else if (d.action === 'offrir') {
    await db.prepare('UPDATE foyers SET offert = ?2 WHERE id = ?1').bind(String(d.foyerId), d.offert ? 1 : 0).run();
  } else if (d.action !== 'tableau') throw new Erreur('Action inconnue.', 400);
  return tableau(db);
}

// L'abonnement part de sa date de fin s'il court encore, sinon d'aujourd'hui.
async function valider(db, id) {
  const p = await db.prepare(`SELECT p.foyer_id, p.formule, f.jusqua FROM paiements p JOIN foyers f ON f.id = p.foyer_id
    WHERE p.id = ?1 AND p.statut = 'attente'`).bind(id).first();
  if (!p) throw new Erreur('Paiement introuvable ou déjà traité.', 404);
  const maintenant = new Date();
  const fin = p.jusqua && new Date(p.jusqua) > maintenant ? new Date(p.jusqua) : new Date(maintenant);
  fin.setUTCMonth(fin.getUTCMonth() + FORMULES[p.formule].mois);
  await db.batch([
    db.prepare(`UPDATE paiements SET statut = 'valide', traite_le = ?2 WHERE id = ?1`).bind(id, maintenant.toISOString()),
    db.prepare('UPDATE foyers SET jusqua = ?2 WHERE id = ?1').bind(p.foyer_id, fin.toISOString()),
  ]);
}

async function tableau(db) {
  const mois = moisCourant();
  const [attente, traites, foyers, couts, encaisse] = await db.batch([
    db.prepare(`SELECT p.*, f.nom, f.code FROM paiements p JOIN foyers f ON f.id = p.foyer_id
      WHERE p.statut = 'attente' ORDER BY p.id`),
    db.prepare(`SELECT p.*, f.nom, f.code FROM paiements p JOIN foyers f ON f.id = p.foyer_id
      WHERE p.statut != 'attente' ORDER BY p.traite_le DESC LIMIT 20`),
    db.prepare('SELECT * FROM foyers ORDER BY vu_le DESC LIMIT 200'),
    db.prepare(`SELECT modele, COUNT(*) AS demandes, SUM(entree) AS entree, SUM(sortie) AS sortie,
        SUM(cache_lu) AS cache_lu, SUM(cache_ecrit) AS cache_ecrit
      FROM demandes WHERE substr(le, 1, 7) = ?1 GROUP BY modele`).bind(mois),
    db.prepare(`SELECT COALESCE(SUM(montant), 0) AS total,
        COALESCE(SUM(CASE WHEN substr(traite_le, 1, 7) = ?1 THEN montant END), 0) AS mois
      FROM paiements WHERE statut = 'valide'`).bind(mois),
  ]);
  return {
    mois,
    attente: attente.results,
    traites: traites.results,
    foyers: foyers.results.map((f) => ({ ...f, ...statutPublic(statut(f)) })),
    couts: couts.results,
    encaisse: encaisse.results[0],
    formules: FORMULES,
    moyens: MOYENS,
  };
}

// ——— Appel à Claude ———

// Coupe et nettoie ce qu'envoie le téléphone : listes courtes, textes courts.
const texte = (s, max) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const liste = (l, max) => (Array.isArray(l) ? l.slice(0, max) : []);

async function demanderIdees(cle, d, modele) {
  const catalogue = liste(d.catalogue, 400).map((a) => `${texte(a.id, 60)} : ${texte(a.nom, 60)}`).join('\n');
  const stock = liste(d.stock, 200).map((s) => `- ${texte(s.nom, 60)} (id ${texte(s.id, 60)}, ${texte(s.ou, 20)})`).join('\n');
  const connues = liste(d.connues, 150).map((n) => texte(n, 60)).join(' ; ');
  const personnes = Math.min(20, Math.max(1, parseInt(d.personnes, 10) || 4));
  const envie = texte(d.envie, 200);
  if (!stock) throw new Erreur('Le stock est vide.', 400);

  const corps = {
    model: modele,
    max_tokens: 16000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: CONSIGNE,
    messages: [{
      role: 'user',
      content: [
        // Le catalogue change peu : il est mis en cache avec la consigne.
        { type: 'text', text: `Catalogue des aliments (identifiant : nom) :\n${catalogue}`, cache_control: { type: 'ephemeral' } },
        {
          type: 'text',
          text: `Stock de la maison (nom, identifiant, emplacement) :\n${stock}\n\n`
            + `Recettes déjà connues : ${connues || 'aucune'}\n`
            + `Nombre de personnes : ${personnes}\n`
            + `Envie : ${envie || 'aucune en particulier'}`,
        },
      ],
    }],
  };
  const entetes = {
    'Content-Type': 'application/json',
    'x-api-key': cle.trim(), // une espace ou un retour à la ligne collé avec la clé la rend invalide
    'anthropic-version': '2026-10-21',
  };
  // Si un filtre de sécurité refuse la demande, l'API la reprend sur un autre modèle (pas pour Haiku).
  if (!modele.startsWith('claude-haiku')) {
    corps.fallbacks = 'default';
    entetes['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }

  const rep = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: entetes, body: JSON.stringify(corps) });
  const message = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    const statut = rep.status === 429 || rep.status >= 500 ? 503 : 502;
    throw new Erreur(`Le service d'IA ne répond pas (${rep.status}${message.error?.message ? ` : ${message.error.message}` : ''}). Réessayez dans un moment.`, statut);
  }
  if (message.stop_reason === 'refusal') throw new Erreur("L'IA a refusé cette demande. Reformulez l'envie.", 422);
  if (message.stop_reason === 'max_tokens') throw new Erreur("La réponse de l'IA a été coupée. Réessayez.", 502);
  const reponse = (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return { idees: JSON.parse(reponse).idees, usage: message.usage };
  } catch {
    throw new Erreur("Réponse de l'IA illisible. Réessayez.", 502);
  }
}
