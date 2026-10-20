// Ce code est à copier/coller dans l'éditeur de script de votre Google Sheet
// Outils (ou Extensions) > Apps Script

// Jeton secret (facultatif mais recommandé) : si renseigné, l'extension doit
// envoyer le même jeton (champ "Jeton secret" de la configuration).
// Sans jeton, toute personne connaissant l'URL peut écrire dans votre fichier.
var SECRET_TOKEN = "";

// Onglet utilisé. S'il n'existe pas, le premier onglet du fichier est utilisé.
var SHEET_NAME = "Candidatures";
var HEADERS = [
  "Entreprise",
  "Titre de l'offre",
  "Type de poste",
  "Lien",
  "Lieu",
  "Source",
  "Date d'Envoi",
  "Date de Relance",
  "Type de candidature",
  "Statut",
  "Notes",
];
var COL = {
  company: 1,
  title: 2,
  url: 4,
  dateEnvoi: 7,
  dateRelance: 8,
  statut: 10,
};
var STATUTS = ["Envoyée", "Relancée", "Entretien", "Refus", "Offre reçue", "Abandon"];
var RELANCE_DAYS = 7;

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

  // Ajoute les en-têtes manquants (les anciens fichiers n'ont que 8 colonnes)
  var header = sheet.getRange(1, 1, 1, HEADERS.length);
  var current = header.getValues()[0];
  if (current.some(function (v) { return v === ""; })) {
    header.setValues([HEADERS.map(function (h, i) { return current[i] || h; })]);
    header.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
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
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var rows = sheet.getRange(2, 1, lastRow - 1, COL.dateEnvoi).getValues();
  var url = normalizeUrl_(data.url);
  var key = normalizeKey_(data.company, data.jobTitle);
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var sameUrl = url && normalizeUrl_(row[COL.url - 1]) === url;
    var sameKey = key && normalizeKey_(row[COL.company - 1], row[COL.title - 1]) === key;
    if (sameUrl || sameKey) return { date: formatDate_(row[COL.dateEnvoi - 1]) };
  }
  return null;
}

function appendApplication_(sheet, data) {
  // Date d'envoi : celle de l'extension (utile pour les envois différés hors ligne)
  var dateEnvoi = data.appliedAt ? new Date(data.appliedAt) : new Date();
  if (isNaN(dateEnvoi.getTime())) dateEnvoi = new Date();
  dateEnvoi.setHours(0, 0, 0, 0);

  var dateRelance = new Date(dateEnvoi);
  dateRelance.setDate(dateRelance.getDate() + RELANCE_DAYS);

  // De vraies dates (et non du texte) pour pouvoir trier, filtrer et colorer
  sheet.appendRow([
    data.company || "",
    data.jobTitle || "",
    data.jobType || "",
    data.url || "",
    data.location || "",
    data.source || "",
    dateEnvoi,
    dateRelance,
    data.applicationKind || "Offre",
    data.status || "Envoyée",
    data.notes || "",
  ]);
  sheet
    .getRange(sheet.getLastRow(), COL.dateEnvoi, 1, 2)
    .setNumberFormat("dd/MM/yyyy");
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
      var rows = sheet.getRange(2, 1, lastRow - 1, COL.dateEnvoi).getValues();
      items = rows.map(function (row) {
        return {
          company: row[COL.company - 1],
          title: row[COL.title - 1],
          url: row[COL.url - 1],
          date: formatDate_(row[COL.dateEnvoi - 1]),
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
    .addToUi();
}

function setup() {
  var sheet = getSheet_();
  var maxRows = sheet.getMaxRows() - 1;

  // Liste déroulante pour le statut
  sheet
    .getRange(2, COL.statut, maxRows, 1)
    .setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(STATUTS, true).build(),
    );

  // Orange : date de relance atteinte et toujours sans réponse
  var dataRange = sheet.getRange(2, 1, maxRows, HEADERS.length);
  var relance = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($H2<>"", $H2<=TODAY(), $J2="Envoyée")')
    .setBackground("#fde68a")
    .setRanges([dataRange])
    .build();
  var refus = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=OR($J2="Refus", $J2="Abandon")')
    .setFontColor("#9ca3af")
    .setRanges([dataRange])
    .build();
  var entretien = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=OR($J2="Entretien", $J2="Offre reçue")')
    .setBackground("#bbf7d0")
    .setRanges([dataRange])
    .build();
  sheet.setConditionalFormatRules([relance, refus, entretien]);
}
