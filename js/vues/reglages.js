// Écran Réglages : prénom, foyer partagé, installation sur l'iPhone, sauvegarde.

import { reglages, majReglages, exporter, importer, toutEffacer, compter, foyer } from '../store.js';
import {
  configure, etat as etatSync, abonnerSync, creerFoyer, rejoindreFoyer, quitterFoyer, majMembre,
  formaterCode, messageErreur,
} from '../sync.js';
import { iaDisponible, etatAbonnement, etatConnu, resumeAbonnement } from '../ia.js';
import { ouvrirAbonnement } from '../abonnement.js';
import { feuille, toast, ICONES } from '../ui.js';
import { esc } from '../util.js';

export const VERSION = '0.4.0';

let racine;
let desabonner = null;

export function monter(el) {
  racine = el;
  // Le champ prénom n'est dessiné qu'une fois : une mise à jour venue d'un autre
  // téléphone ne doit pas effacer ce qu'on est en train de taper.
  el.innerHTML = `
    <header class="entete">
      <button class="icone-btn" data-action="retour" aria-label="Retour">${ICONES.retour}</button>
      <h1 class="h1-petit">Réglages</h1>
      <span></span>
    </header>
    <div class="page">
      <section class="groupe">
        <h2 class="groupe-titre"><span>Sur ce téléphone</span></h2>
        <div class="carte carte-pleine">
          <label>Votre prénom<input name="prenom" value="${esc(reglages().prenom)}" placeholder="vu par les autres membres du foyer" autocomplete="given-name"></label>
          <p class="aide" data-zone="compte"></p>
        </div>
      </section>
      <div data-zone="foyer"></div>
      <div data-zone="ia"></div>
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
      <div data-zone="sauvegarde"></div>
      <p class="pied">ASSIMETO ${VERSION}<br>Une appli FATALITY 2KP · Lomé</p>
    </div>`;
  el.addEventListener('click', clic);
  el.addEventListener('change', async (e) => {
    if (e.target.name === 'prenom') {
      majReglages({ prenom: e.target.value.trim() });
      majMembre();
      toast('Prénom enregistré');
    }
    if (e.target.name === 'fichier' && e.target.files[0]) await restaurer(e.target.files[0]);
  });
  desabonner = abonnerSync(() => dessinerFoyer());
  if (iaDisponible() && foyer() && navigator.onLine) {
    etatAbonnement().then(() => { if (racine === el) dessinerIA(); }).catch(() => {});
  }
}

export function demonter() {
  desabonner?.();
}

export function maj() {
  const n = compter();
  racine.querySelector('[data-zone="compte"]').textContent = `${n.liste} article(s) sur la liste · ${n.stock} dans le stock · ${n.recettes} recette(s) perso ou modifiée(s)`;
  dessinerFoyer();
  dessinerIA();
  const f = foyer();
  racine.querySelector('[data-zone="sauvegarde"]').innerHTML = `
    <section class="groupe">
      <h2 class="groupe-titre"><span>Sauvegarde</span></h2>
      <div class="carte carte-pleine">
        <p class="aide">${f
          ? 'Le foyer garde aussi toutes les données. Une sauvegarde dans un fichier reste une sécurité de plus.'
          : 'Les données ne sont que sur ce téléphone. Faites une sauvegarde de temps en temps (WhatsApp à vous-même, Fichiers, e-mail).'}</p>
        <button class="btn" data-action="exporter">Exporter une sauvegarde</button>
        <label class="btn btn-secondaire btn-fichier">Restaurer une sauvegarde
          <input type="file" name="fichier" accept=".json,application/json,text/plain" hidden>
        </label>
        ${f ? '' : '<button class="btn btn-danger" data-action="effacer">Tout effacer</button>'}
      </div>
    </section>`;
}

const STATUTS = {
  'a-jour': ['ok', 'À jour'],
  envoi: ['attente', 'Envoi des changements…'],
  'hors-ligne': ['attente', 'Hors ligne : les changements partiront au retour du réseau'],
  connexion: ['attente', 'Connexion…'],
  local: ['attente', 'Connexion…'],
};

function dessinerFoyer() {
  const zone = racine.querySelector('[data-zone="foyer"]');
  if (!zone) return;
  const titre = '<h2 class="groupe-titre"><span>Foyer partagé</span></h2>';
  if (!configure()) {
    zone.innerHTML = `<section class="groupe">${titre}<div class="carte carte-pleine">
      <p class="aide">Le partage entre plusieurs téléphones sera bientôt disponible.</p></div></section>`;
    return;
  }
  const f = foyer();
  if (!f) {
    zone.innerHTML = `<section class="groupe">${titre}<div class="carte carte-pleine">
      <p class="intro">Partagez la liste, le stock et les recettes avec toute la maison. Chaque téléphone garde sa copie et marche sans réseau ; les changements partent dès qu'il y a internet.</p>
      <button class="btn" data-action="creer">Créer le foyer</button>
      <button class="btn btn-secondaire" data-action="rejoindre">Rejoindre avec un code</button>
    </div></section>`;
    return;
  }
  const s = etatSync();
  const [classe, texte] = s.statut === 'erreur' ? ['erreur', s.erreur] : (STATUTS[s.statut] || STATUTS.connexion);
  zone.innerHTML = `<section class="groupe">${titre}<div class="carte carte-pleine">
    <p class="foyer-nom">🏠 ${esc(f.nom)}</p>
    <p class="sync sync-${classe}"><span class="sync-point" aria-hidden="true"></span>${esc(texte)}</p>
    <p class="aide">Code d'invitation</p>
    <p class="code-foyer">${esc(formaterCode(f.code))}</p>
    <button class="btn" data-action="inviter">Inviter quelqu'un</button>
    <p class="aide membres-titre">Membres</p>
    <ul class="membres">${s.membres.length
      ? s.membres.map((m) => `<li>${esc(m.prenom || 'Sans prénom')}${m.moi ? ' <small>(ce téléphone)</small>' : ''}</li>`).join('')
      : '<li class="muet">…</li>'}</ul>
    <button class="btn btn-danger" data-action="quitter">Quitter le foyer</button>
  </div></section>`;
}

// Accès aux idées de l'IA : essai, abonnement, paiement en attente.
function dessinerIA() {
  const zone = racine.querySelector('[data-zone="ia"]');
  if (!zone) return;
  if (!iaDisponible() || !foyer()) {
    zone.innerHTML = '';
    return;
  }
  const e = etatConnu();
  zone.innerHTML = `<section class="groupe">
    <h2 class="groupe-titre"><span>Idées de l'IA</span></h2>
    <div class="carte carte-pleine">
      <p class="intro">${esc(resumeAbonnement(e) || 'Connectez-vous à internet pour voir votre accès.')}</p>
      ${e && e.statut !== 'offert' ? `<button class="btn" data-action="abonner">${e.statut === 'abonne' ? "Prolonger l'abonnement" : "S'abonner : 300 F / 6 mois ou 500 F / an"}</button>` : ''}
    </div>
  </section>`;
}

async function clic(e) {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const action = b.dataset.action;
  if (action === 'abonner') ouvrirAbonnement({ apres: dessinerIA });
  if (action === 'retour') {
    if (history.length > 1) history.back();
    else location.hash = '#courses';
  }
  if (action === 'exporter') await exporterFichier();
  if (action === 'effacer') {
    if (confirm('Effacer la liste, le stock, vos recettes et vos prix ? Cette action est définitive.')
      && confirm('Vraiment tout effacer ?')) {
      toutEffacer();
      toast('Données effacées');
    }
  }
  if (action === 'creer') creer();
  if (action === 'rejoindre') rejoindre();
  if (action === 'inviter') await inviter();
  if (action === 'quitter' && confirm('Quitter le foyer ? Ce téléphone garde sa copie des données mais ne recevra plus les changements des autres.')) {
    await quitterFoyer();
    toast('Vous avez quitté le foyer');
  }
}

const champPrenom = () => (reglages().prenom ? '' : '<label>Votre prénom<input name="prenomFoyer" placeholder="vu par les autres membres"></label>');

// Bouton désactivé pendant l'appel au serveur, message clair en cas d'échec.
async function envoyerFormulaire(form, libelle, action) {
  const bouton = form.querySelector('button[type="submit"]');
  bouton.disabled = true;
  bouton.textContent = 'Un instant…';
  try {
    await action();
  } catch (err) {
    console.warn(err);
    toast(messageErreur(err));
    bouton.disabled = false;
    bouton.textContent = libelle;
  }
}

function creer() {
  feuille({
    titre: 'Créer le foyer',
    corps: `
      <p class="intro">Les données de ce téléphone deviennent celles du foyer. Vous recevrez ensuite un code à donner aux autres membres.</p>
      <label>Nom du foyer<input name="nom" placeholder="ex. La maison"></label>
      ${champPrenom()}
      <button class="btn" type="submit">Créer</button>`,
    onSubmit: (fd, f) => {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return toast('Donnez un nom au foyer.');
      if (fd.get('prenomFoyer')) majReglages({ prenom: String(fd.get('prenomFoyer')).trim() });
      envoyerFormulaire(f.form, 'Créer', async () => {
        const code = await creerFoyer(nom);
        f.fermer();
        toast(`Foyer créé. Code : ${formaterCode(code)}`);
      });
    },
  });
}

function rejoindre() {
  const n = compter();
  const aDesDonnees = n.liste + n.stock + n.recettes > 0;
  feuille({
    titre: 'Rejoindre un foyer',
    corps: `
      <p class="intro">Demandez le code à la personne qui a créé le foyer : il est dans ses Réglages.</p>
      <label>Code<input name="code" class="champ-code" placeholder="K7M-2QX" maxlength="7"
        autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false"></label>
      ${champPrenom()}
      ${aDesDonnees ? `<label class="case case-seule"><input type="checkbox" name="garder" checked>
        Ajouter au foyer ce qui est déjà sur ce téléphone (${n.liste} article(s) de liste, ${n.stock} du stock)</label>` : ''}
      <button class="btn" type="submit">Rejoindre</button>`,
    onSubmit: (fd, f) => {
      if (fd.get('prenomFoyer')) majReglages({ prenom: String(fd.get('prenomFoyer')).trim() });
      const garder = !aDesDonnees || fd.get('garder') === 'on';
      envoyerFormulaire(f.form, 'Rejoindre', async () => {
        const nom = await rejoindreFoyer(fd.get('code'), garder);
        f.fermer();
        toast(`Bienvenue dans « ${nom} »`);
      });
    },
  });
}

async function inviter() {
  const f = foyer();
  const adresse = location.origin + location.pathname;
  const texte = `Rejoins notre foyer « ${f.nom} » sur ASSIMETO 🧺\n`
    + `1. Ouvre ${adresse} dans Safari, puis Partager > Sur l'écran d'accueil\n`
    + `2. Dans l'appli : Réglages ⚙️ > Rejoindre avec un code\n`
    + `3. Code : ${formaterCode(f.code)}`;
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
    toast('Invitation copiée : collez-la dans WhatsApp.');
  } catch {
    feuille({ titre: 'Invitation à copier', corps: `<textarea rows="8" readonly>${esc(texte)}</textarea>` });
  }
}

async function exporterFichier() {
  const nom = `assimeto-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  const fichier = new File([exporter()], nom, { type: 'application/json' });
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
    if (!confirm('Remplacer les données de ce téléphone par cette sauvegarde ?')) return;
    importer(texte);
    toast('Sauvegarde restaurée');
  } catch (err) {
    alert(err.message || 'Fichier illisible.');
  }
}
