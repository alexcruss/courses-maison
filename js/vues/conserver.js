// Écran Conserver : guide de conservation de chaque aliment, et réglages du catalogue.

import { catalogue, aliment, majAliment, ecrire, supprimer, tous, creerAliment } from '../store.js';
import { CATEGORIES, CAT, EMPLACEMENTS, EMPL, LIEUX, UNITES } from '../data/referentiel.js';
import { ajouterALaListe, ajouterAuStock } from '../metier.js';
import { entete, feuille, toast, options, pastille, ICONES } from '../ui.js';
import { esc, norm, nombre, fcfa, majuscule } from '../util.js';

let racine;
let recherche = '';
let filtre = '';

export function monter(el) {
  racine = el;
  el.innerHTML = `
    ${entete('Conserver', `<button class="icone-btn" data-action="nouveau" aria-label="Nouvel aliment">${ICONES.plus}</button>`)}
    <div class="page">
      <p class="intro">Frigo ou pas frigo ? Les bons gestes pour chaque aliment, par temps chaud.</p>
      <label class="recherche">${ICONES.chercher}
        <input type="search" placeholder="Chercher : gboma, igname, œufs…" aria-label="Chercher un aliment" value="${esc(recherche)}">
      </label>
      <div class="puces" data-zone="filtres"></div>
      <div data-zone="contenu"></div>
    </div>`;
  el.querySelector('.recherche input').addEventListener('input', (e) => { recherche = e.target.value; maj(); });
  el.addEventListener('click', clic);
}

export function maj() {
  racine.querySelector('[data-zone="filtres"]').innerHTML = [{ id: '', icone: '📋', conseil: 'Tous' }, ...EMPLACEMENTS]
    .map((e) => `<button class="puce${e.id === filtre ? ' actif' : ''}" data-action="filtre" data-id="${e.id}">${e.icone} ${esc(e.conseil)}</button>`)
    .join('');

  const q = norm(recherche);
  const items = catalogue().filter((al) => (!filtre || (al.cons?.ou === filtre && al.cat !== 'entretien'))
    && (!q || [al.nom, ...(al.alias || [])].some((n) => norm(n).includes(q))));
  const zone = racine.querySelector('[data-zone="contenu"]');
  if (!items.length) {
    zone.innerHTML = `<div class="vide"><p class="vide-titre">Aucun aliment trouvé</p>
      <p>Ajoutez-le avec le bouton + en haut : vous pourrez noter vous-même où le ranger.</p></div>`;
    return;
  }
  zone.innerHTML = CATEGORIES.map((c) => {
    const duGroupe = items.filter((al) => (CAT[al.cat] ? al.cat : 'autre') === c.id);
    if (!duGroupe.length) return '';
    return `<section class="groupe">
      <h2 class="groupe-titre"><span>${c.icone} ${esc(c.nom)}</span></h2>
      <div class="carte">${duGroupe.map(ligne).join('')}</div>
    </section>`;
  }).join('');
}

function ligne(al) {
  const e = EMPL[al.cons?.ou] || EMPL.reserve;
  const entretien = al.cat === 'entretien';
  return `
    <button class="ligne ligne-guide" data-action="ouvrir" data-id="${esc(al.id)}">
      ${pastille(al)}
      <span class="ligne-corps">
        <span class="ligne-nom">${esc(al.nom)}</span>
        <span class="ligne-detail">${entretien ? 'Rangement' : esc(al.cons?.duree || 'Conseil à compléter')}</span>
      </span>
      ${entretien ? '' : `<span class="etiquette-cons cons-${e.id}">${e.icone} ${esc(e.conseil)}</span>`}
    </button>`;
}

function clic(e) {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const { id, action } = b.dataset;
  if (action === 'filtre') { filtre = id; maj(); }
  if (action === 'ouvrir') ouvrir(id);
  if (action === 'nouveau') nouvelAliment();
}

function nouvelAliment() {
  feuille({
    titre: 'Nouvel aliment',
    corps: `
      <label>Nom<input name="nom" value="${esc(majuscule(recherche.trim()))}" placeholder="ex. Lanhouin"></label>
      <div class="champs-2">
        <label>Catégorie<select name="cat">${options(CATEGORIES, 'autre')}</select></label>
        <label>Unité<select name="unite">${options(UNITES, 'pièce')}</select></label>
      </div>
      <label>Où l'acheter<select name="lieu">${options(LIEUX, 'marche')}</select></label>
      <button class="btn" type="submit">Créer</button>`,
    onSubmit: (fd, f) => {
      const nom = majuscule(String(fd.get('nom') || '').trim());
      if (!nom) return toast("Donnez un nom à l'aliment.");
      const al = creerAliment({ nom, cat: fd.get('cat'), unite: fd.get('unite'), lieu: fd.get('lieu') });
      f.fermer();
      ouvrir(al.id);
    },
  });
}

function ouvrir(id) {
  const al = aliment(id);
  const e = EMPL[al.cons?.ou] || EMPL.reserve;
  const entretien = al.cat === 'entretien';
  const champsPerso = al.perso ? `
    <h3>Cet aliment</h3>
    <label>Nom<input name="nom" value="${esc(al.nom)}"></label>
    <label>Catégorie<select name="cat">${options(CATEGORIES, al.cat)}</select></label>
    <div class="champs-2">
      <label>Se conserve<select name="ou">${options(EMPLACEMENTS.map((x) => ({ id: x.id, nom: x.conseil, icone: x.icone })), al.cons?.ou)}</select></label>
      <label>Combien de temps<input name="duree" value="${esc(al.cons?.duree || '')}" placeholder="ex. 3 jours"></label>
    </div>
    <label>Conseil<textarea name="conseil" rows="3" placeholder="ex. dans un sachet au bac à légumes">${esc(al.cons?.conseil || '')}</textarea></label>` : '';

  feuille({
    titre: al.nom,
    corps: `
      ${al.perso && !al.cons?.conseil ? '' : `
      <div class="reco reco-${e.id}">
        <span class="reco-icone">${entretien ? CAT.entretien.icone : e.icone}</span>
        <div><strong>${entretien ? 'Rangement' : esc(e.conseil)}</strong>${al.cons?.duree ? `<br><span>${esc(al.cons.duree)}</span>` : ''}</div>
      </div>
      <p class="conseil">${esc(al.cons?.conseil || '')}</p>
      ${al.cons?.apres ? `<p class="conseil-apres">Une fois ouvert : ${esc(EMPL[al.cons.apres].conseil.toLowerCase())}.</p>` : ''}`}
      ${champsPerso}
      <h3>Pour les courses</h3>
      <div class="champs-2">
        <label>Prix habituel (F)<input name="prix" inputmode="numeric" value="${al.prix ?? ''}" placeholder="par unité"></label>
        <label>Unité<select name="unite">${options(UNITES, al.unite)}</select></label>
      </div>
      <label>Où l'acheter<select name="lieu">${options(LIEUX, al.lieu)}</select></label>
      ${al.prix ? `<p class="aide">Dernier prix retenu : ${fcfa(al.prix)} par ${esc(al.unite)}.</p>` : ''}
      <button class="btn" type="submit">Enregistrer</button>
      <div class="champs-2">
        <button class="btn btn-secondaire" type="button" data-action="liste">🛒 Sur la liste</button>
        <button class="btn btn-secondaire" type="button" data-action="stock">🏠 Dans le stock</button>
      </div>
      ${al.perso ? '<button class="btn btn-danger" type="button" data-action="supprimer">Supprimer cet aliment</button>' : ''}`,
    actions: {
      liste: (_, f) => { ajouterALaListe(id); toast(`${aliment(id).nom} ajouté à la liste`); f.fermer(); },
      stock: (_, f) => {
        const ou = aliment(id).cons?.ou || 'reserve';
        ajouterAuStock(id, ou);
        toast(`${aliment(id).nom} ajouté : ${EMPL[ou].nom}`);
        f.fermer();
      },
      supprimer: (_, f) => {
        const utilise = tous('liste').some((i) => i.alimentId === id) || tous('stock').some((s) => s.alimentId === id);
        if (utilise) return toast("Retirez-le d'abord de la liste et du stock.");
        if (!confirm(`Supprimer « ${al.nom} » ?`)) return;
        supprimer('aliments', id);
        f.fermer();
      },
    },
    onSubmit: (fd, f) => {
      const patch = { prix: nombre(fd.get('prix')), unite: fd.get('unite'), lieu: fd.get('lieu') };
      if (al.perso) {
        Object.assign(patch, {
          nom: String(fd.get('nom') || '').trim() || al.nom,
          cat: fd.get('cat'),
          cons: { ou: fd.get('ou'), duree: String(fd.get('duree') || '').trim(), conseil: String(fd.get('conseil') || '').trim(), apres: null },
        });
        ecrire('aliments', { ...aliment(id), ...patch });
      } else {
        majAliment(id, patch);
      }
      toast('Enregistré');
      f.fermer();
    },
  });
}
