// Écran Courses : liste groupée par lieu d'achat, prix en FCFA, fin des courses.

import { tous, lire, ecrire, supprimer, lot, aliment, majAliment, foyer, reglages } from '../store.js';
import { LIEUX, UNITES, EMPLACEMENTS } from '../data/referentiel.js';
import { totaux, montant, nomDe, ajouterALaListe, terminerCourses, texteListe } from '../metier.js';
import { entete, champAliment, feuille, toast, conseilCourt, options, ICONES } from '../ui.js';
import { esc, fcfa, qte, qteUnite, nombre } from '../util.js';

let racine;

export function monter(el) {
  racine = el;
  el.innerHTML = `
    ${entete('Courses', `<button class="icone-btn" data-action="partager" aria-label="Partager la liste">${ICONES.partager}</button>`)}
    <div class="page">
      <div data-zone="ajout"></div>
      <div data-zone="liste"></div>
    </div>
    <div class="barre-totaux" data-zone="totaux" hidden></div>`;
  champAliment(el.querySelector('[data-zone="ajout"]'), {
    placeholder: 'Ajouter : « 2 tas gboma »',
    onChoix: (id, s) => {
      if (ajouterALaListe(id, s.quantite, s.unite) === 'fusion') toast(`${aliment(id).nom} : quantité augmentée`);
    },
  });
  el.addEventListener('click', clic);
}

export function maj() {
  const items = tous('liste');
  const zone = racine.querySelector('[data-zone="liste"]');
  zone.innerHTML = items.length
    ? LIEUX.map((lieu) => groupe(lieu, items.filter((i) => i.lieu === lieu.id))).join('')
    : `<div class="vide">
        <div class="vide-emoji">🧺</div>
        <p class="vide-titre">La liste est vide</p>
        <p>Tapez un article ci-dessus, par exemple « 1 kg tomates ». Les produits finis de l'onglet Maison s'y ajoutent aussi d'un geste.</p>
      </div>`;

  const barre = racine.querySelector('[data-zone="totaux"]');
  const { reste, depense } = totaux(items);
  const achetes = items.filter((i) => i.achete).length;
  barre.hidden = !items.length;
  barre.innerHTML = `
    <div class="totaux-texte">
      <span>Reste à acheter <strong>${fcfa(reste)}</strong></span>
      <span>Déjà payé <strong>${fcfa(depense)}</strong></span>
    </div>
    ${achetes ? `<button class="btn" data-action="terminer">Terminer (${achetes})</button>` : ''}`;
}

function groupe(lieu, items) {
  if (!items.length) return '';
  items.sort((a, b) => (a.achete - b.achete) || nomDe(a).localeCompare(nomDe(b), 'fr'));
  const sousTotal = items.reduce((s, i) => s + montant(i), 0);
  return `
    <section class="groupe">
      <h2 class="groupe-titre"><span>${lieu.icone} ${esc(lieu.nom)}</span><span>${sousTotal ? fcfa(sousTotal) : ''}</span></h2>
      <div class="carte">${items.map(ligne).join('')}</div>
    </section>`;
}

function ligne(i) {
  const al = aliment(i.alimentId);
  const prix = montant(i);
  const conseil = conseilCourt(al);
  // Dans un foyer partagé : qui a demandé cet article.
  const par = foyer() && i.ajoutePar && i.ajoutePar !== reglages().prenom ? ` · ${i.ajoutePar}` : '';
  return `
    <div class="ligne${i.achete ? ' fait' : ''}">
      <button class="coche" data-action="cocher" data-id="${i.id}" aria-pressed="${i.achete}"
        aria-label="${i.achete ? 'Décocher' : 'Cocher'} ${esc(nomDe(i))}"></button>
      <button class="ligne-corps" data-action="editer" data-id="${i.id}">
        <span class="ligne-nom">${esc(nomDe(i))}</span>
        <span class="ligne-detail">${esc(qteUnite(i.quantite, i.unite))}${conseil ? ` · ${esc(conseil)}` : ''}${esc(par)}</span>
      </button>
      <span class="ligne-prix${prix ? '' : ' muet'}">${prix ? fcfa(prix) : '— F'}</span>
    </div>`;
}

function clic(e) {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const { id } = b.dataset;
  if (b.dataset.action === 'cocher') {
    const i = lire('liste', id);
    ecrire('liste', { ...i, achete: !i.achete });
  }
  if (b.dataset.action === 'editer') editer(id);
  if (b.dataset.action === 'partager') partager();
  if (b.dataset.action === 'terminer') terminer();
}

function editer(id) {
  const i = lire('liste', id);
  const al = aliment(i.alimentId);
  feuille({
    titre: nomDe(i),
    corps: `
      ${al?.cons?.conseil ? `<p class="conseil-ligne">${esc(conseilCourt(al))}${al.cons.duree ? ` · ${esc(al.cons.duree)}` : ''}</p>` : ''}
      <div class="champs-2">
        <label>Quantité<input name="quantite" inputmode="decimal" value="${qte(i.quantite)}"></label>
        <label>Unité<select name="unite">${options(UNITES, i.unite)}</select></label>
      </div>
      <label>Où l'acheter<select name="lieu">${options(LIEUX, i.lieu)}</select></label>
      <div class="champs-2">
        <label>Prix habituel (F / ${esc(i.unite)})<input name="prix" inputmode="numeric" value="${al?.prix ?? ''}" placeholder="ex. 500"></label>
        <label>Prix payé (F, total)<input name="prixPaye" inputmode="numeric" value="${i.prixPaye ?? ''}" placeholder="au marché"></label>
      </div>
      <p class="aide">Le prix payé coche l'article ; à la fin des courses, il devient le prix habituel.</p>
      <button class="btn" type="submit">Enregistrer</button>
      <button class="btn btn-danger" type="button" data-action="retirer">Retirer de la liste</button>`,
    actions: {
      retirer: (_, f) => { supprimer('liste', id); f.fermer(); },
    },
    onSubmit: (fd, f) => {
      const prix = nombre(fd.get('prix'));
      const prixPaye = nombre(fd.get('prixPaye'));
      const unite = fd.get('unite');
      const lieu = fd.get('lieu');
      lot(() => {
        // L'appli retient les préférences : prochaine fois, même unité, même lieu, même prix.
        if (al) majAliment(al.id, { prix: prix ?? null, unite, lieu });
        ecrire('liste', {
          ...i, quantite: nombre(fd.get('quantite')) ?? i.quantite, unite, lieu, prixPaye,
          achete: prixPaye != null ? true : i.achete,
        });
      });
      f.fermer();
    },
  });
}

async function partager() {
  if (!tous('liste').some((i) => !i.achete)) return toast('Rien à partager : tout est déjà acheté.');
  const texte = texteListe();
  if (navigator.share) {
    try {
      await navigator.share({ text: texte });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(texte);
    toast('Liste copiée : collez-la dans WhatsApp.');
  } catch {
    feuille({ titre: 'Liste à copier', corps: `<textarea rows="14" readonly>${esc(texte)}</textarea>` });
  }
}

function terminer() {
  const n = tous('liste').filter((i) => i.achete).length;
  if (!confirm(`Ranger ${n > 1 ? `les ${n} articles achetés` : "l'article acheté"} dans le stock de la maison ?`)) return;
  const ranges = terminerCourses();
  const blocs = EMPLACEMENTS.filter((e) => ranges[e.id].length).map((e) => `
    <section class="rangement">
      <h3>${e.icone} ${esc(e.nom)}</h3>
      <ul>${ranges[e.id].map((id) => {
        const al = aliment(id);
        return `<li><strong>${esc(al?.nom)}</strong>${al?.cons?.conseil ? `<small>${esc(al.cons.conseil)}</small>` : ''}</li>`;
      }).join('')}</ul>
    </section>`).join('');
  feuille({
    titre: 'Où ranger les courses',
    corps: `<p class="intro">Tout est noté dans l'onglet Maison. Voici où mettre chaque produit :</p>${blocs}
      <button class="btn" type="button" data-action="fermer">C'est rangé</button>`,
  });
}
