# CLAUDE.md — Comment travailler avec moi (Quentin)

## Qui je suis
Je suis **technicien de maintenance en éolien** (parc offshore Dieppe Le Tréport).
Je **ne suis pas développeur**. Je lis le français.

## Comment tu dois me parler (IMPORTANT)
- **Adapte toutes tes réponses pour que je les comprenne** : langage simple, phrases
  courtes, pas de jargon de dev sans l'expliquer avec une image concrète.
- Quand tu montres du code, **explique en une ligne ce que ça change pour moi**
  (pas juste le code brut). Préfère les captures d'écran / résultats visibles.
- Va au but : dis-moi **ce que tu as fait, ce que ça donne, et ce que je dois faire
  ensuite** (ex. « ouvre le site », « merge la PR »).
- **Court.** Vise une dizaine de lignes. Pas de tableau récapitulatif quand trois
  phrases suffisent, pas de rappel de ce que je viens de te demander, pas de
  liste des détails techniques que tu as traversés en chemin. Si un détail
  compte vraiment pour ma décision, garde-le ; sinon, coupe-le. Une réponse
  longue se justifie seulement si je demande une explication ou un bilan.
- **Conseille et guide-moi.** Je veux ton avis d'expert, des recommandations
  proactives et les compromis, pas seulement l'exécution de ce que je demande.
- Sois honnête : si quelque chose n'est pas fait, pas testable ici, ou risqué,
  dis-le clairement. Ne prétends jamais qu'un travail est fait s'il ne l'est pas.

## Pose-moi des questions (TRÈS IMPORTANT)
Avant de te lancer dans une réalisation, **utilise l'outil AskUserQuestion pour me
poser des questions tant que tu n'as pas compris complètement mon besoin.**
Mieux vaut 2-3 questions ciblées au départ qu'un outil qui rate la cible.

## Ma finalité (le « pourquoi »)
Je veux **créer des outils** pour, au quotidien :
1. **Améliorer le suivi du chantier** (où en sont les fondations, les tâches, les câbles).
2. **Éclairer la prise de décision** (voir vite l'info utile, les priorités, les risques).
3. **Réduire les frictions** (moins de saisie manuelle, moins d'allers-retours).
4. **Automatiser ou simplifier** tout ce qui peut l'être.
Juge chaque idée à cette aune : est-ce que ça fait gagner du temps ou de la clarté sur le terrain ?

## Le projet actuel : « BopOp »
*(L'appli s'appelle BopOp depuis la PR #35. Le **projet**, lui, s'appelle toujours
« Op BOP tre FOU » : son nom sert d'adresse dans Firebase, le renommer laisserait
les données de l'équipe à l'ancienne adresse.)*
- Appli web mobile-first (un seul fichier `index.html` + `styles.css` + `app.js`,
  pas de serveur), déployée sur GitHub Pages, données stockées dans le navigateur
  (`localStorage`), synchro temps réel via Firebase.
- Suit les travaux BOP sur les 62 fondations du parc (grille A–M / lignes 1–7,
  câbles = 8 « strings », OSS au centre).
- Charte visuelle LEMS : bleu marine, crème, accents.
- Rôles : visiteur (lecture seule), technicien, admin (Antonin, Yohan, Etienne,
  Quentin — mode admin). Mot de passe **`bop`** pour tout le monde, visiteur compris.
- Branche de travail Git : `claude/work-progress-tracker-l8bu9k`.
  Ne jamais **pousser** directement sur `master`.
- **Publication : tu fusionnes toi-même.** Quand un travail est fini et que tes
  tests passent, ouvre la PR **et fusionne-la** sans me le demander — le site ne
  se met à jour que sur un push vers `master`, donc une PR laissée ouverte veut
  dire que je ne vois rien changer et que je te le signale à tort comme un bug.
  Dis-moi ensuite ce qui est en ligne et ce que je dois faire pour le voir.

## Design (qualité visuelle)
Vise un design soigné, pas « générique IA ». À éviter :
- Polices passe-partout (Inter, Arial, polices système par défaut).
- Dégradés violet→bleu, texte gris sur fond coloré, noir/gris purs (toujours teinter).
- Cartes empilées dans des cartes, animations « rebond »/élastiques (fait daté).
Privilégier : hiérarchie claire, contraste lisible en plein soleil (usage terrain),
grosses zones tactiles (gants), et mouvement discret et utile.

---

# Mémoire du projet — les faits

*Le haut de ce fichier dit **comment travailler avec Quentin**. Cette partie-ci décrit
**le produit et le dépôt** : ce qu'il faut savoir avant de toucher au code. À tenir à
jour à chaque changement structurant.*

## Ce que fait l'app, et pour qui

BopOp suit l'avancement des travaux BOP sur les **62 fondations** du parc éolien
offshore de Dieppe Le Tréport. Chaque fondation est un cadran : on y coche les tâches
faites, on y laisse un commentaire, on y remonte une punch.

Elle est utilisée **sur le terrain** — sur un bateau qui bouge, souvent **avec des
gants**, parfois en plein soleil, parfois sans réseau. D'où : grosses zones tactiles,
fort contraste, et tout continue de fonctionner hors connexion pour se resynchroniser
au retour du signal. Ce n'est pas un outil de bureau.

## Le vocabulaire

| Ce que dit Quentin | Ce que dit le code | Ce que c'est |
|---|---|---|
| le parc | `project.nodes` | les 62 fondations + l'OSS |
| une fondation | un `node`, `node.label` = `"M07"` | un point sur la carte |
| l'OSS | `node.substation === true` | la sous-station, au centre |
| le camembert / le cadran | le groupe SVG `.node-group` | le dessin d'une fondation |
| une part (au centre) | `categories` → bucket `node.status`, SVG `.node-wedge` | max **8**, les 8 parts centrales |
| la 1ʳᵉ couronne | `microVars` → bucket `node.micro`, SVG `.node-ring-cell` | max **16** |
| la 2ᵉ couronne | `outerVars` → bucket `node.outer`, SVG `.node-ring-cell` | max **32** |
| une tâche | un item d'une de ces 3 listes | 56 au total |
| la couleur de fond / les pois | `item.color`, `item.color2` | la 2e couleur s'affiche en pois sur la première |
| l'emoji / les lettres au centre | `item.badge` | 2 signes maxi, découpés par la part, dessinés seulement si la tâche est faite |
| le temps d'une tâche | `procedures[id].minutes` + `.people` | minutes sur place, et 1 ou 2 personnes |
| les heures de travail | minutes × personnes | c'est ce que comptent tous les % de temps |
| pas fait / en cours / partiellement fait / fait | `stampState()` → `'none'` / `'wip'` / `'partial'` / `'done'` | valeur : `null`, `{at,by,wip:true}`, `{at,by,partial:true}`, `{at,by}` |
| cocher / décocher | `checkStamp()` / `null`, daté par `touchStatus()` | la **date du changement** vit dans `node.statusAt` |
| un mode opératoire / mode op | `project.procedures[taskId]` | par tâche, FR + EN séparés |
| qui a lu quoi | `procSeen[qui][id]` = toute la fiche, `procSeenParts[qui][id][partie]` = une partie | deux cartes : la seconde est invisible pour un appareil pas encore à jour |
| une punch | `project.punchList[]` | toujours rattachée à une fondation |
| une inspection (répétable) | `project.reportTypes[]` → `node.reports[]` | comptée en occurrences datées |
| un string | `project.strings[]`, `project.connections[]` | les 8 câbles inter-array |
| SRCC | `strings[i].srcc` | accès restreint : le câble passe en rouge |
| un permis (PtW) | `project.permits[]` | BOP / SAP / CTV + numéro |
| le TBT | `project.tbts[]`, un par jour (`tbt-AAAA-MM-JJ`) | causerie sécurité du jour |
| le récap 12h | `project.recaps[]` | ce qui a été copié vers WhatsApp |
| l'équipe | `project.team[]` | les noms de l'écran d'accueil |
| effacer le parc | `project.clearedAt` | une **date**, pas une absence |
| la salle d'attente | `project.overflow` | les tâches qu'une couronne pleine n'a pas pu asseoir ; elles entrent toutes seules dès qu'une place se libère |

## Où vivent les données

**Sur l'appareil**, dans le `localStorage` du navigateur. Rien n'est stocké sur un
serveur qui nous appartienne.

| Clé | Contenu |
|---|---|
| `worksite-tracker:v7` | **tout le relevé** : projets, fondations, coches, commentaires, punch, permis, TBT, récaps |
| `worksite-tracker:user` | qui est connecté sur cet appareil, et s'il est en mode admin |
| `worksite-tracker:auth` | le jeton Firebase (permet d'écrire dans la base d'équipe) |
| `worksite-tracker:theme` | clair / sombre / auto |
| `worksite-tracker:dayplan` | les tâches cochées pour la journée |
| `worksite-tracker:procSeen` | quels modes op cette personne a déjà lus |
| `worksite-tracker:syncUrl` | surcharge manuelle de l'adresse Firebase (dépannage) |
| `worksite-tracker:snap:AAAA-MM-JJ` | photo quotidienne du relevé, filet de secours local |

**En partagé**, dans Firebase Realtime Database :
`https://op-bop-tre-fou-default-rtdb.europe-west1.firebasedatabase.app`
→ `/projects/<nom-du-projet-en-slug>.json`. Lecture ouverte, écriture réservée aux
appareils connectés au compte d'équipe `crew@op-bop-tre-fou.app`.

**Format** : du JSON, un objet `project` (voir `createEmptyProject()`).
Les fusions entre appareils se font **par date** : le plus récent gagne. Les
suppressions laissent une trace datée (`tombstones`, `clearedAt`, `statusAt`,
`commentAt`, `reportGone`) — sans ça, une union entre deux appareils ne sait pas
distinguer « effacé » de « pas encore vu », et ce qui a été supprimé revient.

## Les commandes

```bash
npm install          # une fois — installe Playwright pour les tests
npm run dev          # sert le site en local, affiche l'adresse
npm test             # lance toute la suite (démarre son propre serveur)
```

**Déploiement** : il n'y a rien à construire. Un push sur `master` déclenche
`.github/workflows/deploy.yml`, qui publie le dépôt tel quel sur GitHub Pages.
Une PR laissée ouverte ne met **rien** en ligne.

**Tests** : `.github/workflows/ci.yml` rejoue la suite sur chaque PR. Une PR dont
les tests échouent ne doit pas être fusionnée.

## Décisions prises et décisions annulées

Une ligne par décision. « Annulée » veut dire : essayé, puis retiré — ne pas
represcrire sans nouvelle raison.

| Date | Décision | Pourquoi |
|---|---|---|
| 2026-07-25 | Langage visuel « carte marine » (bleu marine, crème, accents) | Lisible en plein soleil, et ne ressemble pas à un tableur |
| 2026-07-26 | Le mot de passe passe par un compte Firebase | Seuls les appareils connectés peuvent écrire dans la base d'équipe |
| 2026-08-01 | Identifiants de tâche déduits du nom + pierres tombales 30 jours | Deux appareils configurés séparément doivent parler de la même tâche ; sinon un renommage créait un doublon partout |
| 2026-08-01 | Le tracé des câbles voyage **en bloc** (`cablesAt`), dernier qui dessine gagne | Un tracé est un dessin, pas un sac de faits indépendants |
| 2026-08-02 | **Annulé** : l'éditeur de carte (ajouter/supprimer une fondation, un câble, un coude) | Tréport est construit. Le parc n'est plus modifiable, seulement lu |
| 2026-08-02 | **Annulé** : le panneau PROGRESS de droite | Les mêmes chiffres à deux endroits n'aidaient personne ; ils vivent sur les lignes de tâches |
| 2026-08-02 | **Annulé** : le bouton « modes opératoires » du bandeau du haut | Une icône isolée que personne ne trouve est pire que pas d'icône ; on y accède par la tâche |
| 2026-08-04 | Effacer le parc = poser une **date** (`clearedAt`), pas supprimer | La fusion est une union : sans date, l'autre téléphone remettait tout 2 secondes après |
| 2026-08-05 | Le tableau papier du 19/07/26 devient la liste des tâches (`data/tableau-19-07-26.json`) | L'app portait des noms de tâches qui ne correspondaient à rien du mur |
| 2026-08-05 | Chaque coche porte la date de son **changement** (`node.statusAt`) | « Pas fait » n'a pas de tampon : sans ça, décocher ne se synchronisait pas |
| 2026-08-10 | L'appli s'appelle **BopOp** ; le **projet** garde son nom | Le nom du projet est l'adresse Firebase des données |
| 2026-08-10 | **Annulé** : ajouter une punch « à la volée », sans fondation | Une punch doit toujours dire de quelle fondation elle parle |
| 2026-08-10 | Écran d'accueil **anonyme**, mot de passe `bop` pour tous, visiteur compris | Un site qui montre tout le chantier à qui trouve le lien n'est pas « lecture seule », il est public |
| 2026-08-10 | **Annulé** : la règle « ne jamais traduire `bop` → `BOPBOP` dans le code » | Le raisonnement était faux : le mot de passe était **déjà** en clair dans `app.js`. C'est une sonnette, pas une serrure |
| 2026-08-10 | **Annulé** : « l'app décide dans quelle couronne va une tâche » | L'admin choisit : 3 niveaux explicites, 8 + 16 + 32, réordonnables |
| 2026-08-10 | L'ordre des tâches **est** l'ordre des parts, et il voyage (`tasksOrderedAt`) | Déplacer une ligne déplace la part sur la carte |
| 2026-08-10 | Le TBT est classé par **date** (un par jour), l'archivage est automatique | Personne n'a à penser à archiver |
| 2026-08-16 | Les 3 bandes se touchent : **un seul** trait noir entre elles | Elles étaient à 3 px, ce qui dessinait un double trait avec du blanc coincé |
| 2026-08-16 | **Le quadrillage noir entoure TOUTES les parts, y compris celles où rien n'est fait.** Retiré en PR #40, rétabli en PR #41 : sans lui, le cadran ne se lit plus comme un cadran. **Ne pas reproposer.** | — |
| 2026-08-16 | Suite de tests dans le dépôt + CI sur chaque PR | Rien ne gardait le code ; les suites vivaient hors dépôt et ont été perdues |
| 2026-08-19 | Une tâche peut porter une **2e couleur en pois** et **une ou deux emoji / lettres** au centre de sa part (`color2`, `badge`) | 56 tâches sur 3 niveaux finissent par se ressembler ; la couleur seule ne suffit plus à reconnaître une part d'un coup d'œil |
| 2026-08-19 | Le dessin (pois + emoji) n'apparaît **que sur une part remplie**, et il est découpé par la forme de la part | Une fondation vierge doit rester lue comme un cadran vide (voir la ligne du 16/08 sur le quadrillage) ; et rien ne doit déborder sur la part voisine |
| 2026-08-21 | La liste de consommables voyage **en bloc** (`sectionUpdated.consumables`), dernier qui édite gagne | L'union par nom ne sait pas dire « retire ça » : un consommable supprimé revenait, un consommable renommé se dupliquait |
| 2026-08-21 | Une couronne pleine se voit **sur l'option** du menu (`16/16 — full`) et ne peut plus être choisie | Le refus existait déjà mais s'affichait 2,6 s en bas de l'écran ; personne ne le lisait, donc « déplacer une tâche ne marche pas » |
| 2026-08-21 | Les cadrans sont dessinés **×1,25** (`NODE_SCALE`), l'espacement du parc est inchangé | Une part était trop petite à lire au soleil et à toucher avec des gants |
| 2026-08-21 | La sous-station **ne suit pas** cette échelle | Elle est à 117 unités de L04 quand deux fondations ne sont jamais à moins de 192 : grossie, elle passait par-dessus le travail de L04 |
| 2026-08-21 | Le temps se saisit **par tâche, sur le mode opératoire** (minutes + 1 ou 2 personnes) et tout se compte en **minutes-homme** | « Combien d'heures de travail il y a sur chaque fondation » ; une coche de 2 min et une de 2 h ne pèsent pas pareil |
| 2026-08-21 | Une tâche **partielle compte pour la moitié** ; une tâche **non chiffrée est retirée des deux côtés** du calcul, et le nombre est affiché | Personne ne saisit un vrai pourcentage avec des gants ; et compter zéro une tâche non chiffrée laisserait croire la fondation plus avancée qu'elle n'est |
| 2026-08-22 | Les **inspections** portent un mode opératoire, via la même liste que les tâches (`allProcedureItems`) | Un deuxième système de pastilles aurait dérivé du premier |
| 2026-08-22 | Une inspection n'a **pas** de « Temps & équipe » | Le % de travail vient des coches des 62 fondations ; une inspection se compte en occurrences, le champ aurait été saisi et jamais compté |
| 2026-08-22 | Une inspection est cochable dans la **préparation du jour** | Ses consommables sont titrés « préparation », une liste qui n'y arrive jamais est un mensonge |
| 2026-08-22 | La pastille marque **la partie modifiée**, et s'éteint quand cette personne l'a eue devant les yeux (½ visible, 0,75 s) | « 24 h après l'édition » n'est pas « tu ne l'as pas lu » : la marque s'éteignait toute seule pour qui n'avait jamais ouvert la fiche |
| 2026-08-22 | Le lu-par-partie est une **2e carte** (`procSeenParts`), pas une nouvelle forme de `procSeen` | Les téléphones ne se mettent pas à jour le même jour ; un ancien appareil lirait un objet là où il attend une date |
| 2026-08-29 | Les règles d'accès SRCC portent une **date** (`accessRulesAt`) ; les textes des modes op utilisent celles de `sectionUpdated` | La fusion gardait le texte **le plus long** : raccourcir un texte ne tenait jamais, l'autre appareil reposait l'ancien |
| 2026-08-29 | Le mode opératoire d'une **inspection** est **une seule case** de 20 lignes | Quatre cadres « À compléter… » sur une consigne d'une phrase se lisent comme une appli inachevée |
| 2026-08-29 | **Annulé** : l'inspection cochable dans la préparation du jour (ajoutée en PR #52) | Sans champ outils ni consommables, elle n'a plus rien à apporter au kit ; une case qui n'ajoute rien est pire que pas de case |
| 2026-08-29 | 4ᵉ état **« en cours »** (`wip`), icône = une **personne**, couleur = l'accent | Deux techniciens partaient sur la même tâche ; la question est « qui est dessus », pas « depuis quand » |
| 2026-08-29 | « En cours » compte **zéro** dans le % de temps et reste dans « il en reste » | Ça dit que quelqu'un est dessus maintenant, pas qu'une part est derrière nous |
| 2026-08-29 | Sur le cadran, « en cours » = des **pois**, pas un 2ᵉ hachurage | Deux hachures d'angles différents se ressemblent au soleil, et cet état doit se distinguer de « à moitié fait » |
| 2026-09-11 | Une tâche refusée par une couronne pleine **attend** dans `project.overflow` au lieu de disparaître | L'appareil qui la refusait la renvoyait ensuite, absente, à la base d'équipe : la tâche était effacée pour tout le monde, sans retour possible |
| 2026-09-11 | Une coche, un commentaire, une inspection dont la tâche est inconnue ici est **gardée de côté** sous son id d'origine et s'allume quand la tâche arrive | Elle était jetée en silence, à chaque synchro : c'est comme ça qu'une saison de travail revenait en carte vide |
| 2026-09-11 | Une **pierre tombale** reste plus forte que la salle d'attente | Une suppression est une décision ; garder le travail de côté ne doit pas la défaire |
| 2026-09-11 | La synchro **dit** ce qu'elle n'a pas pu prendre (journal + message), une fois par changement et non à chaque tour | Le refus n'était annoncé qu'à l'import manuel ; le seul endroit où du travail disparaissait était le seul où personne n'était prévenu |
| 2026-09-11 | `refreshAfterRemoteChange` redessine aussi le **panneau de gauche** (tâches, inspections, permis, strings), sauf pendant une saisie | Une tâche renommée par un collègue arrivait sur la carte et pas dans la liste à côté : les deux se contredisaient jusqu'au rechargement |

## Règles de travail

- **Une PR par changement.** Un sujet, une PR, un message qui dit *pourquoi*.
- **Les tests sont obligatoires.** Tout changement de comportement arrive avec son
  test. La CI doit être verte avant de fusionner — une PR rouge ne se fusionne pas.
- **Aucun changement visuel non demandé.** Rendu, couleurs, géométrie, comportement :
  on n'y touche que si Quentin l'a demandé. Un travail de robustesse doit laisser
  `app.js`, `styles.css`, `index.html` et `assets/` intacts, ou expliquer chaque ligne.
- **Jamais de push direct sur `master`.** On travaille sur la branche indiquée plus
  haut, on ouvre la PR, on la fusionne.
- **Avant de reproposer une idée, lire « Décisions annulées ».**
