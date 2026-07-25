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

## Le projet actuel : « Op BOP tre FOU »
- Appli web mobile-first (un seul fichier `index.html` + `styles.css` + `app.js`,
  pas de serveur), déployée sur GitHub Pages, données stockées dans le navigateur
  (`localStorage`), synchro temps réel via Firebase.
- Suit les travaux BOP sur les 62 fondations du parc (grille A–M / lignes 1–7,
  câbles = 8 « strings », OSS au centre).
- Charte visuelle LEMS : bleu marine, crème, accents.
- Rôles : visiteur (lecture seule), technicien (mot de passe « BOP »),
  admin (Antonin, Yohan, Etienne, Quentin — mode admin).
- Branche de travail Git : `claude/work-progress-tracker-l8bu9k`.
  Ne jamais pousser directement sur `master` sans mon accord.

## Design (qualité visuelle)
Vise un design soigné, pas « générique IA ». À éviter :
- Polices passe-partout (Inter, Arial, polices système par défaut).
- Dégradés violet→bleu, texte gris sur fond coloré, noir/gris purs (toujours teinter).
- Cartes empilées dans des cartes, animations « rebond »/élastiques (fait daté).
Privilégier : hiérarchie claire, contraste lisible en plein soleil (usage terrain),
grosses zones tactiles (gants), et mouvement discret et utile.
