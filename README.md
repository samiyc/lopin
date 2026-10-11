# Bornage — Schotten Totten en cartes classiques

*Projet Lopin n°742 : 7 bornes, 42 cartes. Le choix du nom est expliqué dans
`docs/noms.md`.*

Adapter **Schotten Totten** (Reiner Knizia) à un jeu que tout le monde a dans un
tiroir, un jeu de 52 cartes ou un jeu de tarot :

- **42 cartes** = 7 bornes × 3 cartes × 2 joueurs ;
- **40 cartes « normales »** : 4 couleurs × 1-10 (jeu de 52 sans les figures),
  ou 5 couleurs × 1-8 (tarot : les 4 couleurs et les atouts de 1 à 8) ;
- **2 jokers** qui remplacent une carte.

## Le verdict

Le 4 couleurs marche, **à une condition : le joker vaut le chiffre qu'on veut,
mais il n'a pas de couleur.** Avec cette règle, l'ordre d'origine des
combinaisons reste juste, et c'est la variante la plus fidèle à l'original de
toutes celles testées. Avec un joker qui peut tout remplacer, aucun ordre ne
tient.

Les parties jouées pour de vrai (10 photos, 140 groupes de 3 cartes) confirment le
tableau. Les trois habitudes de jeu relevées pendant ces parties rendent le robot
plus fort : c'est donc ce robot « stratège » qui joue toutes les parties simulées.
Le détail est dans le rapport. Les 15 premières parties contre lui dans le
navigateur lui ont apporté deux idées de plus (version 1.1), et la relecture des
suivantes une troisième (1.2). Dans le navigateur, le Stratège 2.1 fait mieux : il
rejoue la fin de partie avant chaque coup. Voir `docs/analyse-replays.md` et
`docs/strategie.md`.

## Jouer contre les robots

```bash
npm run play      # puis http://127.0.0.1:4742/
```

Dans le navigateur, contre le robot Basique, Stratège ou Expérimental, avec les
règles de la fiche. Deux autres onglets : regarder deux robots s'affronter, et
relire les parties enregistrées. Chaque partie contre un robot est enregistrée
automatiquement. Mode d'emploi : `docs/jouer.md`.

## Les fichiers

| Où | Quoi |
|---|---|
| `regles/regles.pdf` | **la fiche de règles à imprimer** (A4 recto-verso) |
| `web/` | le jeu dans le navigateur (`npm run play`) |
| `out/deck-options.html` | « Deck options » : le rapport complet, interactif (s'ouvre d'un double-clic) |
| `out/deck-options.md` | le même rapport en ASCII art |
| `out/changelog-exp-1.2.html` | « Changelog Exp v1.2 », en cours : les pièges de fin de partie du cœur, le suivi des puzzles, l'extension (`npm run changelog -- 1.2`) |
| `out/changelog-exp-1.1.html` | « Changelog Exp v1.1 » : la base de référence V1 + Oracle et tout ce qui a été tenté du 1.0 au 1.1 (sorti le 06/10 : 7 réponses par étage) (`npm run changelog -- 1.1`) |
| `out/changelog-exp-1.0.html` | « Changelog Exp v1.0 » : tout ce qui a été tenté du 0.9 au 1.0 (`npm run changelog -- 1.0`) ; aussi `changelog-exp-0.8.html` et `changelog-exp-0.6.html` |
| `out/extension.html` | « L'extension » : les six cartes bonus et leur équilibre mesuré (`npm run extension`, règle dans `docs/extension.md`) |
| `out/OLD/retrospective.html` | archivée : la rétrospective du robot, ses onze versions sur une timeline, son cœur, les tours où la partie se joue (`npm run retrospective`) |
| `data/irl/essais.json` | les 10 parties réelles, transcrites depuis les photos |
| `data/replays/` | les replays gardés pour l'analyse (les autres vont dans `replays/`, hors git) |
| `docs/jouer.md` | jouer, observer, replays, versions des robots |
| `docs/analyse-replays.md` | les parties contre le Stratège, et les idées mesurées |
| `docs/strategie.md` | la stratégie des robots, principe par principe, avec ses tests et ses mesures |
| `docs/noms.md` | propositions de noms |
| `docs/methode.md` | méthode, hypothèses et limites des calculs |

## Commandes

Toutes les commandes, rangées par usage et avec le parcours d'une idée : [docs/commandes.md](docs/commandes.md).
Les mots des mesures (l'arbre, les validations, le nom des versions et des jobs) : [docs/glossaire.md](docs/glossaire.md).

```bash
npm run play      # le jeu dans le navigateur, http://127.0.0.1:4742/
npm run duel -- experimental stratege 2000   # deux robots face à face
npm run replays   # bilan des parties enregistrées
npm run build     # recalcule toutes les statistiques → out/ (environ 3 min)
npm run pdf       # regles/regles.html → regles/regles.pdf (Edge ou Chrome)
npm run check     # lint + tests, avant chaque commit
npm run backlog   # les longs traitements de la nuit, l'un après l'autre (data/backlog.json)
npm run oracle -- --bench stfig6,lean   # le banc oracle : classe des cœurs comme les duels longs
npm run shadow    # le V1 relit les parties jouées par l'oracle
npm run banc -- <moteur>   # trier une idée en quelques minutes : sa similitude avec l'oracle, contre le 1.0
npm run versus -- <A> <B>   # deux moteurs comparés sur leurs parties gardées
```

Aucun chiffre n'est tapé à la main dans les rapports : ils sortent tous de
`npm run build`, y compris le tableau « Les combinaisons en chiffres » de la fiche
de règles. Changer une règle, c'est modifier `src/config/` et relancer le build,
puis `npm run pdf`.

Les photos des parties réelles n'ont pas été gardées : elles étaient lourdes, et
certaines contenaient la position GPS du téléphone. Leur transcription est dans
`data/irl/essais.json`.

Les polices de la fiche de règles (Atkinson Hyperlegible, Bodoni Moda) sont
livrées dans `regles/fonts/`, sous licence SIL Open Font License.
