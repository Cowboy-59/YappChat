# Module 1 — Scripts des leçons 1.1, 1.2, 1.3 (français)

**Formation :** wxKanban Spec-First · **Module 1 :** Pourquoi la spécification d'abord bat « demande à l'IA »
**Couvre :** les 28 premières minutes de la formation — l'accroche, la colonne vertébrale, et la première victoire.
**Ton :** chaleureux, technique, patient. Un expert patient qui simplifie les passages difficiles avec des étapes précises et des analogies.

> **Note de production — ceci est une adaptation, pas une traduction.**
>
> Le français fait l'objet d'un tournage distinct : il n'est donc **pas** contraint par le minutage de la version anglaise. Les analogies, les prénoms et les exemples ont été choisis pour fonctionner en français, pas pour coller mot à mot à l'anglais. Si une formulation sonne mieux autrement au moment de l'enregistrement, changez-la : c'est prévu.
>
> **Vouvoiement.** Ces scripts emploient le **vous**. C'est la norme pour une formation professionnelle en France et cela reste chaleureux si le ton l'est. C'est un choix de style qui engage les 72 leçons — si vous préférez le tutoiement, dites-le maintenant plutôt qu'après dix scripts.
>
> **Les balises restent en anglais.** `[SHOW ×L:]`, `[SHOW:]` et `[PAUSE]` sont conservées telles quelles pour que le comptage et les outils fonctionnent dans toutes les langues. Seules les descriptions sont en français.
>
> **Les transitions ne nomment jamais la leçon suivante.** Même règle qu'en anglais : ces enregistrements servent le Parcours Essentiel et la formation complète, qui ne les ordonnent pas pareil.

---

## Glossaire de référence

À figer avant l'enregistrement, et à réutiliser dans les 72 leçons.

| Anglais | Français retenu | Remarque |
|---|---|---|
| scope | périmètre | « Scope of Project » → « périmètre du projet » |
| spec / specification | spécification | |
| task | tâche | |
| phase gate | point de contrôle | « verrou » est plus dur, « jalon » plus flou |
| drift | dérive | « dérive silencieuse » pour *silent drift* |
| board | tableau | |
| kit | kit | terme du produit, conservé |
| commit / branch | commit / branche | usage courant des développeurs français |
| database | base de données | |
| file / folder | fichier / dossier | |
| screen / field | écran / champ | *champ* est le terme WINDEV, il parlera au public |
| data model | modèle de données | pour un windevien : **l'analyse** |

---
---

# Leçon 1.1 — Ce qui déraille quand on laisse l'IA écrire le code en premier

**Type :** Concept · **Durée visée :** 10 minutes

**Objectif pédagogique :** Décrire les trois modes de défaillance du développement assisté par IA sans spécification : la perte de contexte, la dérive silencieuse, et le travail que personne ne peut vérifier.

---

## ACCROCHE

[SHOW ×L: carte-titre — « Leçon 1.1 · Ce qui déraille quand on laisse l'IA écrire le code en premier »]

Vous connaissez cette sensation.

Vous avez passé plusieurs week-ends et quelques dizaines de soirées à construire quelque chose avec un assistant IA, et très honnêtement, ça se passe bien. Les écrans apparaissent. Les données s'enregistrent. Vous avez corrigé des choses. Vous commencez à vous dire que ça va marcher.

Et puis vous demandez une modification de plus. Un détail. Déplacer un bouton, ajouter un champ, changer le calcul d'un total.

Et autre chose casse. Quelque chose que vous aviez réparé mardi. Et quand vous le signalez, l'assistant s'excuse très poliment, corrige, et casse une troisième chose.

[PAUSE]

Voilà ce que je voudrais que vous compreniez avant d'aller plus loin, parce que ça change tout dans votre façon de travailler à partir de maintenant.

Ce n'est pas une mauvaise IA. Ce n'est pas vous qui savez mal formuler vos demandes. C'est un échec parfaitement prévisible, et il se produit pour trois raisons précises. Une fois que vous saurez les nommer toutes les trois, vous ne serez plus jamais désarçonné — et vous comprendrez exactement pourquoi tout le reste de cette formation est construit comme il l'est.

## OBJECTIF

Dans cette leçon, nous allons voir les trois façons dont le développement assisté par IA échoue en l'absence de spécification écrite, pour que vous puissiez reconnaître laquelle vous frappe, dès qu'elle commence.

## SÉQUENCE 1 — Premier mode de défaillance : l'IA n'a aucun souvenir de vos décisions

Le premier mode de défaillance, c'est la perte de contexte.

Voici ce qui piège presque tout le monde. Quand vous avez une longue conversation avec un assistant IA, on a l'impression qu'il apprend votre projet. Ce n'est pas le cas. Il relit la conversation — et une conversation est un très mauvais endroit pour stocker des décisions, parce qu'elles finissent enfouies sous tout le reste de ce que vous avez dit.

Prenons une image. Imaginez que vous engagiez un artisan vraiment excellent pour rénover votre maison. Du très haut niveau. Rapide, soigneux, un travail magnifique. Mais chaque matin, il arrive sans aucun souvenir de la veille.

[PAUSE]

Alors — vous pourriez gérer ça. Il faudrait simplement lui redire, chaque matin, tout ce qui compte. Les prises se posent à hauteur de genou. Le client déteste le chrome. On a décidé qu'on garde la cloison. Et si vous oubliez de mentionner la cloison un jeudi, la cloison tombe le jeudi. Pas parce que l'artisan est négligent, mais parce que ce jeudi matin, personne ne lui a parlé de la cloison.

C'est exactement votre situation. Et remarquez où se situe réellement la faute : ni dans le talent de l'artisan, ni dans le vôtre. Elle est dans le fait que la seule trace de cette décision, c'est une phrase dite à voix haute, une fois.

Ce qui nous amène directement au deuxième mode de défaillance, parce qu'une décision perdue ne disparaît pas : elle est remplacée.

## SÉQUENCE 2 — Deuxième mode de défaillance : la dérive silencieuse

Le deuxième mode de défaillance, c'est la dérive silencieuse.

Quand une décision disparaît, l'IA ne s'arrête pas et ne refuse pas de continuer. Elle prend une nouvelle décision. Une décision raisonnable. Et c'est précisément ce qui rend le phénomène si difficile à repérer : chaque réponse, prise isolément, semble correcte.

Le problème n'apparaît que lorsqu'on prend du recul et qu'on regarde l'ensemble d'un seul coup.

Voici l'analogie que je trouve la plus parlante. Imaginez que vous envoyiez le même cahier des charges d'un paragraphe à six artisans différents, que chacun construise une pièce de la même maison, et qu'aucun ne parle jamais aux autres. Chaque pièce, prise séparément, est parfaitement réalisée. Mais les interrupteurs ne sont pas à la même hauteur. Deux pièces n'ont pas les mêmes poignées. L'une est câblée pour des va-et-vient, l'autre non.

[PAUSE]

Personne n'a commis d'erreur. Chacun a comblé un trou du cahier des charges avec son propre bon sens. Et la somme de tous ces bons sens raisonnables donne une maison dans laquelle on se sent mal sans savoir pourquoi.

Ça, c'est la dérive. Et elle est silencieuse. Elle ne déclenche aucune erreur. Votre application tourne. Vos tests, si vous en avez, passent. Elle cesse simplement, lentement, d'être une chose cohérente.

Et voilà ce qui rend la dérive réellement dangereuse, et pas seulement agaçante — ce qui nous amène au troisième point.

## SÉQUENCE 3 — Troisième mode de défaillance : un travail que personne ne peut vérifier

Le troisième mode de défaillance est celui qui vous empêche de vendre quoi que ce soit, et le voici : vous êtes incapable de répondre à la question « est-ce que c'est fini ? »

Essayez tout de suite, sur quelque chose que vous avez construit. Comment *savez*-vous que c'est terminé ? Pas « ça a l'air de marcher ». Comment le savez-vous ? Par rapport à quoi ?

Si la réponse est « il faudrait que je reprenne tout et que je vérifie », alors vous n'avez pas un produit fini. Vous avez une chose qui n'a pas encore cassé devant vous.

Rendons ça concret.

[SHOW ×L: écran partagé — à gauche « Le brief de Thierry : un paragraphe dans une fenêtre de chat », à droite « Le brief de Thierry : un document de périmètre de deux pages »]

Imaginez Thierry. Vingt-deux ans de WINDEV, dont les neuf dernières années à maintenir le système de gestion de stock d'un négoce de matériaux — quatre agences, une quarantaine d'utilisateurs. Il connaît cette application comme vous connaissez votre cuisine dans le noir.

Il décide de la reconstruire en application web, avec l'aide de l'IA. Et ça démarre bien. Il décrit l'écran de stock en un paragraphe, et ce qui revient est franchement bon — plus beau que l'original, fonctionnel en un après-midi.

Six semaines plus tard, il a quelque chose qui se démontre très bien. Il le montre donc à Marie, qui tient le comptoir professionnel de l'agence la plus chargée, et qui le tient depuis onze ans.

Et Marie demande : « Qu'est-ce qui se passe quand un client rapporte un article qui était en prix spécial, et que le prix spécial est expiré ? »

[PAUSE]

Thierry ne sait pas. Pas parce qu'il a oublié — parce que cette règle n'a jamais été écrite nulle part. Elle vivait dans l'ancien code, à un endroit qu'il faudrait retrouver, et elle vivait dans la tête de Marie. Elle n'était pas dans le brief : le nouveau système fait donc quelque chose. Quelque chose de raisonnable. Personne n'a jamais vérifié quoi.

Et voilà la partie qui fait vraiment mal : il y a probablement deux cents règles de ce genre dans l'ancien système, réparties entre le code et l'analyse. Thierry n'en a aucune liste. Il n'a aucun moyen d'en produire une. Donc il ne peut pas dire à Marie que c'est fini, il ne peut pas dire à son responsable quand ça le sera, et il ne peut pas le mettre devant un client qui paie.

Six semaines de bon travail, et aucun moyen d'en prouver quoi que ce soit.

## SÉQUENCE 4 — Ce que tout cela ne veut pas dire

Je veux être précis sur un point, parce qu'il est facile de tirer la mauvaise conclusion de tout ça.

Rien de tout cela ne signifie que l'IA écrit mal le code. Elle écrit très bien le code. Et rien de tout cela ne signifie que l'outil va prendre le travail de qui que ce soit — ce n'est pas le cas, et cette formation n'est pas construite sur cette idée. Ce qu'il fait, c'est répondre à la question que vous lui avez posée. Exactement à la question que vous lui avez posée.

Le problème, dans chacun des trois modes de défaillance, est toujours le même — et ce n'est pas la réponse. C'est la question. Posée à voix haute, une fois, dans une fenêtre de chat, puis envolée.

## RÉSUMÉ

Donc — trois modes de défaillance.

**La perte de contexte** : les décisions vivent dans une conversation, et une conversation ne les retient pas. **La dérive silencieuse** : les décisions manquantes sont remplacées par des décisions raisonnables qui ne s'accordent pas entre elles. **Le travail invérifiable** : sans définition écrite de « terminé », vous ne pouvez rien prouver, donc vous ne pouvez rien livrer.

Si vous ne retenez qu'une phrase de cette leçon, retenez celle-ci. L'IA n'a pas trahi Thierry. Thierry n'a jamais écrit le brief — et tout ce que nous ferons à partir d'ici consiste à l'écrire une fois, correctement, pour qu'il tienne.

## ACTION

Avant la leçon suivante, repensez à la dernière chose que vous avez construite avec l'aide de l'IA. N'importe quoi — un script, un écran, une application entière.

Écrivez deux ou trois phrases pour nommer lequel des trois modes de défaillance vous a touché. Pas les trois. Celui qui vous a coûté le plus cher, et ce qu'il vous a coûté.

Gardez ce texte. Vous allez le reconnaître à nouveau d'ici une vingtaine de minutes, et je tiens à ce que vous l'ayez écrit avant.

## TRANSITION

Parce que nommer le problème, c'est la partie facile. Ensuite, on regarde ce qui le règle vraiment — et ce n'est pas une meilleure formulation de la demande.

---
---

# Leçon 1.2 — La chaîne « spécification d'abord », en une image

**Type :** Concept · **Durée visée :** 11 minutes

**Objectif pédagogique :** Expliquer comment chaque artefact de la chaîne — périmètre, spécification, tâche, code, test, livraison — contraint le suivant.

*(Contient la carte des six phases en 60 secondes, exigée par le Parcours Essentiel, en séquence 4.)*

---

## ACCROCHE

[SHOW ×L: carte-titre — « Leçon 1.2 · La chaîne "spécification d'abord", en une image »]

La plupart des gens, quand ils rencontrent les problèmes dont nous venons de parler, cherchent à mieux formuler leur demande.

Des instructions plus longues. Une liste de règles recollée en haut de chaque message. « Rappelle-toi qu'on avait décidé que… » Peut-être une consigne trouvée en ligne, avec cent lignes dedans.

Et je comprends parfaitement pourquoi, parce que ça semble être le bon levier. Mais ça ne marche pas, et il vaut la peine de comprendre pourquoi : une consigne, c'est encore quelque chose qu'on dit. C'est encore dans la conversation. Elle a exactement les trois problèmes qu'on vient de nommer, simplement avec plus de mots.

[PAUSE]

La solution, ce n'est pas une meilleure demande. C'est un meilleur *document*. Et plus précisément, ce sont six documents qui se passent chacun quelque chose.

## OBJECTIF

Dans cette leçon, nous allons voir la chaîne « spécification d'abord » — périmètre, spécification, tâche, code, test, livraison — pour que vous puissiez expliquer le rôle de chaque maillon, et pourquoi en retirer un seul remet la dérive en place.

## SÉQUENCE 1 — La chaîne, dans l'ordre où on s'en sert

Voilà l'ensemble.

[SHOW ×L: schéma en chaîne horizontale — Périmètre → Spécification → Tâche → Code → Test → Livraison]

Le **périmètre**, c'est ce qu'on construit et, tout aussi important, ce qu'on ne construit pas. La **spécification**, c'est comment ça se comporte : les règles, les écrans, les cas particuliers. Les **tâches**, c'est cette spécification découpée en morceaux assez petits pour être cochés un par un. Le **code**, c'est la réalisation. Le **test**, c'est la preuve que ça fait ce que la spécification disait. La **livraison**, c'est la sortie, avec un numéro de version.

Six maillons. Et toute l'idée de cette formation tient dans une seule propriété de cette chaîne : **chaque maillon rétrécit le suivant.**

Reprenons une image que vous connaissez déjà.

Quand on construit une maison, personne ne commence par décrire la cuisine au maçon. Il y a un programme — trois chambres, une famille de quatre, ce budget. Puis des plans. Puis des ordres de travaux pour chaque corps de métier. Puis le chantier. Puis la réception. Puis les clés.

Le programme ne dit pas à l'électricien où placer les prises. Ce sont les plans qui le disent. Mais les plans ne peuvent pas contredire le programme. C'est toute l'astuce, et c'est exactement la même ici.

## SÉQUENCE 2 — Pourquoi la contrainte est l'objectif, et pas la paperasse

Alors, je sais comment ça peut être reçu, surtout si vous avez travaillé dans une structure avec beaucoup de procédure et peu de livraisons. Ça peut ressembler à de l'administratif. Des documents pour des documents.

Voici donc la façon de voir les choses qui, d'expérience, reste vraiment.

Chaque artefact de cette chaîne existe pour **retirer des décisions à l'étape suivante**. C'est son seul travail. Et le nombre de décisions laissées ouvertes à une étape donnée correspond exactement — précisément — à la quantité de dérive que vous allez récolter.

Faisons le calcul, parce que c'est plus spectaculaire que ça n'en a l'air.

Supposons que votre périmètre contienne une ligne : *seuls les utilisateurs connectés voient les prix.*

Une phrase. Regardez ce qu'elle règle. Le prix s'affiche-t-il sur la page publique ? Non. Faut-il un écran de connexion ? Oui. La page de résultats de recherche montre-t-elle les prix à un visiteur ? Non. Que voit un visiteur non connecté à la place ? Quelque chose que vous devez maintenant décider une fois, délibérément, plutôt que neuf fois par accident.

[PAUSE]

Une phrase dans le périmètre. Environ une douzaine de questions qui ont désormais la même réponse partout, définitivement, sans que personne ait à se souvenir de la conversation.

Ce n'est pas de la paperasse. C'est le mécanisme.

## SÉQUENCE 3 — La règle qui en fait une boucle et non un classeur

Et c'est ici que la plupart des tentatives échouent. Je veux être très clair là-dessus, parce que c'est une seule règle, et que tout en dépend.

À un moment — en général vers la troisième semaine — la réalité va contredire votre document. Quelqu'un demande une chose que la spécification ne couvre pas. Ou vous découvrez que la spécification avait tort. Ça arrive sur tous les projets, y compris les miens.

À cet instant, vous avez deux possibilités, et elles ne mènent pas du tout au même endroit.

[SHOW ×L: comparaison en deux colonnes — « Directement dans le code » vs « D'abord dans la spécification »]

Voici la même situation, traitée de deux façons.

**Chloé** reçoit la demande : *est-ce qu'on peut ajouter un champ remise sur l'écran de commande ?* C'est petit. Elle est déjà dans le code. Elle ajoute le champ, elle le branche, et ça fonctionne avant midi. Sincèrement : du logiciel qui marche, le jour même.

Trois semaines plus tard, quelqu'un demande si la remise s'applique avant ou après la TVA. La spécification ne le dit pas, puisqu'elle n'a jamais entendu parler de remise. Le code, lui, dit quelque chose. Chloé doit relire son propre code pour retrouver ce qu'elle avait décidé — et elle découvre au passage que les états n'ont jamais été informés de l'existence des remises, donc que les totaux mensuels sont discrètement faux depuis trois semaines.

**Julien** reçoit exactement la même demande. Julien ouvre d'abord la spécification. L'écrire lui prend un quart d'heure, parce que l'écrire force trois questions à sortir au grand jour : avant ou après la TVA, qui a le droit d'accorder une remise, et est-ce que ça apparaît sur la facture. Julien pose ces trois questions à la personne qui a demandé, obtient trois réponses, les écrit, *puis* développe. Du logiciel qui marche en milieu d'après-midi au lieu de midi.

Trois semaines plus tard, personne n'a besoin de demander, parce que c'est écrit. Et les états ont été mis à jour, parce que la modification de la spécification rendait évident qu'il faudrait le faire.

[PAUSE]

La différence, ce n'est pas que Julien est plus discipliné, plus lent, ou plus expérimenté. La différence, c'est quatre heures en semaine une contre trois semaines de chiffres faux en semaine quatre.

La règle est donc celle-ci : **quand la réalité et le document se contredisent, on change le document d'abord, le code ensuite.** C'est ce qui en fait une boucle, et non un dossier de fichiers périmés que personne ne lit.

## SÉQUENCE 4 — Où se placent les six phases

Encore un élément, rapidement, pour que le vocabulaire soit en place — parce que wxKanban enveloppe cette chaîne dans six phases de projet dont vous verrez les noms en permanence à partir d'ici.

[SHOW ×L: bandeau des six phases — Conception · Réalisation · Tests QA · Tests utilisateurs · Bêta · Livraison]

La **Conception**, c'est là qu'on écrit et qu'on valide les périmètres et les spécifications. La **Réalisation**, c'est là que les tâches deviennent du code. Les **Tests QA**, ce sont les vérifications automatisées et de conformité. Les **Tests utilisateurs**, ce sont de vraies personnes qui s'en servent et qui vous disent ce qui ne va pas. La **Bêta**, c'est une diffusion limitée à un petit groupe. La **Livraison**, c'est la production.

Elles s'enchaînent dans cet ordre, et voici ce qui compte : wxKanban ne vous laissera pas en sauter une. Ce n'est pas là pour vous ralentir. C'est là parce que chacune de ces phases attrape un type d'erreur bien précis, et que la seule façon de savoir laquelle vous avez sautée, c'est de la découvrir plus tard, devant un client.

Et autant que vous entendiez la version honnête tout de suite, parce que la tentation viendra, probablement en deuxième semaine.

La phase qu'on saute, c'est celle des tests utilisateurs. C'est la plus lente, elle demande d'autres personnes, et quand vous y arrivez vos tests automatisés sont au vert et tout a l'air terminé. Elle ressemble donc à une formalité.

[PAUSE]

Elle n'en est pas une. Les tests automatisés vérifient que le logiciel fait ce que la spécification disait. Les tests utilisateurs vérifient si la spécification disait la bonne chose. Ce sont deux questions complètement différentes, et une seule des deux peut être traitée par une machine.

Toutes les règles que Marie connaît sur ce comptoir — c'est ça, les tests utilisateurs. Aucun test écrit ne peut trouver une règle dont vous ignoriez l'existence. Il faut quelqu'un qui fait le métier, qui regarde, et qui dit : « ce n'est pas comme ça qu'on traite un retour ».

## RÉSUMÉ

Donc : six maillons, chacun rétrécissant le suivant. Périmètre, spécification, tâche, code, test, livraison — le tout enveloppé dans six phases qui vous empêchent de sauter des étapes.

L'idée à retenir est celle de la deuxième séquence. Chaque document existe pour retirer des décisions à l'étape suivante. Moins de décisions ouvertes, moins de dérive. C'est toute la méthode ; le reste de cette formation n'en est que la mise en pratique.

## ACTION

Avant la leçon suivante, dessinez la chaîne à la main. Du vrai papier, un vrai stylo — ça prend deux minutes et ça tient bien mieux qu'une capture d'écran.

Puis, à côté de chacun des six maillons, écrivez une décision que votre projet a déjà prise. Une seule par maillon. Certains seront faciles, d'autres resteront vides.

Ce sont les vides qui sont utiles. Ce sont les décisions que votre projet n'a pas encore prises — et qu'il ignore ne pas avoir prises.

## TRANSITION

Et c'est le bon moment pour arrêter de lire et commencer à écrire, parce que dans quelques minutes vous allez produire le premier document de cette chaîne — et vous allez voir la différence immédiatement.

---
---

# Leçon 1.3 — PREMIÈRE VICTOIRE : la page d'intention qui change toutes les réponses de l'IA

**Type :** Pratique · **Durée visée :** 7 minutes (dont une pause de 15 minutes pour l'apprenant)

**Objectif pédagogique :** Produire une page d'intention d'une page et comparer la réponse de l'IA à cette page avec sa réponse à une demande non structurée.

---

## ACCROCHE

[SHOW ×L: carte-titre — « Leçon 1.3 · PREMIÈRE VICTOIRE : la page d'intention »]

Bien. Assez de théorie — passons à un résultat.

Dans les quinze prochaines minutes, vous allez écrire une page. Et vous allez ensuite voir cette page changer visiblement la qualité de ce que votre outil d'IA vous renvoie. Pas légèrement. De façon évidente.

Ça fonctionne avec n'importe quel assistant, sur n'importe quel projet, que vous installiez wxKanban un jour ou jamais. C'est la plus petite version possible de tout ce dont nous venons de parler, et elle est à vous dès aujourd'hui.

## OBJECTIF

Dans cette leçon, vous allez écrire une page d'intention d'une page, pour que chacune de vos demandes parte désormais d'un brief écrit plutôt que d'un paragraphe improvisé sur le moment.

## SÉQUENCE 1 — Ce que vous allez écrire

Six titres. C'est tout.

[SHOW ×L: les six titres à l'écran, maintenus pendant tout l'exercice]

**Un — Ce que c'est.** Une phrase. Pas un paragraphe.
**Deux — Qui s'en sert.** Nommez les rôles réels. Pas « les utilisateurs ».
**Trois — La seule chose que ça doit faire.** Au singulier. On y revient.
**Quatre — Ce que ça ne fera pas.** Au moins trois choses.
**Cinq — À quoi ressemble « terminé ».** Trois affirmations que quelqu'un d'autre pourrait vérifier sans vous demander.
**Six — Ce avec quoi je dois déjà composer.** La base de données qu'on ne peut pas remplacer, l'échéance, la plateforme, le budget.

Une page. Écrite à la main, c'est très bien.

## SÉQUENCE 2 — Les règles

Trois contraintes, et elles comptent plus que les titres eux-mêmes.

**Quinze minutes, chronomètre en marche.** C'est un premier jet, pas un contrat. Vous l'améliorerez au module 3.

**Le titre trois tient en une phrase, sans « et ».** Si votre phrase contient un « et », vous avez deux projets. Choisissez celui dont l'échec coûterait le plus cher.

**Le titre quatre est obligatoire.** Trois choses minimum. Je sais qu'il est étrange d'écrire ce qu'on ne construit pas. C'est la partie la plus précieuse de la page, et je vous dirai pourquoi une fois que vous l'aurez faite.

## SÉQUENCE 3 — Les deux premiers titres, faits pour vous

Je commence, pour que vous voyiez le niveau de détail attendu. Ensuite, vous continuez seul.

Delphine est en reconversion. Elle gérait un cabinet vétérinaire, et elle construit une application de rendez-vous pour une amie qui fait du toilettage canin à domicile, en camion aménagé.

**Ce que c'est :** *Une application de rendez-vous qui permet aux propriétaires de chiens de réserver un créneau de toilettage à leur domicile, et à la toiletteuse de voir sa journée sous forme de tournée.*

**Qui s'en sert :** *Le propriétaire du chien, sur son téléphone, en général le soir. La toiletteuse, une seule personne, qui consulte sa tournée dans son camion le matin. Personne d'autre.*

Remarquez ce que Delphine a fait. Pas « des clients et du personnel ». Un propriétaire de chien sur un téléphone le soir, et une toiletteuse dans un camion le matin. C'est assez précis pour qu'une IA prenne seule des décisions de mise en page sensées — et assez précis pour que vous repériez celles qui ne le sont pas.

[PAUSE]

Voilà le niveau. Deux phrases, concrètes toutes les deux.

Maintenant, mettez la vidéo en pause, lancez un chronomètre de quinze minutes, et écrivez les six titres pour votre propre projet. Revenez quand vous avez une page.

[PAUSE — « Pause ici. Quinze minutes. Puis revenez. »]

## SÉQUENCE 4 — Maintenant, servez-vous-en, et voyez la différence

Content de vous revoir.

Voici la partie qui transforme ça en victoire plutôt qu'en exercice.

Ouvrez votre assistant IA. Collez-y votre page entière. Puis, en dessous, demandez la première chose dont vous avez réellement besoin — un écran, un modèle de données, un plan, ce qui vient ensuite chez vous.

Lisez ce qui revient. Puis imaginez ce que vous auriez obtenu en posant la question à froid.

[PAUSE]

Deux signes que vous l'avez bien fait, et tous les deux sont un peu inconfortables.

**Un :** le titre quatre a été le plus difficile à écrire. Tant mieux. Chaque ligne qu'il contient est une discussion que vous n'aurez pas en semaine six.

**Deux :** vous avez changé d'avis sur le titre trois pendant que vous écriviez le titre cinq. Ce n'est pas une erreur — c'est la page qui fonctionne. « À quoi ressemble terminé » est l'endroit où les ambitions vagues sont obligées de devenir précises, et il révèle très souvent que la seule chose que ça devait faire n'était pas la bonne.

Si ces deux choses se sont produites, vous venez de faire, en quinze minutes, ce que Thierry n'a pas fait en six semaines.

## ACTION

La pratique est l'action, donc une seule consigne de plus : enregistrez-la.

Créez un dossier pour ce projet si vous n'en avez pas, et enregistrez la page dedans sous le nom `intent.md`. Du texte simple, rien de sophistiqué.

Ne la laissez pas dans une fenêtre de chat. Mettez-la dans un fichier. Cette distinction, c'est toute la formation en miniature — et vous rouvrirez exactement ce fichier au moment d'écrire votre premier vrai périmètre.

## TRANSITION

Gardez cette page à portée de main. À partir d'ici, tout ce que nous construisons y renvoie — et la prochaine étape, c'est de choisir la route que vous allez prendre.

---

*Adaptation française des scripts sources `scripts/en/M1-Lessons-1.1-1.2-1.3-Scripts.md`. Tournage distinct — non contraint par le minutage anglais.*
