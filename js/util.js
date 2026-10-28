// Petites fonctions partagées par les écrans.

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

// Minuscules sans accents : « ademe » trouve « Adémè ».
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const nfPrix = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nfQte = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
export const fcfa = (n) => `${nfPrix.format(Math.round(n || 0))} F`;
export const qte = (n) => nfQte.format(n || 0);

// Lit « 1,5 », « 1.5 » ou « 2 000 » ; renvoie null si ce n'est pas un nombre.
export function nombre(s) {
  if (s === null || s === undefined || String(s).trim() === '') return null;
  const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export const uid = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export const maintenant = () => new Date().toISOString();

const debutJour = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export function ilYa(iso) {
  if (!iso) return '';
  const jours = Math.round((debutJour(new Date()) - debutJour(new Date(iso))) / 86400000);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return 'hier';
  return `il y a ${jours} j`;
}

// « 2 sachets », « 3 morceaux », mais « 2 kg » et « 2 tas ».
export function unite(n, u) {
  if (!u || n <= 1 || ['kg', 'g', 'L'].includes(u) || /[sx]$/.test(u)) return u || '';
  return /eau$/.test(u) ? `${u}x` : `${u}s`;
}
export const qteUnite = (n, u) => `${qte(n)} ${unite(n, u)}`.trim();

export const parNom = (a, b) => a.nom.localeCompare(b.nom, 'fr');
export const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// « 2 tas gboma », « 1,5kg riz », « 3 tomates » → quantité, unité et nom.
const UNITES_SAISIE = {
  kg: 'kg', g: 'g', l: 'L', litre: 'L', litres: 'L', tas: 'tas', bol: 'bol', bols: 'bol',
  botte: 'botte', bottes: 'botte', sachet: 'sachet', sachets: 'sachet', boite: 'boîte', boites: 'boîte',
  bouteille: 'bouteille', bouteilles: 'bouteille', paquet: 'paquet', paquets: 'paquet', sac: 'sac', sacs: 'sac',
  pot: 'pot', pots: 'pot', piece: 'pièce', pieces: 'pièce', pc: 'pièce', pcs: 'pièce', boule: 'boule', boules: 'boule',
  plateau: 'plateau', plateaux: 'plateau', pack: 'pack', packs: 'pack', tete: 'tête', tetes: 'tête',
  morceau: 'morceau', morceaux: 'morceau', regime: 'régime', regimes: 'régime',
};
export function analyserSaisie(texte) {
  const brut = String(texte || '').trim();
  const m = brut.match(/^(\d+(?:[.,]\d+)?)\s*(\S*)\s+(.+)$/);
  if (!m) return { quantite: null, unite: null, nom: brut };
  const unite = UNITES_SAISIE[norm(m[2])];
  const reste = unite ? m[3] : `${m[2]} ${m[3]}`;
  return { quantite: nombre(m[1]), unite: unite || null, nom: reste.trim().replace(/^(de |d')/i, '').trim() };
}
