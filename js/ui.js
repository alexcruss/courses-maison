// Composants d'interface : en-tête, feuilles (fenêtres du bas), messages,
// champ de saisie d'aliment avec suggestions, petites pastilles.

import { esc, norm, analyserSaisie, majuscule } from './util.js';
import { creerAliment, reglages } from './store.js';
import { chercherAliments } from './metier.js';
import { CAT, EMPL, TYPE } from './data/referentiel.js';

const svg = (corps) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corps}</svg>`;

export const ICONES = {
  partager: svg('<path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1"/>'),
  reglages: svg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  retour: svg('<path d="m15 18-6-6 6-6"/>'),
  chercher: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
};

export const entete = (titre, actions = '') => `
  <header class="entete">
    <h1>${esc(titre)}</h1>
    <div class="entete-actions">${actions}<a class="icone-btn" href="#reglages" aria-label="Réglages">${ICONES.reglages}</a></div>
  </header>`;

export const salutation = () => {
  const h = new Date().getHours();
  const mot = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const prenom = reglages().prenom;
  return `${mot}${prenom ? ` ${esc(prenom)}` : ''},`;
};

// Pastille ronde avec l'emoji de la catégorie de l'aliment.
export const pastille = (al) => `<span class="pastille-cat" aria-hidden="true">${CAT[al?.cat]?.icone || '🛍️'}</span>`;

// « ❄️ Au frigo » ; rien pour les produits d'entretien.
export function conseilCourt(al) {
  if (!al || al.cat === 'entretien' || (al.perso && !al.cons?.conseil)) return '';
  const e = EMPL[al.cons?.ou];
  return e ? `${e.icone} ${e.conseil}` : '';
}

// Assiette ronde qui tient lieu de photo du plat.
export function assiette(rec, taille = '') {
  const t = TYPE[rec.type] || TYPE.Autre;
  return `<span class="assiette ${taille}" style="--teinte:${t.teinte}" aria-hidden="true"><span>${rec.emoji || t.emoji}</span></span>`;
}

export const options = (valeurs, choisie) => valeurs
  .map((v) => (typeof v === 'string' ? { id: v, nom: v } : v))
  .map((v) => `<option value="${esc(v.id)}"${v.id === choisie ? ' selected' : ''}>${esc(v.icone ? `${v.icone} ${v.nom}` : v.nom)}</option>`)
  .join('');

// ——— Messages ———

let minuteur;
export function toast(message) {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.classList.add('visible');
  clearTimeout(minuteur);
  minuteur = setTimeout(() => t.classList.remove('visible'), 2800);
}

// ——— Feuilles : fenêtres qui montent du bas de l'écran ———

export function feuille({ titre, corps, actions = {}, onSubmit, classe = '' }) {
  const fond = document.createElement('div');
  fond.className = 'feuille-fond';
  fond.innerHTML = `
    <form class="feuille ${classe}" novalidate>
      <div class="feuille-tete"><h2>${esc(titre)}</h2><button type="button" class="lien" data-action="fermer">Fermer</button></div>
      <div class="feuille-corps"></div>
    </form>`;
  const form = fond.querySelector('form');
  const zone = fond.querySelector('.feuille-corps');
  zone.innerHTML = corps;
  document.body.append(fond);
  document.body.classList.add('fige');
  requestAnimationFrame(() => requestAnimationFrame(() => fond.classList.add('ouvert')));

  const api = {
    form,
    zone,
    fermer() {
      fond.classList.remove('ouvert');
      setTimeout(() => {
        fond.remove();
        if (!document.querySelector('.feuille-fond')) document.body.classList.remove('fige');
      }, 230);
    },
  };
  fond.addEventListener('click', (e) => {
    if (e.target === fond) return api.fermer();
    const b = e.target.closest('[data-action]');
    if (!b) return;
    if (b.dataset.action === 'fermer') return api.fermer();
    actions[b.dataset.action]?.(b, api);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    onSubmit?.(new FormData(form), api);
  });
  return api;
}

// ——— Champ « ajouter un aliment » avec suggestions du catalogue ———
// Pas de <form> ici : le champ peut se trouver dans une feuille qui en a déjà un.

export function champAliment(conteneur, { placeholder, bouton = 'Ajouter', onChoix }) {
  conteneur.innerHTML = `
    <div class="ac">
      <div class="ac-ligne">
        <span class="ac-icone">${ICONES.chercher}</span>
        <input type="text" enterkeyhint="done" autocomplete="off" autocorrect="off" spellcheck="false"
          placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}">
        <button type="button" class="btn btn-petit" data-ac="valider">${esc(bouton)}</button>
      </div>
      <div class="ac-liste" hidden></div>
    </div>`;
  const input = conteneur.querySelector('input');
  const liste = conteneur.querySelector('.ac-liste');
  let resultats = [];

  const fermer = () => { liste.hidden = true; };
  const montrer = () => {
    const s = analyserSaisie(input.value);
    if (!s.nom) { resultats = []; return fermer(); }
    resultats = chercherAliments(s.nom);
    const exact = resultats.some((al) => norm(al.nom) === norm(s.nom));
    liste.innerHTML = resultats.map((al, i) => `
      <button type="button" class="ac-item" data-i="${i}">${pastille(al)}<span>${esc(al.nom)}</span><small>${esc(conseilCourt(al))}</small></button>`).join('')
      + (exact ? '' : `<button type="button" class="ac-item ac-nouveau" data-nouveau="1"><span class="pastille-cat">＋</span><span>Créer « ${esc(majuscule(s.nom))} »</span></button>`);
    liste.hidden = false;
  };
  const choisir = (al) => {
    const s = analyserSaisie(input.value);
    input.value = '';
    fermer();
    onChoix(al.id, s);
    input.focus();
  };
  const creer = () => {
    const s = analyserSaisie(input.value);
    if (!s.nom) return;
    choisir(creerAliment({ nom: majuscule(s.nom), unite: s.unite || 'pièce' }));
  };
  const valider = () => {
    if (!analyserSaisie(input.value).nom) return;
    if (resultats.length) choisir(resultats[0]);
    else creer();
  };

  input.addEventListener('input', montrer);
  input.addEventListener('focus', () => { if (input.value) montrer(); });
  input.addEventListener('blur', () => setTimeout(fermer, 200));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); valider(); }
    if (e.key === 'Escape') fermer();
  });
  // Garder le clavier ouvert quand on touche une suggestion.
  liste.addEventListener('mousedown', (e) => e.preventDefault());
  liste.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.nouveau) creer();
    else choisir(resultats[Number(b.dataset.i)]);
  });
  conteneur.querySelector('[data-ac="valider"]').addEventListener('click', valider);
  return input;
}
