# Feuille de route hors du jeu

Sami (22/10) : d'abord l'ordonnanceur, dans ce dépôt ; ensuite les déplacements, avec trois thèmes
concrets (l'entrepôt, la cuisine, les secours), et dans les trois **un humain qui coopère avec des
robots**. Une bibliothèque commune, avec des signatures, servira à tous. Les adversaires cachés passent
après.

## 1. L'ordre

1. **L'ordonnanceur de la backlog**, ici : les priorités, les échéances, les prérequis, puis plusieurs
   jobs côte à côte et le planificateur ([`backlog.md`](backlog.md), § 9.6). C'est la famille A de
   [`planification.md`](planification.md).
2. **Les déplacements**, dans un dépôt à part : un moteur, trois habillages (§ 2), la coopération avec un
   humain (§ 3). C'est la famille B.
3. **Les adversaires cachés** (famille C) : seulement si un défi CodinGame en temps réel plaît (§ 5).

La bibliothèque commune (§ 4) naît pendant l'étape 1 et sort du dépôt au début de l'étape 2.

## 2. Un moteur, trois habillages

L'entrepôt, la cuisine et les secours sont **le même problème** : des agents sur une grille, des tâches
qui apparaissent, des chemins qui peuvent se fermer. Un seul simulateur suffit, avec un générateur de
tâches et une apparence par thème. Ce qui change, c'est la difficulté propre à chacun :

| | L'entrepôt | La cuisine | Les secours |
|---|---|---|---|
| **Les tâches** | des colis à porter au camion | des plats à préparer et à servir | des victimes à trouver et à évacuer |
| **Ce qui est incertain** | les allées bloquées, découvertes en arrivant (le voyageur canadien) | les commandes qui arrivent | **où sont les victimes** : un état caché qui se révèle (POMCP) |
| **La difficulté propre** | les embouteillages entre robots (A* avec réservations) | **les recettes s'enchaînent** : couper, cuire, dresser, comme les prérequis de la backlog (§ 9.4) | explorer ou évacuer : chercher encore, ou ramener ceux qu'on a trouvés |
| **Ce que fait l'humain** | un cariste qui prend des commandes | un cuisinier, comme dans *Overcooked* | un chef d'équipe sur le terrain |

L'ordre conseillé : **l'entrepôt d'abord** (le plus simple, et le plan de 17 × 7 est prêt dans
[`entrepot.md`](entrepot.md)), puis **la cuisine** (elle ajoute les enchaînements), puis **les secours**
(ils ajoutent l'état caché).

## 3. La coopération entre un humain et des robots

C'est ce qui rend les trois thèmes parlants, et c'est là que l'expérience de Lopin sert directement.
- **Les robots ne commandent pas l'humain** : il fait ce qu'il veut. Ses intentions sont cachées, comme la
  main adverse dans Lopin. Les robots tirent ce qu'il va probablement faire et replanifient à chaque
  événement.
- **Un modèle de l'humain**, comme `+theirs` fait jouer l'adversaire par un autre cœur. Carroll et al.
  (NeurIPS 2019, [`planification.md`](planification.md) § 4) l'ont mesuré : un agent qui ne s'est entraîné
  qu'avec lui-même coordonne mal avec un humain. Au départ, trois humains simulés suffisent : celui qui
  prend la tâche la plus proche, celui qui prend la plus urgente, celui qui joue au hasard.
- **Montrer le plan** : chaque robot affiche sur l'écran la tâche qu'il vise. L'humain s'organise mieux
  avec des robots lisibles, et la démonstration s'explique toute seule.
- **La mesure** : le score de l'équipe avec chaque humain simulé, puis avec de vrais joueurs dans le
  navigateur, contre des robots qui suivent la règle simple.

## 4. La bibliothèque commune

**Où.** Elle commence dans ce dépôt, dans un dossier `lib/` qui n'importe rien du jeu (ni `src/sim`, ni
le cœur), pendant l'ordonnanceur. Elle sort dans son propre dépôt quand l'étape 2 commence. Lopin pourra
en devenir un client si son empreinte ne bouge pas ([`README.md`](README.md) § 4).

**Les modules.**

| Module | Ce qu'il contient | Qui s'en sert |
|---|---|---|
| `random` | le tirage reproductible, à partir d'une graine (celui de `src/core/random.js`) | tous |
| `events` | la simulation à événements discrets : une file d'événements datés | l'ordonnanceur, les trois thèmes |
| `mcts` | la recherche : le tirage d'un scénario, la liste courte, la descente, la simulation, le coup le plus visité | tous |
| `grid` | A*, la table de réservations | les trois thèmes |
| `measure` | les intervalles de Wilson, la comparaison par paires sur les mêmes scénarios | tous |

**Les signatures de `mcts`.** Un problème décrit ce que la recherche doit savoir faire ; la recherche ne
connaît rien d'autre.

```js
/**
 * What a problem gives the search.
 * @typedef {object} Problem
 * @property {(state, rng) => World} sample        a scenario consistent with what is known
 * @property {(world) => string} actor             who decides now: a robot, the human, an opponent
 * @property {(world) => Move[]} moves             the legal decisions at this event
 * @property {(world, moves) => Move[]} shortlist  the fast rule's best few
 * @property {(move) => string} key                a move's name, shared by every scenario
 * @property {(world, move) => World} play         applies the move, runs to the next decision
 * @property {(world) => boolean} over
 * @property {(world, rng) => World} rollout       the fast rule to the end
 * @property {(world, actor) => number} score      the reward of a finished world, 0 to 1
 */

/** @returns {{ move: Move, visits: Map<string, number>, value: number }} */
export function search(state, problem, { budget, rng, depth = 5, explore = 0.7 }) {}
```

Les autres modules, plus simples :

```js
export function createEvents() {}                   // { schedule(at, event), next(), now }
export function astar(grid, from, to, options) {}   // options: { cost(cell, unit), reserved }
export function createReservations() {}             // { reserve(path, start), isFree(cell, t) }
export function wilson(wins, games) {}              // { low, high }
export function paired(scoresA, scoresB) {}         // { mean, low, high }
```

Un **adversaire** se décrit avec le même problème : `actor` le nomme, et `score` lui donne la récompense
de son côté. La bibliothèque sert donc aussi à la famille C, le jour où elle viendra.

## 5. Les adversaires cachés : moins pressés, et pourquoi

Sami trouve ce thème moins parlant, moins vendable hors des jeux vidéo et du wargame. **C'est juste pour
la vitrine** :
- en dehors des jeux, de la défense et de la sécurité, peu d'entreprises ont un adversaire qui cache ses
  cartes ;
- une démonstration de coopération (un humain et des robots) se comprend en dix secondes ; un bot qui bat
  un autre bot demande d'expliquer le jeu d'abord.

**Mais la compétence ne se perd pas** : deviner ce que l'autre cache est exactement ce que demande la
coopération avec un humain (§ 3). Lopin est l'argument pour la cuisine et les secours : « mes robots
devinent les intentions du joueur comme mon bot devine la main adverse ».

**CodinGame** reste une bonne idée si un défi en temps réel plaît : un classement public donne un
résultat comparable aux autres, et la plateforme sert aussi au recrutement. Ce n'est pas une étape de la
feuille de route, plutôt un terrain d'entraînement pour la bibliothèque.
