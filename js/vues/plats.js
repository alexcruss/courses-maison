// Écran Plats : ce qu'on peut cuisiner avec le stock, fiches recettes, recettes perso.

import { recette, ecrire, aliment, estRecetteDeBase, reglages } from '../store.js';
import { TYPES_RECETTE, TYPE } from '../data/referentiel.js';
import {
  suggestions, analyser, analyseStock, ingredientDispo, ingredientsEnStock,
  ajouterManquants, marquerEpuises,
} from '../metier.js';
import { feuille, toast, champAliment, assiette, options, salutation, ICONES } from '../ui.js';
import { iaDisponible, demanderIdees, rattacherIngredients, garderRecette } from '../ia.js';
import { esc, norm, qte, nombre } from '../util.js';

let racine;
let recherche = '';
let type = '';

export function monter(el) {
  racine = el;
  el.innerHTML = `
    <header class="entete entete-accueil">
      <div>
        <p class="script">${salutation()}</p>
        <h1>Qu'est-ce qu'on cuisine aujourd'hui ?</h1>
      </div>
      <div class="entete-actions">
        <button class="icone-btn" data-action="nouvelle" aria-label="Nouvelle recette">${ICONES.plus}</button>
        <a class="icone-btn" href="#reglages" aria-label="Réglages">${ICONES.reglages}</a>
      </div>
    </header>
    <div class="page">
      <label class="recherche">${ICONES.chercher}
        <input type="search" placeholder="Chercher un plat ou un ingrédient" aria-label="Chercher un plat" value="${esc(recherche)}">
      </label>
      <div class="puces" data-zone="types"></div>
      <div data-zone="contenu"></div>
    </div>`;
  el.querySelector('.recherche input').addEventListener('input', (e) => { recherche = e.target.value; maj(); });
  el.addEventListener('click', clic);
}

const correspond = (a) => {
  if (type && a.rec.type !== type) return false;
  const q = norm(recherche);
  if (!q) return true;
  return norm(a.rec.nom).includes(q) || a.rec.ingredients.some((i) => norm(aliment(i.id)?.nom).includes(q));
};

export function maj() {
  racine.querySelector('[data-zone="types"]').innerHTML = [{ id: '', nom: 'Tout', emoji: '🍽️' }, ...TYPES_RECETTE.filter((t) => t.id !== 'Autre')]
    .map((t) => `<button class="puce${t.id === type ? ' actif' : ''}" data-action="type" data-id="${t.id}">${t.emoji} ${esc(t.nom)}</button>`)
    .join('');

  const s = suggestions();
  const realisables = s.realisables.filter(correspond);
  const presque = s.presque.filter(correspond);
  const toutes = s.toutes.filter(correspond);

  racine.querySelector('[data-zone="contenu"]').innerHTML = `
    ${vedette(s, realisables, presque)}
    ${iaDisponible() && !s.stockVide ? `
      <button class="carte-ia" data-action="ia">
        <span class="carte-ia-icone" aria-hidden="true">✨</span>
        <span><strong>Idées de l'IA</strong><small>Trois plats imaginés avec ce qu'il y a à la maison</small></span>
      </button>` : ''}
    ${realisables.length ? `
      <section class="groupe">
        <h2 class="section-titre">Réalisables maintenant <span class="compte">${realisables.length}</span></h2>
        <div class="defile">${realisables.map(carte).join('')}</div>
      </section>` : ''}
    ${presque.length ? `
      <section class="groupe">
        <h2 class="section-titre">Il manque 1 ou 2 ingrédients <span class="compte">${presque.length}</span></h2>
        <div class="liste-cartes">${presque.map(cartePresque).join('')}</div>
      </section>` : ''}
    <section class="groupe">
      <h2 class="section-titre">Toutes les recettes <span class="compte">${toutes.length}</span></h2>
      ${toutes.length ? `<div class="carte">${toutes.map(ligneRecette).join('')}</div>` : '<p class="vide">Aucune recette ne correspond.</p>'}
    </section>`;
}

// Grande carte en haut : l'idée du jour, ou ce qu'il faut faire pour en avoir une.
function vedette(s, realisables, presque) {
  if (s.stockVide) {
    return `<a class="vedette" href="#maison">
      <div class="vedette-texte">
        <span class="vedette-etiquette">Pour commencer</span>
        <strong class="vedette-titre">Notez ce qu'il y a à la maison</strong>
        <span>Frigo, réserve, congélateur : l'appli proposera ensuite les plats possibles.</span>
        <span class="vedette-bouton">Remplir le stock →</span>
      </div>
      <span class="assiette grande" style="--teinte:#ffcf3f" aria-hidden="true"><span>🧺</span></span>
    </a>`;
  }
  const a = realisables[0] || presque[0];
  if (!a) return '';
  const r = a.rec;
  return `<button class="vedette" data-action="ouvrir" data-id="${esc(r.id)}">
    <div class="vedette-texte">
      <span class="vedette-etiquette">${a.ok ? `${realisables.length} plat${realisables.length > 1 ? 's' : ''} possible${realisables.length > 1 ? 's' : ''} · idée du jour` : 'Presque prêt'}</span>
      <strong class="vedette-titre">${esc(r.nom)}</strong>
      ${r.accompagnement ? `<span class="servi">Servi avec</span><span>${esc(r.accompagnement)}</span>` : ''}
      <span class="vedette-bouton">${a.ok ? (a.frais ? `✓ Utilise ${a.frais} produit${a.frais > 1 ? 's' : ''} du frigo` : '✓ Tout est à la maison') : `Manque : ${esc(nomsManquants(a))}`}</span>
    </div>
    ${assiette(r, 'grande')}
  </button>`;
}

// Un ingrédient proposé par l'IA peut ne pas encore exister dans le catalogue : on affiche son nom.
const nomIngredient = (i) => aliment(i.id)?.nom || i.nom || i.id;
const nomsManquants = (a) => a.manquants.map(nomIngredient).join(', ');
const SOURCES = { base: '', 'base-modifiee': 'modifiée', perso: 'ma recette', ia: 'idée IA' };
const meta = (r) => [TYPE[r.type]?.nom.replace(/s$/, ''), r.duree ? `${r.duree} min` : '', SOURCES[r.source] ?? 'ma recette']
  .filter(Boolean).join(' · ');

const carte = (a) => `
  <button class="carte-plat" data-action="ouvrir" data-id="${esc(a.rec.id)}">
    ${assiette(a.rec)}
    <span class="plat-nom">${esc(a.rec.nom)}</span>
    <span class="plat-meta">${esc(meta(a.rec))}</span>
    ${a.frais ? `<span class="plat-frais">❄️ ${a.frais} du frigo</span>` : ''}
  </button>`;

const cartePresque = (a) => `
  <div class="carte-presque">
    <button class="carte-presque-corps" data-action="ouvrir" data-id="${esc(a.rec.id)}">
      ${assiette(a.rec, 'petite')}
      <span><span class="plat-nom">${esc(a.rec.nom)}</span>
      <span class="plat-manque">Manque : ${esc(nomsManquants(a))}</span></span>
    </button>
    <button class="rond-plus" data-action="manquants" data-id="${esc(a.rec.id)}" aria-label="Ajouter les ingrédients manquants à la liste">${ICONES.plus}</button>
  </div>`;

const ligneRecette = (a) => `
  <button class="ligne ligne-recette" data-action="ouvrir" data-id="${esc(a.rec.id)}">
    ${assiette(a.rec, 'mini')}
    <span class="ligne-corps">
      <span class="ligne-nom">${esc(a.rec.nom)}</span>
      <span class="ligne-detail">${esc(meta(a.rec))}</span>
    </span>
    <span class="point ${a.ok ? 'ok' : 'manque'}" title="${a.ok ? 'Réalisable' : `${a.manquants.length} manquant(s)`}">${a.ok ? '✓' : a.manquants.length}</span>
  </button>`;

function clic(e) {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const { id, action } = b.dataset;
  if (action === 'type') { type = id; maj(); }
  if (action === 'ouvrir') ouvrir(recette(id));
  if (action === 'nouvelle') editer(null);
  if (action === 'ia') ideesIA();
  if (action === 'manquants') {
    const n = ajouterManquants(analyser(recette(id)));
    toast(`${n} ingrédient${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à la liste`);
  }
}

// ——— Fiche recette ———

// provisoire : idée de l'IA pas encore gardée (ni modifiable, ni supprimable).
function ouvrir(r, { provisoire = false } = {}) {
  if (!r) return;
  const stock = analyseStock();
  const a = analyser(r, stock);
  const ingredients = r.ingredients.map((i) => {
    const ok = ingredientDispo(i, stock);
    const alts = (i.alt || []).map((x) => aliment(x)?.nom).filter(Boolean).map((n) => n.charAt(0).toLowerCase() + n.slice(1));
    const etat = ok ? 'ok' : i.opt ? 'opt' : 'manque';
    return `<li class="${etat}">
      <span class="ing-etat">${ok ? '✓' : i.opt ? '○' : '✗'}</span>
      <span class="ing-nom">${esc(nomIngredient(i))}${alts.length ? ` <small>ou ${esc(alts.join(', '))}</small>` : ''}${i.opt ? ' <small>(facultatif)</small>' : ''}</span>
      <span class="ing-q">${esc(i.q || '')}</span>
    </li>`;
  }).join('');

  feuille({
    titre: '',
    classe: 'feuille-recette',
    corps: `
      <div class="recette-bandeau">${assiette(r, 'geante')}</div>
      <h2 class="recette-titre">${esc(r.nom)}</h2>
      <div class="recette-infos">
        <span>${TYPE[r.type]?.emoji || '🍽️'} ${esc(r.type)}</span>
        ${r.duree ? `<span>⏱ ${r.duree} min</span>` : ''}
        ${r.portions ? `<span>👥 ${r.portions} pers.</span>` : ''}
      </div>
      ${r.accompagnement ? `<p class="servi-avec"><span class="servi">Servi avec</span> ${esc(r.accompagnement)}</p>` : ''}
      ${r.pourquoi ? `<p class="pourquoi">✨ ${esc(r.pourquoi)}</p>` : ''}
      <p class="recette-etat ${a.ok ? 'ok' : 'manque'}">${a.ok
        ? '✓ Tout est à la maison'
        : `Il manque ${a.manquants.length} ingrédient${a.manquants.length > 1 ? 's' : ''} : ${esc(nomsManquants(a))}`}</p>
      <h3>Ingrédients</h3>
      <ul class="ingredients">${ingredients}</ul>
      ${r.etapes?.length ? `<h3>Préparation</h3><ol class="etapes">${r.etapes.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
      <div class="actions-recette">
        ${a.ok ? '' : `<button class="btn" type="button" data-action="manquants">🛒 Ajouter ${a.manquants.length > 1 ? `les ${a.manquants.length} manquants` : 'le manquant'} à la liste</button>`}
        ${provisoire ? `
        <button class="btn ${a.ok ? '' : 'btn-secondaire'}" type="button" data-action="garder">⭐ Garder cette recette</button>` : `
        <button class="btn ${a.ok ? '' : 'btn-secondaire'}" type="button" data-action="cuisine">🍲 J'ai cuisiné ce plat</button>
        <button class="btn btn-secondaire" type="button" data-action="modifier">Modifier la recette</button>
        <button class="btn btn-danger" type="button" data-action="supprimer">${estRecetteDeBase(r.id) ? 'Masquer cette recette' : 'Supprimer cette recette'}</button>`}
      </div>`,
    actions: {
      garder: (_, f) => {
        garderRecette(r);
        toast('Recette gardée dans Toutes les recettes');
        f.fermer();
      },
      manquants: (_, f) => {
        // Les ingrédients inconnus du catalogue y sont ajoutés pour pouvoir aller sur la liste.
        rattacherIngredients(r);
        const n = ajouterManquants(a);
        toast(`${n} ingrédient${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à la liste`);
        f.fermer();
      },
      cuisine: (_, f) => { f.fermer(); cuisine(r, stock); },
      modifier: (_, f) => { f.fermer(); editer(r); },
      supprimer: (_, f) => {
        if (!confirm(estRecetteDeBase(r.id) ? 'Masquer cette recette de base ?' : 'Supprimer cette recette ?')) return;
        ecrire('recettes', { ...r, masquee: true });
        f.fermer();
      },
    },
  });
}

// ——— Idées de l'IA ———

let derniereEnvie = '';

function ideesIA() {
  let idees = [];
  const f = feuille({
    titre: "Idées de l'IA",
    corps: `
      <div data-zone="demande">
        <p class="intro">L'IA regarde ce qu'il y a dans le stock (le frigo d'abord) et propose trois plats. Il faut internet.</p>
        <label>Une envie ? (facultatif)<input name="envie" value="${esc(derniereEnvie)}" placeholder="rapide, sans viande, pour des invités…"></label>
        <label>Pour combien de personnes<input name="personnes" inputmode="numeric" value="4"></label>
        <button class="btn" type="submit">✨ Proposer 3 plats</button>
      </div>
      <div data-zone="resultats"></div>`,
    actions: {
      voir: (b) => ouvrir(idees[Number(b.dataset.i)], { provisoire: true }),
      autres: (_, api) => api.form.requestSubmit(),
    },
    onSubmit: async (fd) => {
      derniereEnvie = String(fd.get('envie') || '').trim();
      const zone = f.zone.querySelector('[data-zone="resultats"]');
      const bouton = f.form.querySelector('button[type="submit"]');
      bouton.disabled = true;
      zone.innerHTML = '<div class="attente-ia"><span class="sablier" aria-hidden="true">🍲</span><p>L\'IA cherche des idées… (une vingtaine de secondes)</p></div>';
      try {
        idees = await demanderIdees({ envie: derniereEnvie, personnes: nombre(fd.get('personnes')) || 4 });
        const stock = analyseStock();
        zone.innerHTML = `<div class="liste-cartes">${idees.map((r, i) => {
          const a = analyser(r, stock);
          return `<button type="button" class="carte-presque carte-idee" data-action="voir" data-i="${i}">
            ${assiette(r, 'petite')}
            <span><span class="plat-nom">${esc(r.nom)}</span>
              <span class="plat-meta">${esc(meta(r))}</span>
              <span class="${a.ok ? 'plat-frais' : 'plat-manque'}">${a.ok ? '✓ Tout est à la maison' : `Manque : ${esc(nomsManquants(a))}`}</span></span>
          </button>`;
        }).join('')}</div>
        <button class="btn btn-secondaire" type="button" data-action="autres">🔄 Autres idées</button>`;
      } catch (err) {
        zone.innerHTML = `<p class="recette-etat manque">${esc(err.message)}</p>`;
      } finally {
        bouton.disabled = false;
      }
    },
  });
}

// Après le repas : quels produits sont finis ?
function cuisine(r, stock) {
  const utilises = [...new Set(r.ingredients.flatMap((i) => ingredientsEnStock(i, stock)))]
    .filter((id) => !aliment(id)?.basique);
  if (!utilises.length) return toast('Bon appétit !');
  feuille({
    titre: 'Bon appétit !',
    corps: `
      <p class="intro">Qu'est-ce qui est fini après ce repas ?</p>
      <div class="carte cases">${utilises.map((id) => `
        <label class="case"><input type="checkbox" name="fini" value="${esc(id)}"> ${esc(aliment(id)?.nom)}</label>`).join('')}
      </div>
      <label class="case case-seule"><input type="checkbox" name="versListe" checked> Remettre les produits finis sur la liste de courses</label>
      <button class="btn" type="submit">Valider</button>`,
    onSubmit: (fd, f) => {
      const finis = fd.getAll('fini');
      if (finis.length) {
        marquerEpuises(finis, fd.get('versListe') === 'on');
        toast(`${finis.length} produit${finis.length > 1 ? 's' : ''} marqué${finis.length > 1 ? 's' : ''} comme fini${finis.length > 1 ? 's' : ''}`);
      }
      f.fermer();
    },
  });
}

// ——— Création et modification ———

function editer(r) {
  const ings = r ? r.ingredients.map((i) => ({ ...i, alt: [...(i.alt || [])] })) : [];
  const f = feuille({
    titre: r ? 'Modifier la recette' : 'Nouvelle recette',
    corps: `
      <label>Nom du plat<input name="nom" value="${esc(r?.nom || '')}" placeholder="ex. Sauce gombo de maman"></label>
      <div class="champs-2">
        <label>Type<select name="type">${options(TYPES_RECETTE.map((t) => ({ id: t.id, nom: t.id })), r?.type || 'Sauce')}</select></label>
        <label>Emoji<input name="emoji" value="${esc(r?.emoji || '')}" placeholder="🍲" maxlength="4"></label>
      </div>
      <div class="champs-2">
        <label>Personnes<input name="portions" inputmode="numeric" value="${r?.portions || 4}"></label>
        <label>Durée (min)<input name="duree" inputmode="numeric" value="${r?.duree || ''}"></label>
      </div>
      <label>Servi avec<input name="accompagnement" value="${esc(r?.accompagnement || '')}" placeholder="ex. pâte de maïs"></label>
      <h3>Ingrédients</h3>
      <div data-zone="ings"></div>
      <div data-zone="ajout-ing"></div>
      <h3>Préparation</h3>
      <label class="discret">Une étape par ligne<textarea name="etapes" rows="6">${esc((r?.etapes || []).join('\n'))}</textarea></label>
      <button class="btn" type="submit">Enregistrer la recette</button>`,
    actions: {
      retirerIng: (b) => { ings.splice(Number(b.dataset.i), 1); dessiner(); },
      optIng: (b) => { const i = ings[Number(b.dataset.i)]; i.opt = !i.opt; dessiner(); },
    },
    onSubmit: (fd, api) => {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return toast('Donnez un nom au plat.');
      if (!ings.length) return toast('Ajoutez au moins un ingrédient.');
      ecrire('recettes', {
        id: r?.id,
        nom,
        type: fd.get('type'),
        emoji: String(fd.get('emoji') || '').trim(),
        portions: nombre(fd.get('portions')) || null,
        duree: nombre(fd.get('duree')) || null,
        accompagnement: String(fd.get('accompagnement') || '').trim(),
        source: r && estRecetteDeBase(r.id) ? 'base-modifiee' : 'perso',
        auteur: reglages().prenom || null,
        ingredients: ings,
        etapes: String(fd.get('etapes') || '').split('\n').map((x) => x.trim()).filter(Boolean),
      });
      toast('Recette enregistrée');
      api.fermer();
    },
  });

  const zoneIngs = f.zone.querySelector('[data-zone="ings"]');
  const dessiner = () => {
    zoneIngs.innerHTML = ings.length
      ? `<ul class="ings-edit">${ings.map((i, n) => `
          <li>
            <span class="ing-nom">${esc(aliment(i.id)?.nom || i.id)}</span>
            <input data-q="${n}" value="${esc(i.q || '')}" placeholder="quantité" aria-label="Quantité">
            <button type="button" class="puce${i.opt ? ' actif' : ''}" data-action="optIng" data-i="${n}">facultatif</button>
            <button type="button" class="lien danger" data-action="retirerIng" data-i="${n}" aria-label="Retirer">✕</button>
          </li>`).join('')}</ul>`
      : '<p class="aide">Aucun ingrédient pour l\'instant.</p>';
  };
  zoneIngs.addEventListener('input', (e) => {
    if (e.target.dataset.q !== undefined) ings[Number(e.target.dataset.q)].q = e.target.value;
  });
  champAliment(f.zone.querySelector('[data-zone="ajout-ing"]'), {
    placeholder: 'Ajouter un ingrédient',
    onChoix: (id, s) => {
      ings.push({ id, q: s.quantite ? `${qte(s.quantite)} ${s.unite || ''}`.trim() : '', alt: [], opt: false });
      dessiner();
    },
  });
  dessiner();
}
