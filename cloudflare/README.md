# Relais « Idées IA » (Cloudflare Worker)

`worker.js` reçoit la demande du téléphone, vérifie auprès de Firestore que la personne est membre d'un foyer, puis demande trois idées de plats à l'API Claude (modèle `claude-opus-5-5`, réponse en JSON structuré). La clé API reste dans Cloudflare.

## Déployer (sans rien installer)

1. **Clé Anthropic** : sur https://platform.claude.com, ajouter des crédits, fixer une limite mensuelle de dépense (Limits), puis créer une clé API.
2. **Worker** : sur https://dash.cloudflare.com, Workers et Pages > Créer > Worker « Hello World », nommé `assimeto-ia` > Déployer.
3. **Code** : Modifier le code, remplacer tout par le contenu de `worker.js`, puis Déployer.
4. **Secret** : Paramètres > Variables et secrets > Ajouter > type **Secret**, nom `ANTHROPIC_API_KEY`, valeur = la clé, puis Déployer.
5. **Appli** : mettre l'adresse du Worker (`https://assimeto-ia.<compte>.workers.dev`) dans `js/ia-config.js`, puis publier.

## Réglages dans `worker.js`

- `MODELE` : le modèle Claude utilisé.
- `ORIGINES` : les adresses autorisées à appeler le relais (le site GitHub Pages et le serveur local de test).
- `PROJET_FIREBASE` : le projet dont les membres de foyer sont acceptés.

Sécurité : sans jeton Firebase d'un membre de foyer, le relais répond 403. La limite de dépense fixée dans la console Anthropic plafonne le coût en cas d'abus.
