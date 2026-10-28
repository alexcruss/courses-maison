// Écran Réglages : prénom, installation sur l'iPhone, sauvegarde et restauration.

import { reglages, majReglages, exporter, importer, toutEffacer, compter } from '../store.js';
import { toast, ICONES } from '../ui.js';
import { esc } from '../util.js';

export const VERSION = '0.1.0';

let racine;

export function monter(el) {
  racine = el;
  el.innerHTML = `
    <header class="entete">
      <button class="icone-btn" data-action="retour" aria-label="Retour">${ICONES.retour}</button>
      <h1 class="h1-petit">Réglages</h1>
      <span></span>
    </header>
    <div class="page" data-zone="contenu"></div>`;
  el.addEventListener('click', clic);
  el.addEventListener('change', async (e) => {
    if (e.target.name === 'prenom') {
      majReglages({ prenom: e.target.value.trim() });
      toast('Prénom enregistré');
    }
    if (e.target.name === 'fichier' && e.target.files[0]) await restaurer(e.target.files[0]);
  });
}

export function maj() {
  const n = compter();
  racine.querySelector('[data-zone="contenu"]').innerHTML = `
    <section class="groupe">
      <h2 class="groupe-titre"><span>Sur ce téléphone</span></h2>
      <div class="carte carte-pleine">
        <label>Votre prénom<input name="prenom" value="${esc(reglages().prenom)}" placeholder="pour l'accueil" autocomplete="given-name"></label>
        <p class="aide">${n.liste} article(s) sur la liste · ${n.stock} dans le stock · ${n.recettes} recette(s) perso ou modifiée(s)</p>
      </div>
    </section>

    <section class="groupe">
      <h2 class="groupe-titre"><span>Installer sur l'iPhone</span></h2>
      <div class="carte carte-pleine">
        <ol class="etapes">
          <li>Ouvrir l'adresse de l'appli dans <strong>Safari</strong>.</li>
          <li>Toucher le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut).</li>
          <li>Choisir <strong>« Sur l'écran d'accueil »</strong>, puis <strong>Ajouter</strong>.</li>
          <li>Ouvrir ASSIMETO depuis l'icône : l'appli marche ensuite sans internet.</li>
        </ol>
      </div>
    </section>

    <section class="groupe">
      <h2 class="groupe-titre"><span>Sauvegarde</span></h2>
      <div class="carte carte-pleine">
        <p class="aide">Pour l'instant, les données ne sont que sur ce téléphone. Faites une sauvegarde de temps en temps (WhatsApp à vous-même, Fichiers, e-mail).</p>
        <button class="btn" data-action="exporter">Exporter une sauvegarde</button>
        <label class="btn btn-secondaire btn-fichier">Restaurer une sauvegarde
          <input type="file" name="fichier" accept=".json,application/json,text/plain" hidden>
        </label>
        <button class="btn btn-danger" data-action="effacer">Tout effacer</button>
      </div>
    </section>

    <p class="pied">ASSIMETO ${VERSION} · phase 1 : données sur ce téléphone.<br>Le partage du foyer arrive en phase 2.</p>`;
}

async function clic(e) {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  if (b.dataset.action === 'retour') {
    if (history.length > 1) history.back();
    else location.hash = '#courses';
  }
  if (b.dataset.action === 'exporter') await exporterFichier();
  if (b.dataset.action === 'effacer') {
    if (confirm('Effacer la liste, le stock, vos recettes et vos prix ? Cette action est définitive.')
      && confirm('Vraiment tout effacer ?')) {
      toutEffacer();
      toast('Données effacées');
    }
  }
}

async function exporterFichier() {
  const nom = `assimeto-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  const contenu = exporter();
  const fichier = new File([contenu], nom, { type: 'application/json' });
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: 'Sauvegarde ASSIMETO' });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(fichier);
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  setTimeout(() => { URL.revokeObjectURL(lien.href); lien.remove(); }, 1000);
}

async function restaurer(fichier) {
  try {
    const texte = await fichier.text();
    if (!confirm('Remplacer toutes les données de ce téléphone par cette sauvegarde ?')) return;
    importer(texte);
    toast('Sauvegarde restaurée');
  } catch (err) {
    alert(err.message || 'Fichier illisible.');
  }
}
