
## Application rélles ISMCTS

J'aimerai aller plus loin avec l'algorithm ISMCTS. J'ai regarder rapidement sur internet et deux utilisations
dans le monde de l'entreprise mon particulièrement plus. Pour la planifinication taches et pour la gestion des trajectoires dans les entrepots.
Pour le premier cas j'ai une situation tout à fait approprié est testable sur le projet en cours, avec la gestion des jobs de nuit dans la backlog.

tu peut ajouter des fichiers .md avec tes suggestion/corrections/exemples dans /docs/Autre usecases ISMCTS/   (tu peut renommer si besoin)
dans un premier temps j'aimerai être sur de bien comprendre l'application de l'algo à ces nouvelles problématiques.
si c'est plutot aproprié pour le projet on pourrais par la suite mettre en place qqch pour la gestions de la backlog ?
un autre repo git pour la gestion de la backlog ?
pour ce qui est la gestion des itinéraire dans l'entreprot par contre on commence a sortir de cadre du projet, il faudrait surement créer un autre repos git ?

### Optimisation de la Backlog
je shematise avec les terme que l'on utilise actuellement dans le jeux des bornes.

la pioche : les jobs historique qui ont été lancé sur la backlog depuis le début du projet
la main : la todo, les jobs a lancer qui ne sont pas encore traité
les bornes : le nombre de files disponibles pour le traitement des jobs.
	au lieu d'avoir uniquement 1 file de backlog sur 18 threads, on pourrais simuler 6 files de 3 threads.
	il est tout a fait possible de réserver 3 files pour une taches et donc 9 thread.
	par exemple si l'on pose une tache sur la file trois mais que les files 1-2 sont vide elles sont considéré comme prise par le job dans la file 3
reward-fct : nombre de taches traité et fini en un temps T, par exemple 8h, pour une nuit

un fois les files rempli avec des jobs, on peut ajouter une action, qui consiste a faire passer le temps de 20-30mn (à définir)
à chaque fois que l'on ajoute un job sur une file on pioche une nouvelle tache dans la pioche. 6 carte en main.
il faudrait également simuler les imprévu de fin de job via les stopIf, saturation mémoire, erreur, etc. 
une deuxième pioche, pour les imprévu ? 25% de chance de poicher stopIf, 5% erreur...

utilisations: renderfarm, gestion de tickets pour une équipe ?


### Pour l'optimisation des trajectoires
pour cette activité je suis très familier avec les algorithm de pathfinding, A* et similaire.
de ce que je comprend on pourrais en chemin du robot entre A et B, on peut couper des liens du graph pour différente raisons.
des obstacles, des bouchons. J'ai du mal a visualiser quel sont les actions pour chaque noeud.
est ce que ça serait simplement les action de déplacement haut/bas/gauche/droite dans une grille ?
et la reward fonction serai itinéraire fini ou non, et en combien d'étapes.
la pioche serai les objectif de déplacement des robots, comme une commande pour un camion, déplacer des colis de A vers B.
puis les 4 robots sont soit chargé ou vide. et doivent faire les vas est viens entre le stock/entrepot et le camion.
du coup tout les tours de jeux, on donne une action pour chaqu'un des 4 robots, un déplacement ou une action prendre/déposer objet.
a la fin de partie on compte le nombre de colis ayant accompli l'objectif de déplacement A, vers B.

Exemple d'entrepot:
.................
.###.###.###.###.
.................
.###.###.###.###.
.................
.###.###.###.###.
.................

utilisations : Gestion d'entrepots, itinéraire en cas de catastrophe,


### Autres
D'autre idées d'application qui aurais une utilité dans le monde réelle ?
idéalement utilisation assez large, pas uniquement dans l'industrie.

