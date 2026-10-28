// Page d'administration des abonnements (admin.html) : vérifier et valider les paiements
// Flooz / T-Money, offrir l'accès à un foyer, suivre les recettes et le coût de l'IA.
// La clé (secret ADMIN_CLE du relais) n'est gardée que sur ce téléphone.

import { IA_URL } from './ia-config.js';
import { toast } from './ui.js';
import { esc, fcfa, ilYa } from './util.js';

const CLE = 'assimeto:admin';
// Dollars par million de jetons (entrée, sortie). Cache : lecture à 10 %, écriture à 125 % du prix d'entrée.
const PRIX = { 'claude-opus-5-5': [4, 20], 'claude-haiku-5-5': [0.1, 0.5] };
const FCFA_PAR_DOLLAR = 570;
const STATUTS = { offert: 'Offert', abonne: 'Abonné', essai: 'Essai', fin: 'Essai terminé' };

const zone = document.getElementById('admin');
let tableau = null;

const lireCle = () => { try { return localStorage.getItem(CLE) || ''; } catch { return ''; } };
const ecrireCle = (v) => { try { if (v) localStorage.setItem(CLE, v); else localStorage.removeItem(CLE); } catch { /* navigation privée */ } };
const code = (c) => (c ? `${c.slice(0, 3)}-${c.slice(3)}` : '');
const numero = (n) => String(n || '').replace(/(\d{2})(?=\d)/g, '$1 ');
const date = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

async function appeler(action, donnees = {}) {
  const rep = await fetch(`${IA_URL}/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cle-Admin': lireCle() },
    body: JSON.stringify({ action, ...donnees }),
  });
  const corps = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    const err = new Error(corps.erreur || `Le relais a répondu ${rep.status}.`);
    err.statut = rep.status;
    throw err;
  }
  return corps;
}

async function agir(action, donnees, message) {
  try {
    tableau = await appeler(action, donnees);
    dessiner();
    if (message) toast(message);
  } catch (err) {
    if (err.statut === 403) return demanderCle(err.message);
    if (!tableau) {
      zone.innerHTML = `<p class="recette-etat manque">${esc(err.message)}</p>
        <button class="btn" type="button" data-action="actualiser">Réessayer</button>
        <button class="btn btn-danger" type="button" data-action="oublier">Changer de clé</button>`;
      return;
    }
    toast(err.message);
    dessiner();
  }
}

function demanderCle(message = '') {
  ecrireCle('');
  zone.innerHTML = `
    <form class="carte carte-pleine" data-zone="cle">
      <p class="intro">Entrez la clé d'administration : c'est le secret ADMIN_CLE du relais assimeto-ia dans Cloudflare. Elle reste sur ce téléphone.</p>
      ${message ? `<p class="recette-etat manque">${esc(message)}</p>` : ''}
      <label>Clé<input name="cle" type="password" autocomplete="current-password"></label>
      <button class="btn" type="submit">Ouvrir</button>
    </form>`;
}

function coutIA(lignes) {
  let dollars = 0;
  let demandes = 0;
  for (const l of lignes) {
    const [entree, sortie] = PRIX[l.modele] || PRIX['claude-opus-5-5'];
    dollars += (l.entree * entree + l.cache_ecrit * entree * 1.25 + l.cache_lu * entree * 0.1 + l.sortie * sortie) / 1e6;
    demandes += l.demandes;
  }
  return { francs: dollars * FCFA_PAR_DOLLAR, demandes };
}

function detailFoyer(f) {
  const morceaux = [STATUTS[f.statut]];
  if (f.statut === 'abonne') morceaux.push(`jusqu'au ${date(f.jusqua)}`);
  if (f.statut === 'essai') morceaux.push(`${f.essaisRestants} essai(s) restant(s)`);
  if (f.mois === tableau.mois && f.demandes_mois) morceaux.push(`${f.demandes_mois} demande(s) ce mois`);
  if (f.vu_le) morceaux.push(`vu ${ilYa(f.vu_le)}`);
  return morceaux.join(' · ');
}

const libellePaiement = (p) => `${fcfa(p.montant)} · ${tableau.formules[p.formule]?.nom || p.formule} · ${tableau.moyens[p.moyen] || p.moyen}`;

const cartePaiement = (p) => `
  <div class="carte carte-pleine admin-paiement">
    <p class="foyer-nom">${esc(p.nom || 'Foyer sans nom')} <small>${esc(code(p.code))}</small></p>
    <p><strong>${esc(libellePaiement(p))}</strong></p>
    <p>Depuis le <strong>${esc(numero(p.telephone))}</strong> · réf. <strong>${esc(p.reference)}</strong></p>
    <p class="aide">Déclaré le ${date(p.cree_le)}. Vérifiez le SMS reçu avant de valider (deux appuis).</p>
    <div class="champs-2">
      <button class="btn" type="button" data-action="valider" data-id="${p.id}">Valider</button>
      <button class="btn btn-secondaire" type="button" data-action="refuser" data-id="${p.id}">Refuser</button>
    </div>
  </div>`;

const ligneFoyer = (f) => `
  <div class="ligne">
    <span class="ligne-corps">
      <span class="ligne-nom">${esc(f.nom || 'Sans nom')} <small>${esc(code(f.code))}</small></span>
      <span class="ligne-detail">${esc(detailFoyer(f))}</span>
    </span>
    <label class="admin-offert"><input type="checkbox" data-foyer="${esc(f.id)}"${f.offert ? ' checked' : ''}> Offert</label>
  </div>`;

const ligneTraite = (p) => `
  <div class="ligne">
    <span class="ligne-corps">
      <span class="ligne-nom">${esc(p.nom || 'Sans nom')} · ${esc(libellePaiement(p))}</span>
      <span class="ligne-detail">${p.statut === 'valide' ? 'Validé' : 'Refusé'} le ${date(p.traite_le)} · réf. ${esc(p.reference)}</span>
    </span>
  </div>`;

function dessiner() {
  const t = tableau;
  const cout = coutIA(t.couts);
  zone.innerHTML = `
    <section class="groupe">
      <h2 class="groupe-titre"><span>À vérifier</span><span>${t.attente.length}</span></h2>
      ${t.attente.length ? t.attente.map(cartePaiement).join('') : '<p class="aide">Aucun paiement en attente.</p>'}
    </section>
    <section class="groupe">
      <h2 class="groupe-titre"><span>Ce mois-ci</span></h2>
      <div class="carte carte-pleine admin-chiffres">
        <p><strong>${fcfa(t.encaisse.mois)}</strong> encaissés <small>(${fcfa(t.encaisse.total)} depuis le début)</small></p>
        <p><strong>≈ ${fcfa(cout.francs)}</strong> de coût IA pour ${cout.demandes} demande(s)</p>
      </div>
    </section>
    <section class="groupe">
      <h2 class="groupe-titre"><span>Foyers</span><span>${t.foyers.length}</span></h2>
      ${t.foyers.length ? `<div class="carte">${t.foyers.map(ligneFoyer).join('')}</div>` : '<p class="aide">Aucun foyer n\'a encore utilisé les idées.</p>'}
    </section>
    <section class="groupe">
      <h2 class="groupe-titre"><span>Derniers paiements traités</span></h2>
      ${t.traites.length ? `<div class="carte">${t.traites.map(ligneTraite).join('')}</div>` : '<p class="aide">Aucun pour l\'instant.</p>'}
    </section>
    <button class="btn btn-danger" type="button" data-action="oublier">Oublier la clé sur ce téléphone</button>`;
}

async function charger() {
  if (!lireCle()) return demanderCle();
  zone.innerHTML = '<p class="aide">Chargement…</p>';
  await agir('tableau');
}

zone.addEventListener('submit', (e) => {
  e.preventDefault();
  ecrireCle(String(new FormData(e.target).get('cle') || '').trim());
  charger();
});

// Valider ou refuser demande un second appui : certains navigateurs n'affichent pas confirm().
function confirme(b, libelle) {
  if (b.dataset.confirme) return true;
  const avant = b.textContent;
  b.dataset.confirme = '1';
  b.textContent = libelle;
  setTimeout(() => {
    if (!b.isConnected) return;
    delete b.dataset.confirme;
    b.textContent = avant;
  }, 5000);
  return false;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const id = Number(b.dataset.id);
  const p = tableau?.attente.find((x) => x.id === id);
  if (b.dataset.action === 'actualiser') charger();
  if (b.dataset.action === 'oublier') demanderCle();
  if (b.dataset.action === 'valider' && p && confirme(b, 'Confirmer ?')) agir('valider', { id }, 'Abonnement activé');
  if (b.dataset.action === 'refuser' && p && confirme(b, 'Confirmer le refus ?')) agir('refuser', { id }, 'Paiement refusé');
});

zone.addEventListener('change', (e) => {
  const foyerId = e.target.dataset.foyer;
  if (foyerId) agir('offrir', { foyerId, offert: e.target.checked }, e.target.checked ? 'Accès offert' : 'Accès offert retiré');
});

charger();
