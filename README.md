# ASSIMETO

Appli web installable (PWA) pour les courses de la maison, pensée pour un iPhone :

- **Courses** : liste groupée par marché, supermarché et boutique, prix en FCFA, total estimé, partage par WhatsApp, rangement guidé à la fin des courses.
- **Maison** : stock de la réserve, du frigo et du congélateur, alerte « à racheter ».
- **Plats** : plats togolais réalisables avec le stock, ou auxquels il manque 1 ou 2 ingrédients ; recettes perso.
- **Conserver** : frigo ou pas frigo, durée et bon geste pour une centaine d'aliments.
- **Foyer partagé** : plusieurs téléphones partagent la liste, le stock, les recettes et les prix (Firebase).

Tout fonctionne sans internet. Écrite en HTML, CSS et JavaScript, sans framework ni étape de compilation.

## Installer sur l'iPhone

1. Ouvrir **https://alexcruss.github.io/courses-maison/** dans **Safari** (pas Chrome : iOS 16 n'installe les applis web que depuis Safari).
2. Bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. Ouvrir **ASSIMETO** depuis l'icône.

Pour partager avec la maison : sur un premier téléphone, Réglages → **Créer le foyer** ; les autres font Réglages → **Rejoindre avec un code**. Une sauvegarde dans un fichier se fait dans Réglages → « Exporter une sauvegarde ».

## Foyer partagé (Firebase)

- Projet Firebase gratuit (offre Spark) : connexion **anonyme** activée, base **Firestore**, domaine `alexcruss.github.io` autorisé.
- Les règles de sécurité sont dans [firestore.rules](firestore.rules) : à recoller dans la console (Firestore → Règles → Publier) après chaque modification.
- La configuration web du projet est dans `js/firebase-config.js` (valeurs publiques, la sécurité vient des règles). Avec `null`, l'appli reste sur le téléphone.
- Synchronisation (`js/sync.js`) : chaque téléphone garde ses données et envoie ses modifications ; la version la plus récente (`majLe`) gagne, et les règles refusent d'écraser une version plus récente.
- Données dans Firestore : `foyers/{id}` (nom, code), `foyers/{id}/membres/{uid}`, `foyers/{id}/{liste|stock|recettes|aliments}/{id}`, et `codes/{code}` pour retrouver un foyer par son code d'invitation.

## Travailler sur le code (PC Windows, rien à installer)

```powershell
# Lancer l'appli sur le PC : http://localhost:8124
powershell -ExecutionPolicy Bypass -File tools\serve.ps1

# Publier une nouvelle version sur GitHub Pages
powershell -ExecutionPolicy Bypass -File tools\publier.ps1 "Ce qui a changé"

# Redessiner les icônes
powershell -ExecutionPolicy Bypass -File tools\icones.ps1
```

- Sur `localhost`, le cache hors ligne est désactivé pour voir chaque modification. Ajouter `?sw` à l'adresse pour tester le mode hors ligne.
- `tools\publier.ps1` change `VERSION` dans `sw.js` : sans ce changement, les téléphones gardent l'ancienne version en cache.
- Un fichier JavaScript ajouté doit aussi être ajouté à la liste `FICHIERS` de `sw.js`.

## Organisation

| Fichier | Rôle |
|---|---|
| `index.html`, `css/app.css` | Page unique et styles (clair et sombre) |
| `js/app.js` | Navigation entre onglets, écran d'accueil, service worker |
| `js/store.js` | Données du foyer dans `localStorage` (clé `assimeto:v1`) |
| `js/sync.js`, `js/firebase-config.js` | Partage du foyer avec Firebase |
| `js/metier.js` | Règles : totaux, fin des courses, plats réalisables, recherche |
| `js/ui.js` | En-tête, feuilles du bas, champ d'ajout avec suggestions |
| `js/vues/*.js` | Un fichier par écran |
| `js/data/aliments.js` | Catalogue de base et conseils de conservation |
| `js/data/recettes.js` | Recettes de base |
| `js/data/referentiel.js` | Lieux, emplacements, catégories, unités, types de plats |
| `sw.js` | Cache hors ligne |

Chaque enregistrement du foyer (liste, stock, recettes, aliments modifiés) porte `id`, `majLe`, `majPar` et `supprime` : c'est ce qui permettra la synchronisation Firebase de la phase 2.

## Suite prévue

- **Phase 3** : bouton « Idées IA » (relais Cloudflare vers l'API Claude).
