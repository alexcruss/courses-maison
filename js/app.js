// Démarrage : navigation entre les onglets, écran d'accueil, mode hors ligne.

import { abonner, reglages, majReglages } from './store.js';
import { esc } from './util.js';
import * as courses from './vues/courses.js';
import * as maison from './vues/maison.js';
import * as plats from './vues/plats.js';
import * as conserver from './vues/conserver.js';
import * as reglagesVue from './vues/reglages.js';

const VUES = { courses, maison, plats, conserver, reglages: reglagesVue };
const racine = document.getElementById('vue');
let courante = null;

function afficher() {
  const nom = location.hash.replace('#', '') || 'courses';
  courante = VUES[nom] || courses;
  const el = document.createElement('div');
  el.className = `vue vue-${nom}`;
  courante.monter(el);
  racine.replaceChildren(el);
  courante.maj();
  document.querySelectorAll('.onglets a').forEach((a) => {
    const actif = a.dataset.onglet === nom;
    a.classList.toggle('actif', actif);
    if (actif) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

// Premier lancement : présentation et prénom.
function bienvenue() {
  if (reglages().bienvenueVue) return;
  const el = document.createElement('div');
  el.className = 'bienvenue';
  el.innerHTML = `
    <div class="bienvenue-deco" aria-hidden="true">
      <span>🍅</span><span>🌶️</span><span>🥬</span><span>🐟</span><span>🍠</span><span>🥥</span><span>🧅</span><span>🍌</span>
    </div>
    <form class="bienvenue-contenu">
      <div class="bienvenue-panier" aria-hidden="true">🧺</div>
      <p class="script">Woézon, bienvenue !</p>
      <h1>Les courses, le frigo et les bons petits plats, au même endroit.</h1>
      <ul>
        <li>🛒 La liste par marché, supermarché et boutique, avec le total en FCFA</li>
        <li>🏠 Ce qu'il reste dans la réserve, le frigo et le congélateur</li>
        <li>🍲 Les plats togolais possibles avec ce qu'il y a à la maison</li>
        <li>❄️ Frigo ou pas frigo : le bon geste pour chaque aliment</li>
      </ul>
      <label>Votre prénom<input name="prenom" value="${esc(reglages().prenom)}" placeholder="pour vous saluer" autocomplete="given-name"></label>
      <button class="btn btn-clair" type="submit">Commencer</button>
    </form>`;
  el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    majReglages({ prenom: new FormData(e.target).get('prenom').trim(), bienvenueVue: true });
    el.classList.add('sortie');
    setTimeout(() => el.remove(), 300);
  });
  document.body.append(el);
}

window.addEventListener('hashchange', afficher);
abonner(() => courante?.maj());
afficher();
bienvenue();

// Sur le PC (localhost), pas de cache hors ligne pour voir chaque modification,
// sauf avec ?sw dans l'adresse pour tester le mode hors ligne.
const dev = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw');
if ('serviceWorker' in navigator) {
  if (dev) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  } else {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((err) => console.error(err)));
  }
}
// Demande à iOS de ne pas effacer les données de l'appli.
navigator.storage?.persist?.().catch(() => {});
