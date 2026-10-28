# Relais « Idées IA » (Cloudflare Worker)

`worker.js` reçoit la demande du téléphone, vérifie auprès de Firestore que la personne est membre d'un foyer, contrôle son accès (essai, abonnement ou foyer offert), puis demande trois idées de plats à l'API Claude (réponse en JSON structuré). La clé API reste dans Cloudflare.

## Accès et modèles

| Foyer | Modèle | Limite |
|---|---|---|
| Essai | `claude-haiku-5-5` | 3 demandes |
| Abonné (300 F / 6 mois, 500 F / an) | `claude-haiku-5-5` | 60 demandes par mois |
| Offert (coché dans `admin.html`) | `claude-opus-5-5` | aucune |

Coût mesuré le 2026-10-28 : environ 1,2 F par demande avec Haiku, 29 F avec Opus. Seules les demandes réussies sont comptées.

## Adresses du relais

| Adresse | Rôle |
|---|---|
| `POST /idees` (ou `/`) | Trois idées de plats |
| `POST /etat` | Accès du foyer, formules, numéros de paiement, paiements en attente |
| `POST /paiement` | Le client déclare un paiement Flooz ou T-Money (formule, numéro, référence du SMS) |
| `POST /admin` | Tableau, validation, refus, accès offert ; en-tête `X-Cle-Admin` |

## Déployer (sans rien installer)

1. **Clé Anthropic** : sur https://platform.claude.com, ajouter des crédits, fixer une limite mensuelle de dépense (Limits), puis créer une clé API.
2. **Worker** : sur https://dash.cloudflare.com, Workers et Pages > Créer > Worker « Hello World », nommé `assimeto-ia` > Déployer.
3. **Base** : Storage & databases > D1 > Create, nommée `assimeto`. Puis Worker > Settings > Bindings > Add binding > D1 database, nom `DB`. Les tables se créent au premier appel.
4. **Code** : Modifier le code, remplacer tout par le contenu de `worker.js`, puis Déployer.
5. **Variables** : Settings > Variables and secrets > Add :
   - `ANTHROPIC_API_KEY` (Secret) : la clé Anthropic ;
   - `ADMIN_CLE` (Secret) : une phrase de 16 caractères ou plus, qui ouvre `admin.html` ;
   - `NUMERO_FLOOZ` et `NUMERO_TMONEY` (Text) : les numéros à 8 chiffres qui reçoivent les paiements. Sans eux, l'appli affiche « paiement pas encore ouvert » ;
   - `BENEFICIAIRE` (Text, facultatif) : le nom affiché à côté du numéro, « FATALITY 2KP » par défaut.
6. **Appli** : mettre l'adresse du Worker (`https://assimeto-ia.<compte>.workers.dev`) dans `js/ia-config.js`, puis publier.

## Réglages dans `worker.js`

- `MODELE_ABONNES`, `MODELE_OFFERT`, `ESSAIS`, `PLAFOND_MOIS`, `FORMULES` : modèles, essai, plafond mensuel et prix.
- `ORIGINES` : les adresses autorisées à appeler le relais (Cloudflare Pages, l'ancienne adresse GitHub Pages et le serveur local de test).
- `PROJET_FIREBASE` : le projet dont les membres de foyer sont acceptés.

## Valider un paiement

Ouvrir `https://assimeto.pages.dev/admin.html`, entrer la clé `ADMIN_CLE` (gardée sur ce téléphone), comparer le numéro et la référence avec le SMS Flooz ou T-Money reçu, puis **Valider**. L'abonnement part de la date de fin s'il court encore, sinon du jour de la validation.

Sécurité : sans jeton Firebase d'un membre de foyer, le relais répond 403. La limite de dépense fixée dans la console Anthropic plafonne le coût en cas d'abus.
