// Écran Maison : stock de la réserve, du frigo et du congélateur.

import { tous, lire, ecrire, supprimer, aliment } from '../store.js';
import { EMPLACEMENTS, EMPL, UNITES } from '../data/referentiel.js';
import { estBas, dansLaListe, ajouterALaListe, ajouterAuStock, changerQuantite } from '../metier.js';
import { entete, champAliment, feuille, toast, pastille, conseilCourt, options } from '../ui.js';
import { esc, qte, nombre, ilYa, unite } from '../util.js';

let racine;
let onglet = 'frigo';

export function monter(el) {
  racine = el;
  el.innerHTML = `
    ${entete('Maison')}
    <div class="page">
      <div class="segments" role="tablist" data-zone="segments"></div>
      <div data-zone="ajout"></div>
      <div data-zone="stock"></div>
    </div>`;
  champAliment(el.querySelector('[data-zone="ajout"]'), {
    placeholder: 'Ajouter au stock…',
    onChoix: (id, s) => {
      const al = aliment(id);
      ajouterAuStock(id, onglet, s.quantite, s.unite);
      if (horsConseil(al, onglet)) toast(`${al.nom} : ${EMPL[al.cons.ou].conseil.toLowerCase()} de préférence`);
    },
  });
  el.addEventListener('click', clic);
}

// Rangé ailleurs qu'à l'endroit conseillé (le frigo reste admis pour un produit ouvert).
function horsConseil(al, emplacement) {
  if (!al || al.cat === 'entretien' || (al.perso && !al.cons?.conseil)) return false;
  return Boolean(al.cons?.ou) && al.cons.ou !== emplacement && al.cons.apres !== emplacement;
}

export function maj() {
  const stock = tous('stock');
  racine.querySelector('[data-zone="segments"]').innerHTML = EMPLACEMENTS.map((e) => {
    const n = stock.filter((s) => s.emplacement === e.id && s.quantite > 0).length;
    return `<button role="tab" aria-selected="${e.id === onglet}" class="${e.id === onglet ? 'actif' : ''}" data-action="onglet" data-id="${e.id}">
      <span>${e.icone} <span class="compte">${n}</span></span><span>${esc(e.nom)}</span></button>`;
  }).join('');

  const ici = stock.filter((s) => s.emplacement === onglet)
    .sort((a, b) => (aliment(a.alimentId)?.nom || '').localeCompare(aliment(b.alimentId)?.nom || '', 'fr'));
  const aRacheter = ici.filter(estBas);
  const enStock = ici.filter((s) => !estBas(s));
  const zone = racine.querySelector('[data-zone="stock"]');
  if (!ici.length) {
    zone.innerHTML = `<div class="vide">
      <div class="vide-emoji">${EMPL[onglet].icone}</div>
      <p class="vide-titre">Rien dans ${onglet === 'reserve' ? 'la réserve' : `le ${EMPL[onglet].nom.toLowerCase()}`}</p>
      <p>Notez ce qu'il y a à la maison : l'onglet Plats proposera ce qu'on peut cuisiner avec. Les courses terminées arrivent ici toutes seules.</p>
    </div>`;
    return;
  }
  zone.innerHTML = `
    ${aRacheter.length ? `<section class="groupe"><h2 class="groupe-titre"><span>À racheter</span></h2><div class="carte">${aRacheter.map(ligne).join('')}</div></section>` : ''}
    ${enStock.length ? `<section class="groupe"><h2 class="groupe-titre"><span>En stock</span></h2><div class="carte">${enStock.map(ligne).join('')}</div></section>` : ''}`;
}

function ligne(s) {
  const al = aliment(s.alimentId);
  const malRange = horsConseil(al, s.emplacement);
  const bas = estBas(s);
  return `
    <div class="ligne ligne-stock${s.quantite <= 0 ? ' epuise' : ''}">
      <div class="ligne-haut">
        ${pastille(al)}
        <button class="ligne-corps" data-action="editer" data-id="${s.id}">
          <span class="ligne-nom">${esc(al?.nom || '(aliment supprimé)')}</span>
          <span class="ligne-detail">${s.quantite > 0 ? `${esc(unite(s.quantite, s.unite))} · ajouté ${ilYa(s.ajouteLe)}` : 'Épuisé'}</span>
        </button>
        <div class="pas">
          <button data-action="moins" data-id="${s.id}" aria-label="Retirer un">−</button>
          <output>${qte(s.quantite)}</output>
          <button data-action="plus" data-id="${s.id}" aria-label="Ajouter un">+</button>
        </div>
      </div>
      ${malRange ? `<p class="ligne-note">💡 ${esc(conseilCourt(al))} de préférence</p>` : ''}
      ${bas ? `<div class="ligne-note ligne-note-action">
        ${dansLaListe(s.alimentId)
          ? '<span class="etiquette">✓ Sur la liste de courses</span>'
          : `<button class="btn btn-petit btn-chaud" data-action="versListe" data-id="${s.id}">+ Ajouter à la liste</button>`}
      </div>` : ''}
    </div>`;
}

function clic(e) {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const { id, action } = b.dataset;
  if (action === 'onglet') { onglet = id; maj(); }
  if (action === 'plus') changerQuantite(id, 1);
  if (action === 'moins') changerQuantite(id, -1);
  if (action === 'editer') editer(id);
  if (action === 'versListe') {
    const s = lire('stock', id);
    ajouterALaListe(s.alimentId);
    toast(`${aliment(s.alimentId)?.nom} ajouté à la liste`);
  }
}

function editer(id) {
  const s = lire('stock', id);
  const al = aliment(s.alimentId);
  feuille({
    titre: al?.nom || 'Article',
    corps: `
      ${al?.cons?.conseil ? `<div class="reco reco-${al.cons.ou}"><span class="reco-icone">${EMPL[al.cons.ou]?.icone}</span>
        <div><strong>${esc(al.cat === 'entretien' ? 'Rangement' : EMPL[al.cons.ou]?.conseil)}</strong>${al.cons.duree ? ` · ${esc(al.cons.duree)}` : ''}<br><small>${esc(al.cons.conseil)}</small></div></div>` : ''}
      <div class="champs-2">
        <label>Quantité<input name="quantite" inputmode="decimal" value="${qte(s.quantite)}"></label>
        <label>Unité<select name="unite">${options(UNITES, s.unite)}</select></label>
      </div>
      <label>Rangé dans<select name="emplacement">${options(EMPLACEMENTS, s.emplacement)}</select></label>
      <label>Prévenir « à racheter » quand il en reste<input name="seuil" inputmode="decimal" value="${qte(s.seuil || 0)}"></label>
      <button class="btn" type="submit">Enregistrer</button>
      <button class="btn btn-secondaire" type="button" data-action="versListe">Ajouter à la liste de courses</button>
      <button class="btn btn-danger" type="button" data-action="retirer">Retirer du stock</button>`,
    actions: {
      versListe: (_, f) => { ajouterALaListe(s.alimentId); toast(`${al?.nom} ajouté à la liste`); f.fermer(); },
      retirer: (_, f) => { supprimer('stock', id); f.fermer(); },
    },
    onSubmit: (fd, f) => {
      ecrire('stock', {
        ...s,
        quantite: Math.max(0, nombre(fd.get('quantite')) ?? s.quantite),
        unite: fd.get('unite'),
        emplacement: fd.get('emplacement'),
        seuil: Math.max(0, nombre(fd.get('seuil')) ?? 0),
      });
      f.fermer();
    },
  });
}
