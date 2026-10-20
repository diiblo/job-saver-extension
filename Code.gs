// Webhook Job Saver du document TABLEAU SUIVI RECHERCHES.

// Jeton secret (facultatif mais recommandé) : si renseigné, l'extension doit
// envoyer le même jeton (champ "Jeton secret" de la configuration).
// Sans jeton, toute personne connaissant l'URL peut écrire dans votre fichier.
var SECRET_TOKEN = "";
var SPREADSHEET_ID = "15kqAxHo9SEyP3p2zCt7PQ6Ozh8wzhbp0BcfRI3u6GR8";
var SHEET_ID = 1656407877;
var HEADERS = [
  "Date d'envoi",
  "Nom de l'entreprise",
  "Intitulé du poste",
  "Lien fiche de poste",
  "Nom du recruteur Contact LinkedIn",
  "E-mail",
  "N° téléphone",
  "Date candidature",
  "Date relance",
  "Date d'entretien",
  "Mail de remerciement (OUI/NON)",
  "Réponse entretien",
  "Notes",
];
var HEADER = {
  dateSent: "Date d'envoi",
  company: "Nom de l'entreprise",
  title: "Intitulé du poste",
  url: "Lien fiche de poste",
  recruiter: "Nom du recruteur Contact LinkedIn",
  email: "E-mail",
  phone: "N° téléphone",
  dateApplication: "Date candidature",
  dateFollowUp: "Date relance",
  dateInterview: "Date d'entretien",
  thankYouSent: "Mail de remerciement (OUI/NON)",
  interviewResponse: "Réponse entretien",
  notes: "Notes",
};
var RELANCE_DAYS = 7;

function getSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheets = ss.getSheets();
  var sheet = null;
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === SHEET_ID) {
      sheet = sheets[i];
      break;
    }
  }
  if (!sheet) throw new Error("L'onglet cible du tableau est introuvable.");

  var lastColumn = sheet.getLastColumn();
  if (lastColumn === 0 || sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .every(function (value) { return String(value || "").trim() === ""; })) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return sheet;
  }

  var current = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var normalized = current.map(function (value) {
    return String(value || "").trim().toLowerCase();
  });
  HEADERS.forEach(function (header) {
    if (normalized.indexOf(header.toLowerCase()) !== -1) return;
    if (header !== HEADER.notes) {
      throw new Error('En-tête manquant dans le tableau : "' + header + '".');
    }
    sheet.getRange(1, lastColumn + 1).setValue(header).setFontWeight("bold");
    normalized.push(header.toLowerCase());
    lastColumn++;
  });
  return sheet;
}

function getColumns_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (value) { return String(value || "").trim().toLowerCase(); });
  var columns = {};
  Object.keys(HEADER).forEach(function (key) {
    var index = headers.indexOf(HEADER[key].toLowerCase());
    if (index === -1) throw new Error('En-tête manquant dans le tableau : "' + HEADER[key] + '".');
    columns[key] = index + 1;
  });
  return columns;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function checkToken_(token) {
  if (SECRET_TOKEN && token !== SECRET_TOKEN) throw new Error("Jeton secret invalide");
}

function normalizeUrl_(url) {
  return String(url || "").trim().replace(/\/+$/, "").toLowerCase();
}

function normalizeKey_(company, title) {
  var c = String(company || "").trim().toLowerCase();
  var t = String(title || "").trim().toLowerCase();
  return c && t ? c + "|" + t : "";
}

function formatDate_(date) {
  if (!(date instanceof Date)) return String(date || "");
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

// Cherche une candidature déjà enregistrée (même lien, ou même entreprise + titre)
function findDuplicate_(sheet, data) {
  var columns = getColumns_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var url = normalizeUrl_(data.url);
  var key = normalizeKey_(data.company, data.jobTitle);
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var sameUrl = url && normalizeUrl_(row[columns.url - 1]) === url;
    var sameKey = key && normalizeKey_(row[columns.company - 1], row[columns.title - 1]) === key;
    if (sameUrl || sameKey) return { date: formatDate_(row[columns.dateApplication - 1]) };
  }
  return null;
}

function appendApplication_(sheet, data) {
  var columns = getColumns_(sheet);
  // Les deux colonnes de date correspondent à la date de candidature choisie.
  var dateEnvoi = data.appliedAt ? new Date(data.appliedAt) : new Date();
  if (isNaN(dateEnvoi.getTime())) dateEnvoi = new Date();
  dateEnvoi.setHours(0, 0, 0, 0);

  var dateRelance = new Date(dateEnvoi);
  dateRelance.setDate(dateRelance.getDate() + RELANCE_DAYS);
  var dateInterview = data.interviewDate ? new Date(data.interviewDate + "T12:00:00") : "";
  if (dateInterview && isNaN(dateInterview.getTime())) dateInterview = "";

  var row = new Array(sheet.getLastColumn()).fill("");
  row[columns.dateSent - 1] = dateEnvoi;
  row[columns.company - 1] = data.company || "";
  row[columns.title - 1] = data.jobTitle || "";
  row[columns.url - 1] = data.url || "";
  row[columns.recruiter - 1] = data.recruiterName || "";
  row[columns.email - 1] = data.email || "";
  row[columns.phone - 1] = data.phone || "";
  row[columns.dateApplication - 1] = dateEnvoi;
  row[columns.dateFollowUp - 1] = dateRelance;
  row[columns.dateInterview - 1] = dateInterview;
  row[columns.thankYouSent - 1] = data.thankYouSent || "";
  row[columns.interviewResponse - 1] = data.interviewResponse || "";
  var notes = [];
  if (data.location) notes.push("Lieu : " + data.location);
  if (data.jobType) notes.push("Type de poste : " + data.jobType);
  if (data.source) notes.push("Source : " + data.source);
  if (data.applicationKind) notes.push("Type de candidature : " + data.applicationKind);
  if (data.notes) notes.push(data.notes);
  row[columns.notes - 1] = notes.join("\n");
  sheet.appendRow(row);

  var newRow = sheet.getLastRow();
  [columns.dateSent, columns.dateApplication, columns.dateFollowUp, columns.dateInterview]
    .forEach(function (column) {
      sheet.getRange(newRow, column).setNumberFormat("dd/MM/yyyy");
    });
}

function doPost(e) {
  // Évite que deux envois simultanés écrivent sur la même ligne
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    // Parser les données envoyées par l'extension
    var data = JSON.parse(e.postData.contents);
    checkToken_(data.token);

    var sheet = getSheet_();
    if (!data.force) {
      var duplicate = findDuplicate_(sheet, data);
      if (duplicate) return jsonResponse_({ status: "duplicate", date: duplicate.date });
    }

    appendApplication_(sheet, data);
    return jsonResponse_({ status: "success" });
  } catch (error) {
    return jsonResponse_({ status: "error", message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// GET ?action=list&token=... : liste des candidatures, utilisée par l'extension
// pour afficher "Déjà postulé" sur les offres déjà enregistrées.
// GET ?action=ping&token=... : test de connexion depuis la configuration.
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    checkToken_(params.token);

    if (params.action === "ping") return jsonResponse_({ status: "success" });

    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();
    var items = [];
    if (lastRow >= 2) {
      var columns = getColumns_(sheet);
      var rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
      items = rows.map(function (row) {
        return {
          company: row[columns.company - 1],
          title: row[columns.title - 1],
          url: row[columns.url - 1],
          date: formatDate_(row[columns.dateApplication - 1]),
        };
      });
    }
    return jsonResponse_({ status: "success", items: items });
  } catch (error) {
    return jsonResponse_({ status: "error", message: error.toString() });
  }
}

// --- Mise en forme : à lancer une fois via le menu "Job Saver" > "Configurer le tableau" ---

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Job Saver")
    .addItem("Configurer le tableau", "setup")
    .addSeparator()
    .addItem("Importer depuis Gmail (60 derniers jours)", "importFromGmailFull")
    .addItem("Activer l'import Gmail automatique", "installGmailTrigger")
    .addItem("Désactiver l'import Gmail automatique", "removeGmailTrigger")
    .addToUi();
}

function setup() {
  var sheet = getSheet_();
  var columns = getColumns_(sheet);
  var maxRows = sheet.getMaxRows() - 1;
  sheet.getRange(2, columns.thankYouSent, maxRows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["OUI", "NON"], true).build(),
  );
}

// --- Import depuis Gmail ---
// Parcourt les e-mails de confirmation de candidature (LinkedIn, Indeed, WTTJ,
// La Bonne Alternance, sites carrière...) et ajoute celles qui manquent.
// Les refus reçus par e-mail sont indiqués dans la colonne "Réponse entretien".
// Les fils traités reçoivent le libellé "Job Saver" et ne sont pas relus.

var GMAIL_LABEL = "Job Saver";
var GMAIL_SEARCH =
  '("votre candidature" OR "your application" OR "candidature envoyée" OR ' +
  '"merci pour votre candidature" OR "thank you for applying" OR "thanks for applying" OR ' +
  '"application received" OR "application submitted")';

var CONFIRM_RE = /(candidature|application)[^.\n]{0,60}(envoyée|bien reçue|reçue|transmise|enregistrée|prise en compte|received|submitted|sent)|merci (pour|de) votre candidature|thanks? (you )?for (your application|applying)/i;
var REJECT_RE = /malheureusement|nous regrettons|n'avons pas retenu|pas été retenue?|ne pas donner suite|pas pouvoir donner suite|unfortunately|not (been )?selected|not moving forward|regret to inform/i;
// Alertes et newsletters : pas des candidatures
var IGNORE_RE = /alerte|job alert|offres? recommandées?|nouvelles offres|newsletter|webinar|complétez votre candidature|finish your application|candidature incomplète/i;

var SENDER_SOURCES = [
  [/linkedin\./, "LinkedIn"],
  [/indeed\./, "Indeed"],
  [/welcometothejungle\.|welcomekit\./, "Welcome to the Jungle"],
  [/apprentissage\.beta\.gouv\.fr|labonnealternance/, "La Bonne Alternance"],
  [/francetravail\.|pole-emploi\./, "France Travail"],
  [/hellowork\./, "HelloWork"],
  [/apec\.fr/, "APEC"],
  [/jobteaser\./, "JobTeaser"],
  [/glassdoor\./, "Glassdoor"],
  [/myworkday|workday\./, "Workday"],
  [/lever\.co/, "Lever"],
  [/greenhouse\./, "Greenhouse"],
  [/smartrecruiters\./, "SmartRecruiters"],
  [/teamtailor\./, "Teamtailor"],
];
var JOBBOARD_SENDER = /linkedin|indeed|welcometothejungle|welcomekit|apprentissage\.beta|francetravail|pole-emploi|hellowork|apec|jobteaser|glassdoor|workday|lever\.co|greenhouse|smartrecruiters|teamtailor|noreply|no-reply|ne-pas-repondre/i;

function importFromGmailFull() {
  var result = importFromGmail(60);
  SpreadsheetApp.getUi().alert(
    "Import Gmail terminé : " + result.added + " candidature(s) ajoutée(s), " +
      result.rejected + " refus mis à jour.",
  );
}

function importFromGmailRecent() {
  importFromGmail(3);
}

function installGmailTrigger() {
  removeGmailTrigger();
  ScriptApp.newTrigger("importFromGmailRecent").timeBased().everyHours(6).create();
  SpreadsheetApp.getUi().alert("Import Gmail automatique activé (toutes les 6 heures).");
}

function removeGmailTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "importFromGmailRecent") ScriptApp.deleteTrigger(trigger);
  });
}

function importFromGmail(days) {
  var label = GmailApp.getUserLabelByName(GMAIL_LABEL) || GmailApp.createLabel(GMAIL_LABEL);
  var query = "newer_than:" + days + 'd -label:"' + GMAIL_LABEL + '" ' + GMAIL_SEARCH;
  var threads = GmailApp.search(query, 0, 200);
  var sheet = getSheet_();
  var added = 0;
  var rejected = 0;

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    threads.forEach(function (thread) {
      var message = thread.getMessages()[0];
      var subject = message.getSubject() || "";
      var body = message.getPlainBody().slice(0, 4000);
      var text = subject + "\n" + body;

      if (IGNORE_RE.test(subject)) {
        // Pas une candidature : fil non marqué, au cas où une réponse arriverait dedans
      } else if (REJECT_RE.test(text)) {
        if (markRejected_(sheet, message, subject)) rejected++;
        thread.addLabel(label);
      } else if (CONFIRM_RE.test(text)) {
        var data = parseConfirmation_(message, subject, body);
        if (!findDuplicate_(sheet, data)) {
          appendApplication_(sheet, data);
          added++;
        }
        thread.addLabel(label);
      }
    });
  } finally {
    lock.releaseLock();
  }
  return { added: added, rejected: rejected };
}

function senderInfo_(message) {
  var from = message.getFrom();
  var match = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  var name = match ? match[1].trim() : "";
  var email = (match ? match[2] : from).trim().toLowerCase();
  return { name: name, email: email, domain: email.split("@")[1] || "" };
}

function cleanPart_(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:–—-]+|[\s.!:–—-]+$/g, "")
    .trim();
}

// Déduit entreprise et intitulé de l'objet et du corps de l'e-mail
function parseConfirmation_(message, subject, body) {
  var sender = senderInfo_(message);
  var company = "";
  var title = "";
  var m;
  // Ex. "Iris, votre candidature a été envoyée à Capgemini" (LinkedIn)
  if ((m = subject.match(/candidature a été envoyée (?:à|chez) (.+)$/i))) company = m[1];
  // Ex. "Votre candidature au poste de Développeur chez Acme" / "pour l'offre ..."
  if ((m = subject.match(/candidature (?:au poste d[e'] ?|pour (?:le poste d[e'] ?|l'offre ?)?|:)\s*(.+?)(?: (?:chez|à|@) (.+))?$/i))) {
    title = m[1];
    company = company || m[2] || "";
  }
  // Ex. "Votre candidature chez Acme"
  if (!company && (m = subject.match(/candidature (?:chez|à|auprès de) (.+)$/i))) company = m[1];
  // Ex. "Your application for Developer at Acme" / "Thank you for applying to Acme"
  if ((m = subject.match(/application (?:for|to) (?:the )?(.+?)(?: (?:at|with) (.+))?$/i))) {
    title = title || m[1];
    company = company || m[2] || "";
  }
  if (!company && (m = subject.match(/(?:applying|apply) (?:to|at) (.+)$/i))) company = m[1];
  // Indeed : "Candidature envoyée : Intitulé" puis l'entreprise dans le corps
  if (!title && (m = subject.match(/candidature envoyée\s*:\s*(.+)$/i))) title = m[1];
  if (!company && (m = body.match(/(?:chez|auprès de) ([A-Z0-9][^\n,.]{1,60})/))) company = m[1];
  if (!title && (m = body.match(/(?:application for(?: the)?|candidature (?:au poste de|pour le poste de|pour l'offre))\s*:?\s*([^\n.]{3,80})/i))) {
    title = m[1].replace(/ (?:at|chez) .+$/i, "");
  }
  // LinkedIn : l'intitulé du poste est la première ligne du message
  if (!title && /linkedin\./.test(sender.domain)) {
    title = body.split("\n").map(cleanPart_).filter(Boolean)[0] || "";
  }
  // Site carrière d'une entreprise : le nom de l'expéditeur est souvent celui de l'entreprise
  if (!company && sender.name && !JOBBOARD_SENDER.test(sender.email + " " + sender.name)) company = sender.name;

  var source = "Gmail";
  for (var i = 0; i < SENDER_SOURCES.length; i++) {
    if (SENDER_SOURCES[i][0].test(sender.domain)) {
      source = SENDER_SOURCES[i][1];
      break;
    }
  }

  var text = (subject + " " + body.slice(0, 1500)).toLowerCase();
  var jobType = "";
  if (/altern|apprenti|contrat (de )?pro/.test(text) || source === "La Bonne Alternance") jobType = "Alternance";
  else if (/\bstages?\b|stagiaire|internship|\bintern\b/.test(text)) jobType = "Stage";
  else if (/\bcdd\b/.test(text)) jobType = "CDD";
  else if (/\bcdi\b/.test(text)) jobType = "CDI";

  var offerUrl = (body.match(/https?:\/\/[^\s>)"]*(?:\/jobs?\/view\/\d+|viewjob\?jk=\w+|\/emploi\/[^\s>)"?]+|\/offres?\/[^\s>)"?]+)/i) || [])[0];
  // Même format de lien que l'extension, pour détecter les doublons
  if (offerUrl && (m = offerUrl.match(/linkedin\.com\/.*jobs\/view\/(\d+)/))) {
    offerUrl = "https://www.linkedin.com/jobs/view/" + m[1] + "/";
  }

  var spontaneous = /spontanée/i.test(text);
  return {
    company: cleanPart_(company),
    jobTitle: cleanPart_(title) || (spontaneous ? "Candidature spontanée" : cleanPart_(subject)),
    jobType: jobType,
    url: offerUrl || "https://mail.google.com/mail/u/0/#all/" + message.getThread().getId(),
    location: "",
    source: source,
    appliedAt: message.getDate().toISOString(),
    applicationKind: spontaneous ? "Candidature spontanée" : "Offre",
    notes: "Importé depuis Gmail : " + subject,
  };
}

// Inscrit un refus dans la seule candidature correspondante, si la réponse est vide.
function markRejected_(sheet, message, subject) {
  var columns = getColumns_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var sender = senderInfo_(message);
  var haystack = (subject + " " + sender.name + " " + sender.domain).toLowerCase();
  var rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var matches = [];
  rows.forEach(function (row, i) {
    var company = String(row[columns.company - 1] || "").trim().toLowerCase();
    var response = String(row[columns.interviewResponse - 1] || "").trim();
    if (company.length >= 3 && !response && haystack.indexOf(company) !== -1) matches.push(i + 2);
  });
  if (matches.length !== 1) return false;

  sheet.getRange(matches[0], columns.interviewResponse).setValue("Refus");
  return true;
}
