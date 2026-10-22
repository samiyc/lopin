# Prompt pour Fable : que tester pour battre la 1.2 à 2 000 simulations, ou prouver que c'est fini

> À coller tel quel dans une session Claude Code (modèle Fable), ouverte dans le dépôt `lopin`. Préparé le 16/10
> (`docs/agents/revue-2026-10-16.md`). Tu réponds en français ; le code et ses commentaires restent en anglais.

## Ta mission

La 1.2 (`ismcts+widen=7+depth=5+core=stfig6+exact=12@2000`, un ISMCTS sur le cœur `stfig6`, avec le solveur exact à
la racine) a résisté à toutes les variantes **à budget égal** ; seul le budget a payé. Dis s'il reste **au plus 5 idées**
qui méritent une validation (1k@2k), classées, ou argumente qu'on est au plafond de cette architecture à 2 000
itérations et dis ce qui ferait changer d'avis. Pas de duel long toi-même : analyse, code minimal derrière une option
éteinte, tri de jour à 400, jobs de nuit prêts.

## Ce qui est établi (ne le remesure pas)

Les chiffres sont des scores contre la 1.2, au même budget sauf mention ; les fourchettes sont à 95 %. Détails dans
`docs/strategie.md`, « Tentatives écartées » et « Feuille de route 1.3 », et dans `docs/glossaire.md` pour les noms.

| Famille | Essais | Résultat |
| --- | --- | --- |
| Diversité à la racine | `diverse`, Borné 1.0 | 45,9 – 47,0 % |
| Élargissement progressif | `pw=1/2/3` | 51,1 / 47,8 / 51,2 % (1 180 parties, 48,9 – 53,5) : neutre |
| Exploration | PUCT (`puct=1`, `puct=2`) | 49,8 %, 47,2 % |
| Plusieurs arbres | Ensemble (`trees=2`) | 51,0 % sur 1 500 ; 3 et 4 arbres 42,0 et 46,2 % |
| Simulations | SimCertain, solveur dans les simulations | 40,7 %, 41,0 % |
| Retours d'arbre | `margin`, Implicit2/4, ForkCut1/2 | 45 – 51 %, tous écartés à 2 000 |
| Choix final | FinalLcb1 (`final=1`), FinalMean | 51,5 % (49,4 – 53,7) sur 1 500, 51,9 % sur 1 000 : pas de 1.3 |
| Modèle adverse | `infer=48`, `+memory=3` | 49,5 %, 46,3 % |
| Solveur plus tôt | `exact=14` | identique à `exact=12` : la pioche cachée doit être vide, il reste alors 12 cartes au plus |
| Budget | ×2 (4 000) ; 20 000 ; Oracle3 (20 000, profondeur 10, `pwl=4`) ; Oracle light (10 000, `pwl=3`) | 52,8 % ; 55,7 % ; 57,1 % ; 56,0 % |

- **Les relectures par l'oracle** (`docs/strategie.md`, Oracle1 et Oracle3) : rien d'utile hors des 8 candidats de la
  racine. Le seul écart restant est le choix **parmi** eux (rangs 4 à 8 : +2,5 ± 2,4 points). Le bruit du coup joué :
  à 2 000, les visites du 1er et du 2e candidat sont souvent proches.
- **La politique de simulation** garde le coup gagnant dans 93,8 % des fins de partie décisives (`npm run policy`) ; ce
  banc ne voit pas le long terme.
- **Les idées jamais essayées que le panel du 16/10 a retenues** :
  - **MO-ISMCTS** : les nœuds adverses regroupés par ce que l'adversaire voit. C'est la fusion de stratégies dans l'arbre
    adverse, que ni le budget ni Ensemble ne touchent. Déjà listé « jamais essayé » dans `strategie.md`.
  - **Finalistes appariés** : les 2 ou 3 meilleurs coups de la racine rejoués sur les mêmes donnes et les mêmes graines
    (variables aléatoires communes), décision sur la différence appariée. RootHalving et FinalLcb1 n'appariaient pas.

## Ce qu'on attend de toi, dans l'ordre

1. **Lis** `src/sim/mcts/ismcts.js`, `src/sim/mcts/choice.js`, `src/sim/mcts/final-choice.js`, `src/sim/mcts/widening.js`, puis les sections
   citées de `docs/strategie.md`. Établis **pourquoi** les familles ci-dessus échouent : bruit, coût par itération, ou
   fusion de stratégies. C'est ce qui rend une idée nouvelle crédible.
2. **Au plus 5 idées**, nouvelles ou déjà proposées (MO-ISMCTS, finalistes appariés). Pour chacune :
   - le mécanisme ;
   - pourquoi elle diffère de l'échec le plus proche, avec la ligne de `strategie.md` ;
   - l'effet attendu en points, et pourquoi ;
   - le coût par itération (au-delà de 3 % : duel à temps égal `@tMS`) ;
   - le plan de code (un module à part : `ismcts.js` est au bord des limites du lint) ;
   - le nom de la version (en CamelCase, dans le glossaire) ;
   - les commandes exactes.
3. **Implémente la première** derrière une option éteinte par défaut, avec un test, et vérifie que l'empreinte ne bouge
   pas (`npm run fingerprint -- "ismcts+widen=7+depth=5+core=stfig6+exact=12@150,greedy" 20` → `1d041613cd7bcd8d`).
   Fais son tri de jour à 400 (`npm run duel -- <A> <1.2 au même budget> --screen --page`), puis mets en file sa
   1k@2k pour la nuit.
4. **Ou le verdict de plafond** : si aucune idée ne mérite sa 1k@2k, dis-le, avec ce qui ferait changer d'avis.

## Les contraintes du dépôt (dans `CLAUDE.md`)

- **Le protocole de version** : une version se décide sur 4 jeux de duels longs (`--long --games 125 --page --offset 0`
  à `3`, 1 000 parties), réunis par `npm run versus`, avec une borne basse au-dessus de 50 %.
- **Le tri à 400 rejette, il ne promeut jamais.** Ce qui touche à la lecture des visites (le choix final) se juge à
  2 000, jamais sur un tri à 400-800.
- **Le budget de jour** : 400 itérations par arbre au plus. Les jobs de nuit durent moins de 2 h, avec 18 fils au plus,
  dans `data/backlog.json`.
- **Le vocabulaire et le code** : nomme avant d'utiliser (`docs/glossaire.md`) ; tout nouveau script npm va dans
  `docs/commandes.md`. `npm run check` passe avant tout commit (complexité 8, fonction de 40 lignes, fichier de 220
  lignes). Les tentatives écartées vont au tableau de `strategie.md`.

## Les pièges

- **La fusion de stratégies** : une idée qui « voit » la donne tirée (comme l'Omniscient) ne juge pas un coup à cartes
  cachées.
- **Le bruit** : ± 2,7 points sur une 1k@2k. Un tri à 57-60 % est souvent retombé à 49 % sur des donnes neuves.
- **Ne repropose pas une variante du tableau** sous un autre nom sans dire ce qui change le mécanisme.
- **Le budget** : un gain qui vient de plus de calcul n'est pas une idée. Compare à temps égal si le coût dépasse 3 %.

## Quand c'est fini

Un document `docs/priorites-1.3.md` (en français) avec :
- le diagnostic des échecs ;
- les idées classées ;
- la première implémentée et triée ;
- sa 1k@2k en file, ou le verdict de plafond argumenté.

`npm run check` passe, l'empreinte est inchangée, et tout est commité.
