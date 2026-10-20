# 🚀 Job Saver - Extension Chrome

**Job Saver** enregistre vos candidatures dans un tableau Google Sheets, quel que soit le site sur lequel vous postulez : LinkedIn, Indeed, La Bonne Alternance, Welcome to the Jungle, France Travail, HelloWork, APEC, JobTeaser, sites carrière des entreprises (Workday, Lever, Greenhouse…). Les infos de l'offre sont détectées automatiquement, et les candidatures envoyées sans l'extension peuvent être rattrapées depuis vos e-mails Gmail.

---

## ✨ Fonctionnalités Principales

- **Remplissage automatique :** entreprise, intitulé, lieu, type de contrat (CDI, CDD, Alternance, Stage) et source sont détectés sur la page de l'offre.
  - Données structurées *JobPosting* (publiées par la plupart des sites pour Google Jobs).
  - Extracteurs dédiés pour LinkedIn, Indeed, La Bonne Alternance (offres **et** candidatures spontanées), Glassdoor et Welcome to the Jungle.
  - Suivi des sites qui changent d'offre sans recharger la page (liste de résultats LinkedIn, Indeed, La Bonne Alternance…). Le bouton **↻** relance la détection.
- **Détection des candidatures :** quand un site affiche « Votre candidature a été envoyée » (ou quand vous cliquez sur « Postuler » pour partir chez le recruteur), Job Saver propose de l'enregistrer en un clic. Sur la page de confirmation d'un autre site, il reprend l'offre que vous consultiez juste avant.
- **Import depuis Gmail :** les e-mails de confirmation (LinkedIn, Indeed, La Bonne Alternance, sites carrière…) sont ajoutés au tableau, automatiquement toutes les 6 heures si vous le souhaitez. Les e-mails de refus passent la candidature au statut « Refus ».
- **Pas de doublons :** une offre déjà enregistrée (même lien, ou même entreprise + intitulé) est signalée par une pastille verte et le bandeau « Déjà postulé le … ».
- **Hors ligne :** si l'envoi échoue, la candidature est gardée et renvoyée automatiquement.
- **Suivi dans Google Sheets :** date d'envoi, date de relance (+7 jours), statut (Envoyée, Relancée, Entretien, Refus, Offre reçue, Abandon), notes, et couleurs automatiques quand une relance est due.
- **Menu clic droit :** sélectionnez un texte > clic droit > **Job Saver** > **Copier vers : …** pour corriger un champ.

---

## 🛠️ Prérequis

- Le navigateur **Google Chrome** (ou un navigateur Web basé sur Chromium).
- Un compte **Google** (pour le fichier Google Sheets et son script Apps Script).

---

## 📥 Installation de l'Extension

1. Téléchargez ou clonez ce dépôt sur votre ordinateur.
2. Ouvrez `chrome://extensions/`.
3. Activez le **Mode développeur** (interrupteur en haut à droite).
4. Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le dossier contenant `manifest.json`.

> Après une mise à jour du dossier, cliquez sur l'icône ↻ de l'extension dans `chrome://extensions/` puis rechargez les pages ouvertes.

---

## ⚙️ Configuration du Webhook (Côté Google Sheets)

### 1. Préparation du document Google Sheets
1. Créez un nouveau fichier **Google Sheets** (par exemple : "Suivi des Candidatures").
2. Nommez l'onglet **Candidatures** (sinon le premier onglet est utilisé). Les en-têtes de colonnes sont créés automatiquement :
   *Entreprise, Titre de l'offre, Type de poste, Lien, Lieu, Source, Date d'Envoi, Date de Relance, Type de candidature, Statut, Notes.*

   Un ancien tableau à 8 colonnes reste compatible : les 3 nouvelles colonnes sont ajoutées à droite.

### 2. Création de l'application (Apps Script)
1. Dans Google Sheets, cliquez sur **Extensions > Apps Script**.
2. Effacez le code présent et **collez le contenu intégral** du fichier `Code.gs`.
3. *(Recommandé)* Renseignez un jeton secret en haut du fichier : `var SECRET_TOKEN = "une-phrase-longue-et-secrete";`
4. Enregistrez le projet (`Ctrl+S` / `Cmd+S`).

### 3. Déploiement de l'API Webhook
1. Cliquez sur **Déployer > Nouveau déploiement**.
2. Roue crantée ⚙️ > **Application Web**.
3. Paramètres :
   - **Exécuter en tant que :** *Moi*
   - **Qui a accès :** *Tout le monde*
4. Cliquez sur **Déployer** et autorisez l'accès (« Paramètres avancés » > « Accéder au projet » si Google affiche un avertissement).
5. Copiez **l'URL de l'application Web** (elle se termine par `/exec`).

> 🔁 **Après chaque modification de `Code.gs`** : **Déployer > Gérer les déploiements** > ✏️ > **Version : Nouvelle version** > **Déployer**. L'URL reste la même.

### 4. Mise en forme du tableau
Rechargez le Google Sheets : un menu **Job Saver** apparaît. Cliquez sur **Job Saver > Configurer le tableau** pour ajouter la liste déroulante des statuts et les couleurs :
- 🟧 relance due (date de relance passée, statut « Envoyée ») ;
- 🟩 entretien ou offre reçue ;
- grisé : refus ou abandon.

### 5. Import Gmail (facultatif)
- **Job Saver > Importer depuis Gmail (60 derniers jours)** : rattrape les candidatures passées. Google demande l'autorisation d'accéder à Gmail la première fois.
- **Job Saver > Activer l'import Gmail automatique** : vérifie les nouveaux e-mails toutes les 6 heures.
- Les e-mails traités reçoivent le libellé **Job Saver** dans Gmail.

> L'analyse des e-mails est approximative : vérifiez les lignes importées (colonne Notes : « Importé depuis Gmail : objet du mail »).

---

## 🔗 Connexion de l'Extension au Webhook

1. Cliquez sur l'icône **Job Saver** dans la barre d'outils Chrome (épinglez-la depuis le menu 🧩).
2. Collez l'**URL du Webhook** et, si vous en avez défini un, le **jeton secret**.
3. Cliquez sur **Tester**, puis sur **Enregistrer**.

La popup permet aussi de :
- activer ou désactiver la détection des candidatures ;
- afficher le bouton flottant sur tous les sites (par défaut, seulement sur les pages d'offres) ;
- synchroniser la liste des candidatures connues (pour « Déjà postulé ») ;
- renvoyer les candidatures en attente ;
- exporter l'historique local en CSV.

---

## 💡 Guide d'Utilisation au Quotidien

1. Ouvrez une offre sur n'importe quel site d'emploi.
2. Cliquez sur le **bouton flottant** en bas à droite (ou `Alt` + `Shift` + `J`) : les champs sont déjà remplis.
3. Vérifiez ou corrigez (au clavier ou avec le clic droit **Job Saver > Copier vers : …**), ajoutez une note si besoin.
4. Cliquez sur **Sauvegarder**.

Quand vous postulez directement sur le site, Job Saver affiche « 🎉 Candidature envoyée détectée ! » : cliquez sur **Enregistrer** (ou **Vérifier** pour ouvrir le panneau d'abord).

Sur **La Bonne Alternance**, les offres sont enregistrées en type « Offre » et les entreprises susceptibles de recruter en « Candidature spontanée ».

---

## 🧩 Limites connues

- Les sites modifient régulièrement leur structure : si un champ n'est plus détecté, le menu clic droit reste disponible.
- Le raccourci clavier peut être changé dans `chrome://extensions/shortcuts`.
