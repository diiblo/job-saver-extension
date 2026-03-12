# 🚀 Job Saver - Extension Chrome

**Job Saver** est une extension Chrome pratique et intelligente conçue pour vous faire gagner un temps précieux lors de vos recherches d'emploi. Elle permet de sauvegarder facilement et rapidement les détails des offres d'emploi que vous consultez, directement dans un tableau de bord Google Sheets. Fini les copier-coller fastidieux entre les différents onglets !

---

## ✨ Fonctionnalités Principales

- **Panneau flottant tout-en-un :** Un panneau escamotable s'injecte discrètement sur n'importe quelle page web, prêt à accueillir les informations de l'offre (Entreprise, Titre, Lieu, Type de poste, Source, Lien de l'offre).
- **Remplissage Intelligent au Clic-Droit (Menu Contextuel) :** Sélectionnez du texte sur une page d'offre d'emploi, faites un clic-droit, et envoyez directement la sélection dans le champ de votre choix (Ex: "Copier vers : Titre de l'offre").
- **Capture automatique de l'URL :** L'adresse web de la page active est récupérée et pré-remplie automatiquement.
- **Ajout automatisé des dates :** Lorsqu'une offre est sauvegardée, la date du jour (Date d'Envoi) et une date de rappel (Date de Relance fixée à + 7 jours) sont automatiquement insérées dans votre Google Sheets grâce au script.
- **Enregistrement en arrière-plan :** Les offres sont envoyées et ajoutées instantanément à votre tableau de suivi de candidatures via le bouton Sauvegarder !

---

## 🛠️ Prérequis

- Le navigateur **Google Chrome** (ou un navigateur Web basé sur Chromium).
- Un compte **Google** (pour mettre en place le fichier Google Sheets et son script Apps Script associé).

---

## 📥 Installation de l'Extension

1. Téléchargez ou clonez ce dépôt sur votre ordinateur.
2. Ouvrez Google Chrome et accédez à la page de gestion des extensions en tapant `chrome://extensions/` dans la barre d'adresse.
3. Activez le **Mode développeur** (interrupteur en haut à droite de la page).
4. Cliquez sur le bouton **Charger l'extension non empaquetée** (en haut à gauche).
5. Sélectionnez le dossier contenant les fichiers de ce projet (le dossier contenant `manifest.json`).
6. L'extension est maintenant installée dans votre navigateur !

---

## ⚙️ Configuration du Webhook (Côté Google Sheets)

Pour que l'extension puisse communiquer avec votre fichier de sauvegarde Google Sheets, vous devez mettre en place un **Webhook** via Google Apps Script. Voici la marche à suivre :

### 1. Préparation du document Google Sheets
1. Créez un nouveau fichier **Google Sheets** (par exemple : "Suivi des Candidatures").
2. Dans la première ligne, insérez vos en-têtes de colonnes **exactement dans cet ordre** pour correspondre au script :
   - *1. Entreprise*
   - *2. Titre de l'offre*
   - *3. Type de poste*
   - *4. Lien*
   - *5. Lieu*
   - *6. Source*
   - *7. Date d'Envoi*
   - *8. Date de Relance*

### 2. Création de l'application (Apps Script)
1. Toujours dans votre Google Sheets, cliquez sur **Extensions > Apps Script** dans le menu supérieur.
2. Un nouvel onglet d'éditeur de code s'ouvre. Effacez tout le code présent par défaut.
3. Ouvrez le fichier `Code.gs` fourni dans ce projet et **copiez-collez son contenu intégral** dans l'éditeur de l'Apps Script.
4. Enregistrez le projet (icône de disquette 💾 ou `Ctrl+S` / `Cmd+S`).

### 3. Déploiement de l'API Webhook
1. En haut à droite, cliquez sur le bouton bleu **Déployer > Nouvelle implémentation**.
2. Cliquez sur la **roue crantée ⚙️** à côté de "Sélectionner le type", puis choisissez **Application Web**.
3. Remplissez les paramètres de la façon suivante :
   - **Description :** *Job Saver Webhook* (ou le nom de votre choix)
   - **Exécuter en tant que :** *Moi (votre adresse e-mail)*
   - **Qui a accès :** *Tout le monde*
4. Cliquez sur le bouton **Déployer**. *(🚨 Note : Google peut vous demander d'autoriser l'accès à vos données, acceptez et validez les alertes de sécurité en cliquant sur "Paramètres avancés" > "Aller au projet (non sécurisé)" si nécessaire).*
5. Une fois déployé avec succès, copiez **l'URL de l'application Web** affichée. C'est l'URL de votre Webhook dont l'extension a besoin !

---

## 🔗 Connexion de l'Extension au Webhook

La dernière étape consiste à relier l'extension Chrome à votre Webhook fraîchement créé :

1. Cliquez sur l'icône de l'extension **Job Saver** dans la barre d'outils Chrome (il peut être nécessaire de l'épingler depuis le menu des extensions 🧩).
2. Une petite fenêtre contextuelle (Pop-up) s'ouvre.
3. Collez **l'URL du Webhook** que vous venez de copier à l'étape précédente.
4. Cliquez sur **Enregistrer**. Un message de confirmation vous certifiera le succès de l'opération.

Votre extension est maintenant prête à vous faire gagner du temps ! 🎉

---

## 💡 Guide d'Utilisation au Quotidien

1. Naviguez sur n'importe quel site d'offres d'emploi (LinkedIn, Welcome to the Jungle, Indeed, Pôle Emploi, etc.).
2. Vous apercevrez un **bouton flottant** en bas sur la page. Cliquez dessus pour ouvrir le panneau **Job Saver**.
3. L'URL étant pré-remplie, **deux méthodes s'offrent à vous** pour compléter les autres champs de l'offre :
   - Remplir et taper manuellement les informations relatives au job dans le panneau ouvert.
   - Surligner un texte sur la page avec votre souris *(Exemple : Sélectionnez le lieu du travail)* > **Faites un Clic-Droit** > **Job Saver** > **Copier vers : Lieu**. Le champ de la catégorie correspondante clignotera en bleu pour confirmer que le texte a été capturé !
4. Pensez à sélectionner le type de contrat (*CDI, CDD, Alternance, Stage...*) dans la liste déroulante proposée.
5. Une fois toutes les informations validées, cliquez sur le bouton bleu **Sauvegarder** au bas du panneau.
6. Le message `✅ Sauvegardé avec succès !` s'affiche et l'extension se referme automatiquement après quelques instants. Vérifiez votre Google Sheets, la ligne est ajoutée et formatée correctement !
