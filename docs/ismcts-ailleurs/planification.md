# Planifier sous incertitude : le calendrier, les urgences, la cuisine

Sami (22/10) : l'optimisation d'un calendrier lui semble parlante, même pour un recruteur ou une
présentation non technique. Deux autres idées : les commandes d'une cuisine à la *Overcooked*, et les lits
et médecins d'un service d'urgences. Ce document les range par famille, avec la backlog, l'entrepôt et la
bataille sous brouillard, et dit ce que chacune demande.

## 1. Les trois familles

| Famille | Ce qui est incertain | L'outil | Les projets |
|---|---|---|---|
| **A. Ordonnancer sous incertitude** | les durées, les arrivées, les annulations ; personne ne cache rien exprès | MCTS sur des scénarios ; POMCP si un état caché se révèle (la gravité d'un patient) | la backlog, **le calendrier**, **les urgences**, la renderfarm, les tickets |
| **B. Affecter, puis se déplacer** | les mêmes, plus les chemins (allées bloquées, routes coupées) | deux étages : MCTS pour « qui fait quoi », A* pour les trajets (`entrepot.md`) | l'entrepôt, **la cuisine** ; les secours sur le terrain, trop vastes pour un petit projet |
| **C. Un adversaire qui cache** | ce que l'autre a en main ou prépare | ISMCTS ; CFR si le bluff compte | Lopin, la bataille sous brouillard façon CodinGame, la patrouille |

La cuisine est à cheval sur A et B : les commandes arrivent comme des jobs, et les cuisiniers se
déplacent comme des robots. Les urgences sont une famille A avec un état caché : la gravité réelle, que le
bracelet de couleur ne fait qu'estimer.

Tout ce qui est en A et B est de l'**ordonnancement en ligne** (glossaire) : on ne planifie pas la journée
entière, on décide à chaque événement.

## 2. Le calendrier

C'est la backlog avec des personnes :

| Backlog | Calendrier |
|---|---|
| les jobs | les tâches et les réunions |
| les fils et la RAM | les personnes et les salles, avec leurs disponibilités |
| la fin de nuit | les échéances |
| les durées incertaines | les réunions qui débordent, les tâches sous-estimées |
| les stopIf | les annulations, les absences |
| les jobs ajoutés pendant la nuit | les urgences, les nouvelles demandes |

**L'exemple à raconter.** Lundi matin, la semaine est construite. Mardi à 14 h, une réunion déborde
d'une heure, et un client demande un rendez-vous avant jeudi. Que déplacer ? Le planificateur tire
1 000 suites possibles de la semaine (d'autres débordements, d'autres demandes), essaie chaque
réarrangement candidat sur ces mêmes suites, et propose celui qui tient le mieux les échéances.

**Deux outils, deux moments** :
- **construire la semaine** à l'avance est un problème de contraintes : un **solveur d'optimisation**
  (glossaire) le fait très bien ;
- **réparer la semaine** quand un imprévu tombe, en regardant ce qui peut encore arriver : c'est la place
  du MCTS.

**L'information cachée** apparaît avec plusieurs personnes : les préférences et les autres engagements de
chacun ne sont pas tous visibles. Négocier un créneau entre plusieurs agendas, c'est deviner ce que
l'autre acceptera, comme l'arbre de Lopin devine la main adverse.

**Pourquoi c'est un bon projet de vitrine** : tout le monde a un agenda, l'image tient en une phrase
(« il réorganise ma semaine quand une réunion déborde »), et l'interface se montre dans un navigateur.

## 3. Les urgences d'un hôpital

Sami (22/10) précise le cadre : **les urgences, pas les secours sur le terrain**. Les secours hors de
l'hôpital (routes, recherche des victimes) sont trop vastes pour un petit projet ; l'hôpital, lui, tient
dans un simulateur. Référence de Sami : une vidéo récente de Michelle Khare avec Doctor Mike sur les
urgences (https://www.youtube.com/watch?v=50yM5jpd1lk).

**Le cadre** :
- **les ressources limitées** : les lits et les box, les médecins, les infirmiers, les blocs opératoires,
  le matériel (scanner, respirateurs) ;
- **les arrivées** : à pied, ou en ambulance par les pompiers, qui annoncent un premier bilan avant
  d'arriver ;
- **le tri** : à l'entrée, chaque patient reçoit un bracelet de couleur selon sa gravité. Les couleurs et
  les délais varient d'un pays et d'un hôpital à l'autre. L'échelle de Manchester en est un exemple :
  rouge (immédiat), orange (10 min), jaune (60 min), vert (120 min), bleu (240 min) ;
- **les décisions** : quel patient voir maintenant, avec quel médecin, dans quel box ; qui passe au bloc et
  dans quel ordre ; faut-il appeler des renforts, ouvrir des lits, transférer un patient.

**Ce qui est caché.** La couleur est une estimation faite en quelques minutes : l'état réel du patient
peut être pire ou meilleur, et il change avec le temps. Les arrivées des prochaines heures sont inconnues,
sauf les ambulances annoncées. Une déterminisation tire **l'état réel de chaque patient**, compatible avec
sa couleur, et **les arrivées à venir**. C'est la famille du POMCP : un seul décideur face à un état caché
qui se révèle (un examen, une aggravation). La précaution de l'ISMCTS vaut ici : ne pas planifier comme si
l'on savait déjà quel patient jaune va s'aggraver.

**C'est l'ordonnanceur de la backlog avec des patients.** Les pièces de `backlog.md` § 9 se retrouvent
une à une :

| La backlog | Les urgences |
|---|---|
| un job | un patient et ses soins |
| les fils et la RAM | les box, les médecins, les blocs, le matériel |
| la priorité (`priority`) | la couleur du bracelet |
| l'échéance (`due`) | le délai maximal de sa couleur |
| les prérequis (`after`) | le parcours : tri, examen, imagerie, bloc, lit d'hospitalisation |
| la durée incertaine d'un duel | la durée des soins |
| les jobs qui arrivent | les ambulances annoncées et les arrivées à pied |
| un `stopIf` | un patient qui s'aggrave et change de couleur, ou qui part sans attendre |

La différence : ici, la priorité elle-même est incertaine, et elle peut changer pendant l'attente.

**La crise.** Le planificateur sert surtout quand l'afflux dépasse les ressources (un accident, une
épidémie) : en temps normal, les règles du tri suffisent. Le scénario de démonstration est donc une
crise : 40 arrivées en deux heures pour 10 box et 2 blocs, avec des ambulances annoncées.

**Ce qui se fait vraiment.** Les services d'urgences s'appuient sur des échelles de triage, des règles et
de la **simulation à événements discrets** pour dimensionner les équipes. La recherche y ajoute de
l'optimisation stochastique. Une recherche rapide (22/10) n'a trouvé aucun travail publié avec un MCTS
pour les lits des urgences ; la recherche de Daldoul et al. sur le personnel et les lits utilise une
simulation de Monte-Carlo, sans arbre.

**Les limites, posées dès le départ** :
- **le robot ne donne jamais d'avis médical** : la couleur et les soins restent décidés par les soignants.
  Il aide à organiser les files d'attente, les box, les blocs et les médecins, surtout en crise ;
- c'est une **aide à la décision** qui propose et explique (« ce patient orange attend depuis 8 min, le
  box 3 se libère dans 5 ») ; l'humain qui coordonne décide ;
- le simulateur s'écrit à partir de chiffres publics (arrivées par heure, part de chaque couleur, durées
  moyennes), jamais avec des données de patients.

## 4. La cuisine à la *Overcooked*

- **Les ressources** : 2 à 4 cuisiniers, les plans de travail, les fourneaux, les assiettes.
- **L'incertitude** : les commandes qui arrivent, et surtout **ce que va faire le coéquipier**. Si c'est un
  humain, ses intentions sont cachées : l'ISMCTS revient, avec un partenaire au lieu d'un adversaire.
- **Les deux étages** de l'entrepôt : le MCTS décide « qui prépare quel plat, qui coupe, qui sert »,
  A* déplace chaque cuisinier dans la cuisine sans heurter les autres.

**C'est déjà un banc de recherche.** Carroll et al. (NeurIPS 2019) ont construit un environnement inspiré
du jeu pour mesurer la coordination entre une IA et un humain. Un agent entraîné à jouer avec lui-même y
coordonne mal avec un humain ; un agent qui tient compte d'un modèle de l'humain fait mieux. C'est
exactement la leçon de `+theirs` : faire jouer l'autre par un modèle plus juste que soi-même.

**Le meilleur projet jouable de la liste** : un humain cuisine dans le navigateur avec un bot, et on voit
le bot changer de plan quand l'humain prend une tâche.

## 5. Solveur d'optimisation ou minimax ?

Sami demande si CP-SAT et HiGHS ressemblent au minimax des échecs. Le point commun est réel, la
différence aussi :

| | Minimax (échecs, le solveur de fin de partie de Lopin) | Solveur d'optimisation (CP-SAT, HiGHS) |
|---|---|---|
| **Qui décide** | deux joueurs, chacun à son tour | un seul décideur |
| **L'arbre** | les coups, puis les réponses | les choix de valeurs des variables (« la réunion R le mardi à 10 h ») |
| **Ce qu'on coupe** | l'alpha-bêta coupe une réponse qui ne peut pas changer le résultat | le *branch and bound* coupe une branche qui ne peut pas battre la meilleure solution trouvée ; la propagation retire les valeurs impossibles avant même de les essayer |
| **Le hasard** | aucun | aucun : tout le problème est décrit d'avance |
| **La réponse** | le meilleur coup, prouvé | la meilleure solution, prouvée, ou la meilleure trouvée dans le temps donné |

Les deux explorent un arbre et coupent ce qui ne peut pas être meilleur. Le solveur d'optimisation n'a
pas d'adversaire, et sa force vient de ce qu'il **déduit** des contraintes (une salle prise à 10 h retire
toutes les réunions de cette salle à 10 h) plutôt que de ce qu'il essaie. Il ressemble moins aux échecs
qu'à un solveur de Sudoku très perfectionné.

**La même combinaison que la 1.2** : des simulations tant que l'avenir est flou, le calcul exact quand il
devient abordable. Pour le calendrier : le solveur construit la semaine, le MCTS la répare au fil des
imprévus.

## Références

Vérifiées le 22/10.

- Carroll, Shah, Ho, Griffiths, Seshia, Abbeel et Dragan, « On the Utility of Learning about Humans for
  Human-AI Coordination », NeurIPS 2019 ; le code de l'environnement est public (`overcooked_ai`,
  HumanCompatibleAI).
- L'échelle de tri de Manchester : cinq couleurs, de rouge (immédiat) à bleu (240 min) ; certains pays
  en adaptent les délais.
- La vidéo citée par Sami (22/10) : Michelle Khare et Doctor Mike, sur les urgences,
  https://www.youtube.com/watch?v=50yM5jpd1lk (non vue par Claude).
- Daldoul et al. (LGI2A, université d'Artois) : planification des médecins, infirmiers et lits d'un
  service d'urgences, par un programme stochastique résolu avec une simulation de Monte-Carlo.
