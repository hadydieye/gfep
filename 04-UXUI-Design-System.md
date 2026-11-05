# UX/UI Design System — Guinea Finance Enterprise Portal (GFEP)
Version 1.0 — 2026-11-05

---

## 1. Objet et principe directeur

Ce document fixe les règles visuelles et d'interaction de GFEP, pour que l'application ait l'apparence et le comportement d'un **vrai logiciel d'entreprise premium** — pas d'un gabarit générique "vibecodé" avec des composants shadcn/ui laissés par défaut. Toute déviation de ce document doit être justifiée, pas improvisée écran par écran.

**Référence d'inspiration** : logiciels de gestion d'entreprise modernes (type Linear pour la rigueur d'interaction, Mercury/Ramp pour la finance, Workday pour la densité RH) — jamais un style "dashboard template" générique trouvable en un clic sur un marketplace.

## 2. Identité visuelle

### 2.1 Palette de couleurs

La palette doit être définie et **non laissée aux valeurs par défaut de shadcn/ui**. Proposition de base (à ajuster, mais la structure ci-dessous doit être respectée) :

| Rôle | Mode clair | Mode sombre | Usage |
| --- | --- | --- | --- |
| Primaire | `#0F4C3A` (vert profond, évoque finance/confiance) | `#1A6B52` | Boutons principaux, liens actifs, accents de marque |
| Secondaire | `#C9A227` (or discret) | `#D4AF37` | Accents ponctuels, badges premium, highlights |
| Fond principal | `#FAFAF8` | `#0D0F0E` | Arrière-plan général |
| Fond surface | `#FFFFFF` | `#16181A` | Cartes, panneaux, modales |
| Texte primaire | `#111418` | `#F2F3F2` | Titres, texte principal |
| Texte secondaire | `#5C6168` | `#9AA0A6` | Légendes, méta-informations |
| Bordures | `#E4E6E8` | `#2A2D30` | Séparateurs, contours de carte |
| Succès | `#1B8A5A` | `#2FA873` | Confirmations, statuts positifs |
| Attention | `#B8860B` | `#D4A017` | Avertissements |
| Erreur | `#C0392B` | `#E05A4A` | Erreurs, suppressions |

**Pourquoi un vert profond + or plutôt qu'un bleu générique** : le bleu "corporate" par défaut (type `#3B82F6`) est la signature visuelle immédiatement reconnaissable des interfaces générées rapidement. Vert profond + or installe une identité distincte, cohérente avec le positionnement "finance d'entreprise" de GUINEA FINANCE SARL.

### 2.2 Typographie

| Usage | Police | Poids | Taille |
| --- | --- | --- | --- |
| Titres de page | Inter ou Geist | 600 (semibold) | 24–28px |
| Titres de section | Inter ou Geist | 600 | 18–20px |
| Corps de texte | Inter ou Geist | 400 | 14–15px |
| Texte secondaire / légendes | Inter ou Geist | 400 | 12–13px |
| Chiffres clés (dashboard) | Inter ou Geist, variante tabulaire si dispo | 600–700 | 28–36px |

Éviter les polices "système par défaut" sans intention (`ui-sans-serif` brut) : charger explicitement une police via next/font pour un rendu cohérent cross-navigateur.

### 2.3 Iconographie

- Lucide Icons exclusivement, taille cohérente (18px dans les listes, 20px dans la navigation, 16px dans les badges).
- Jamais d'emoji dans l'interface produit (newsletters/notifications internes à la rigueur, jamais dans la navigation ou les boutons).

## 3. Grille et espacement

- Système d'espacement en base 4px (4, 8, 12, 16, 24, 32, 48, 64).
- Largeur de contenu maximale dans les zones de lecture : 1280px, centré, avec marges latérales responsives.
- Sidebar fixe : 260px en desktop, réductible en mode icône seule (64px) sur demande utilisateur.
- Grille de cartes dashboard : 12 colonnes, cartes en spans de 3/4/6/12 selon l'importance.

## 4. Composants clés et leurs règles

### 4.1 Boutons
- Primaire : fond couleur primaire, texte blanc, utilisé une seule fois par section (l'action la plus importante).
- Secondaire : contour, fond transparent.
- Destructif : couleur erreur, toujours avec confirmation (modale) avant une action irréversible.
- Jamais plus d'un bouton primaire visible simultanément dans une même zone d'écran.

### 4.2 Tableaux de données
- En-têtes collants (sticky) au scroll vertical.
- Tri par colonne, filtres au-dessus du tableau (pas dans une modale séparée pour les filtres fréquents).
- Pagination en bas, jamais de scroll infini pour les données métier (l'utilisateur doit pouvoir référencer "page 3").
- Ligne au survol avec léger changement de fond, curseur pointer si cliquable.
- Densité "confortable" par défaut (40px de hauteur de ligne), pas compacte ni large.

### 4.3 Cartes (dashboard)
- Fond surface, bordure légère, coin arrondi 8px, ombre très subtile (jamais une ombre portée prononcée type "glassmorphism" générique).
- Un indicateur chiffré a toujours : label, valeur, et variation ou contexte (ex: "+12% vs mois dernier" ou "sur 40 employés").

### 4.4 Formulaires
- Labels toujours visibles au-dessus du champ (jamais uniquement en placeholder qui disparaît à la saisie).
- Validation en temps réel après la première soumission tentée (pas d'erreur agressive dès le premier caractère tapé).
- Messages d'erreur sous le champ concerné, en couleur erreur, texte court et actionnable ("Email invalide" plutôt que "Erreur de validation du champ email").

### 4.5 Modales
- Réservées aux confirmations et aux formulaires courts (< 6 champs). Un formulaire long va sur sa propre page, pas en modale.
- Fermeture par Echap et par clic extérieur, sauf pour les actions destructrices (fermeture explicite uniquement).

### 4.6 Notifications (toasts)
- Position : coin supérieur droit.
- Durée : 4 secondes pour succès/info, persistant (fermeture manuelle) pour erreur.
- Jamais plus de 2 toasts visibles simultanément (empilement avec résumé au-delà).

### 4.7 Badges de statut
- Forme pilule, couleur sémantique (succès/attention/erreur/neutre), texte court (1-2 mots : "Actif", "En attente", "Suspendu").

### 4.8 États vides et de chargement
- Skeleton loaders respectant la forme du contenu final (pas un spinner générique centré pour une liste).
- État vide : icône discrète + message contextuel + action suggérée si pertinente (ex: "Aucun document — Déposer un document").

## 5. Mode clair / mode sombre

- Les deux modes sont des **citoyens de première classe**, pas le mode sombre comme un simple inverseur de couleurs. Chaque token de couleur de la section 2.1 est défini explicitement pour les deux modes.
- Bascule accessible depuis la barre supérieure, préférence persistée (stockage local du choix utilisateur).
- Contraste vérifié manuellement sur les combinaisons texte/fond critiques (WCAG AA minimum, ratio 4.5:1 pour le texte standard).

## 6. Responsive

| Breakpoint | Comportement |
| --- | --- |
| Desktop (≥1280px) | Sidebar fixe visible, grille de cartes complète |
| Tablette (768–1279px) | Sidebar réductible en icônes, grille de cartes en 2 colonnes |
| Mobile (<768px) | Sidebar en menu tiroir (drawer), tableaux en vue carte empilée plutôt qu'en colonnes horizontales |

## 7. Ton et langage de l'interface

- Vouvoiement, registre professionnel mais pas froid ("Votre document a été envoyé" plutôt que "Opération réussie").
- Pas d'humour ni de ton familier dans les messages système.
- Les messages d'erreur ne blâment jamais l'utilisateur ("Le format de fichier n'est pas pris en charge" plutôt que "Vous avez envoyé un mauvais fichier").

## 8. Ce qui est explicitement interdit (pour éviter l'effet "vibecodé")

- Dégradés multicolores décoratifs sans fonction.
- Emoji dans les titres, boutons ou éléments de navigation.
- Composants shadcn/ui utilisés sans personnalisation de thème (couleurs, rayon de bordure, ombre par défaut).
- Illustrations génériques de type "undraw" ou clipart pour les états vides — préférer une icône Lucide sobre + texte.
- Polices système par défaut non chargées explicitement.
- Boutons avec icône ET texte systématiquement — réserver l'icône seule aux actions universellement reconnues (fermer, modifier, supprimer).

## 9. Livrable attendu du design system en code

- Fichier de tokens centralisé (variables CSS ou fichier de thème Tailwind) reprenant exactement la palette de la section 2.1.
- Composants shadcn/ui installés puis **réellement personnalisés** dans leur thème (pas seulement importés tels quels).
- Une page de référence interne (`/design-system` ou Storybook léger) listant tous les composants de base avec leurs variantes — utile pour vérifier la cohérence au fil du développement, pas exposée aux utilisateurs finaux.
