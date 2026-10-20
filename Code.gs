// Ce code est à copier/coller dans l'éditeur de script de votre Google Sheet
// Outils (ou Extensions) > Apps Script

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
];
var COL_DATE_ENVOI = 7;
var RELANCE_DAYS = 7;

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost(e) {
  // Évite que deux envois simultanés écrivent sur la même ligne
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    // Parser les données envoyées par l'extension
    var data = JSON.parse(e.postData.contents);

    // Date d'envoi : celle de l'extension (utile pour les envois différés hors ligne)
    var dateEnvoi = data.appliedAt ? new Date(data.appliedAt) : new Date();
    if (isNaN(dateEnvoi.getTime())) dateEnvoi = new Date();
    dateEnvoi.setHours(0, 0, 0, 0);

    var dateRelance = new Date(dateEnvoi);
    dateRelance.setDate(dateRelance.getDate() + RELANCE_DAYS);

    var sheet = getSheet_();

    // De vraies dates (et non du texte) pour pouvoir trier, filtrer et colorer
    var newRow = [
      data.company || "",
      data.jobTitle || "",
      data.jobType || "",
      data.url || "",
      data.location || "",
      data.source || "",
      dateEnvoi,
      dateRelance,
    ];

    sheet.appendRow(newRow);
    sheet
      .getRange(sheet.getLastRow(), COL_DATE_ENVOI, 1, 2)
      .setNumberFormat("dd/MM/yyyy");

    return jsonResponse_({ status: "success" });
  } catch (error) {
    return jsonResponse_({ status: "error", message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}
