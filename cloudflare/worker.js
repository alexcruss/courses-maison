// Relais « Idées IA » d'ASSIMETO (Cloudflare Worker) vers l'API Claude.
//
// - La clé API reste ici (secret ANTHROPIC_API_KEY) : elle n'est jamais envoyée aux téléphones.
// - Seuls les membres d'un foyer sont servis : le jeton Firebase du téléphone est contrôlé
//   par Firestore lui-même, en lisant la fiche de membre avec ce jeton (règles firestore.rules).
// - Le téléphone n'envoie que des listes d'aliments ; la consigne donnée à Claude est fixée ici.
//
// À coller dans le tableau de bord Cloudflare (Workers > assimeto-ia > Modifier le code).

const MODELE = 'claude-opus-5-5';
const PROJET_FIREBASE = 'assimetoassimeto';
const ORIGINES = ['https://alexcruss.github.io', 'http://localhost:8124', 'http://localhost:8125'];
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      Vary: 'Origin',
    };
    if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (requete.method !== 'POST') throw new Erreur('Méthode non autorisée.', 405);
      if (!env.ANTHROPIC_API_KEY) throw new Erreur('Clé API absente : ajoutez le secret ANTHROPIC_API_KEY au Worker.', 500);
      const demande = await requete.json().catch(() => { throw new Erreur('Demande illisible.', 400); });
      const jeton = (requete.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      await verifierMembre(jeton, demande.foyerId);
      const resultat = await demanderIdees(env.ANTHROPIC_API_KEY, demande);
      return repondre(resultat, 200, cors);
    } catch (err) {
      return repondre({ erreur: err.message || 'Erreur inconnue.' }, err.statut || 500, cors);
    }
  },
};

const repondre = (corps, statut, cors) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
});

// Firestore n'accepte la lecture de la fiche de membre que si le jeton est valide
// et si cet utilisateur fait bien partie du foyer.
async function verifierMembre(jeton, foyerId) {
  if (!jeton || typeof foyerId !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(foyerId)) {
    throw new Erreur('Réservé aux membres du foyer.', 403);
  }
  let uid;
  try {
    const charge = jeton.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    uid = JSON.parse(atob(charge + '='.repeat((4 - (charge.length % 4)) % 4))).user_id;
  } catch {
    throw new Erreur('Jeton illisible.', 401);
  }
  if (!uid || !/^[A-Za-z0-9]{10,128}$/.test(uid)) throw new Erreur('Jeton illisible.', 401);
  const url = `https://firestore.googleapis.com/v1/projects/${PROJET_FIREBASE}/databases/(default)/documents/foyers/${foyerId}/membres/${uid}`;
  const rep = await fetch(url, { headers: { Authorization: `Bearer ${jeton}` } });
  if (!rep.ok) throw new Erreur('Réservé aux membres du foyer.', 403);
}

// Coupe et nettoie ce qu'envoie le téléphone : listes courtes, textes courts.
const texte = (s, max) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const liste = (l, max) => (Array.isArray(l) ? l.slice(0, max) : []);

async function demanderIdees(cle, d) {
  const catalogue = liste(d.catalogue, 400).map((a) => `${texte(a.id, 60)} : ${texte(a.nom, 60)}`).join('\n');
  const stock = liste(d.stock, 200).map((s) => `- ${texte(s.nom, 60)} (id ${texte(s.id, 60)}, ${texte(s.ou, 20)})`).join('\n');
  const connues = liste(d.connues, 150).map((n) => texte(n, 60)).join(' ; ');
  const personnes = Math.min(20, Math.max(1, parseInt(d.personnes, 10) || 4));
  const envie = texte(d.envie, 200);
  if (!stock) throw new Erreur('Le stock est vide.', 400);

  const corps = {
    model: MODELE,
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
  if (!MODELE.startsWith('claude-haiku')) {
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
