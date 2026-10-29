// Signe de vie envoyé au relais chaque minute tant que l'appli est ouverte et affichée,
// pour compter les personnes qui l'utilisent (admin.html). L'identifiant est tiré au hasard
// sur ce téléphone : ni nom, ni numéro, ni contenu du foyer ne partent avec.

import { IA_URL } from './ia-config.js';
import { uid } from './util.js';

const CLE = 'assimeto:appareil';
const MINUTE = 60000;

function appareil() {
  try {
    let id = localStorage.getItem(CLE);
    if (!id) localStorage.setItem(CLE, (id = uid()));
    return id;
  } catch {
    return null; // navigation privée : pas compté
  }
}

function signaler() {
  if (!IA_URL || document.visibilityState !== 'visible' || !navigator.onLine) return;
  const id = appareil();
  if (!id) return;
  // Corps en texte simple : le navigateur l'envoie sans requête préalable, et la réponse est ignorée.
  fetch(`${IA_URL}/presence`, { method: 'POST', body: JSON.stringify({ appareil: id }), keepalive: true }).catch(() => {});
}

export function demarrer() {
  signaler();
  setInterval(signaler, MINUTE);
  document.addEventListener('visibilitychange', signaler);
}
