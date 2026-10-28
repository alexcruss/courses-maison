// Abonnement aux idées de l'IA : 300 F les 6 mois ou 500 F l'année, pour tout le foyer.
// Le client envoie l'argent par Flooz ou T-Money au numéro affiché, puis recopie la
// référence du SMS ; le paiement est validé à la main dans admin.html.

import { etatAbonnement, declarerPaiement, resumeAbonnement } from './ia.js';
import { feuille } from './ui.js';
import { esc, fcfa } from './util.js';

const MOYENS = { flooz: 'Flooz', tmoney: 'T-Money' };
const numero = (n) => String(n).replace(/(\d{2})(?=\d)/g, '$1 ');
const date = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

// apres : appelé quand un paiement a été envoyé, pour rafraîchir l'écran d'origine.
export function ouvrirAbonnement({ apres } = {}) {
  let etat = null;
  const f = feuille({
    titre: "Idées de l'IA",
    corps: '<div class="attente-ia"><span class="sablier" aria-hidden="true">🍲</span><p>Un instant…</p></div>',
    onSubmit: async (fd, api) => {
      const bouton = api.form.querySelector('button[type="submit"]');
      bouton.disabled = true;
      try {
        etat = await declarerPaiement({
          formule: fd.get('formule'),
          moyen: fd.get('moyen'),
          telephone: fd.get('telephone'),
          reference: fd.get('reference'),
        });
        api.zone.innerHTML = `
          <div class="vide">
            <div class="vide-emoji" aria-hidden="true">🙏</div>
            <p class="vide-titre">Merci !</p>
            <p>Votre paiement va être vérifié, en général dans la journée. L'abonnement s'activera alors sur tous les téléphones du foyer.</p>
          </div>
          <button class="btn" type="button" data-action="fermer">Fermer</button>`;
        apres?.();
      } catch (err) {
        api.zone.querySelector('[data-zone="erreur"]').innerHTML = `<p class="recette-etat manque">${esc(err.message)}</p>`;
        bouton.disabled = false;
      }
    },
  });
  f.zone.addEventListener('change', () => consigne(f, etat));

  etatAbonnement()
    .then((e) => { etat = e; dessiner(f, e); })
    .catch((err) => { f.zone.innerHTML = `<p class="recette-etat manque">${esc(err.message)}</p>`; });
}

function dessiner(f, e) {
  const moyens = Object.keys(MOYENS).filter((m) => e.numeros?.[m]);
  const attente = (e.attente || []).map((p) => `<li>${fcfa(p.montant)} par ${esc(MOYENS[p.moyen] || p.moyen)}, envoyé le ${date(p.cree_le)}</li>`).join('');
  f.zone.innerHTML = `
    <p class="abo-statut">${esc(resumeAbonnement(e))}</p>
    ${attente ? `<div class="abo-attente"><strong>En cours de vérification</strong><ul>${attente}</ul></div>` : ''}
    <p class="intro">Trois idées de plats à chaque demande, faites avec ce qu'il y a à la maison. L'abonnement vaut pour tout le foyer, sur tous ses téléphones${e.plafondMois ? `, jusqu'à ${e.plafondMois} demandes par mois` : ''}.</p>
    ${moyens.length ? `
      <h3>${e.statut === 'abonne' ? 'Prolonger' : 'Choisir une formule'}</h3>
      <div class="formules">${e.formules.map((x, i) => `
        <label class="formule">
          <input type="radio" name="formule" value="${esc(x.id)}"${i === e.formules.length - 1 ? ' checked' : ''}>
          <span><strong>${esc(x.nom)}</strong><small>${fcfa(x.prix)}${x.mois === 12 ? ' · le plus avantageux' : ''}</small></span>
        </label>`).join('')}
      </div>
      <h3>Payer par</h3>
      <div class="formules formules-moyens">${moyens.map((m, i) => `
        <label class="formule">
          <input type="radio" name="moyen" value="${m}"${i === 0 ? ' checked' : ''}>
          <span><strong>${MOYENS[m]}</strong></span>
        </label>`).join('')}
      </div>
      <div class="abo-consigne" data-zone="consigne"></div>
      <label>Numéro qui a payé<input name="telephone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="90 12 34 56"></label>
      <label>Référence du SMS de paiement<input name="reference" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ex. 2410281234"></label>
      <div data-zone="erreur"></div>
      <button class="btn" type="submit">J'ai payé</button>`
    : '<p class="recette-etat manque">Le paiement par Flooz ou T-Money n\'est pas encore ouvert. Revenez bientôt.</p>'}`;
  consigne(f, e);
}

// Montant et numéro à jour selon la formule et le moyen choisis.
function consigne(f, e) {
  const zone = f.zone.querySelector('[data-zone="consigne"]');
  if (!zone || !e) return;
  const fd = new FormData(f.form);
  const formule = e.formules.find((x) => x.id === fd.get('formule'));
  const moyen = fd.get('moyen');
  zone.innerHTML = `
    <p><span class="abo-etape">1</span><span>Envoyez <strong>${fcfa(formule.prix)}</strong> par ${MOYENS[moyen]} au
      <strong class="abo-numero">${numero(e.numeros[moyen])}</strong>${e.beneficiaire ? ` (${esc(e.beneficiaire)})` : ''}.</span></p>
    <p><span class="abo-etape">2</span><span>Recopiez ci-dessous votre numéro et la référence reçue par SMS.</span></p>`;
}
