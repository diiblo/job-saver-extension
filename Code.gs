// Ce code est à copier/coller dans l'éditeur de script de votre Google Sheet
// Outils (ou Extensions) > Apps Script

function doPost(e) {
  // Préparation de la réponse (CORS)
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    // Parser les données envoyées par l'extension
    var data = JSON.parse(e.postData.contents);

    var company = data.company || "";
    var jobTitle = data.jobTitle || "";
    var location = data.location || "";
    var jobType = data.jobType || "";
    var source = data.source || "";
    var url = data.url || "";
    // Calcul de la Date d'Envoi (Aujourd'hui)
    var dateEnvoiObj = new Date();
    var formattedDateEnvoi = Utilities.formatDate(
      dateEnvoiObj,
      Session.getScriptTimeZone(),
      "dd/MM/yyyy",
    );

    // Calcul de la Date de Relance (+7 jours)
    var dateRelanceObj = new Date(dateEnvoiObj);
    dateRelanceObj.setDate(dateRelanceObj.getDate() + 7);
    var formattedDateRelance = Utilities.formatDate(
      dateRelanceObj,
      Session.getScriptTimeZone(),
      "dd/MM/yyyy",
    );

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Insérer la ligne à la fin du tableau dans l'ordre exact demandé :
    // 1: Entreprise, 2: Titre, 3: Type, 4: Lien, 5: Lieu, 6: Source, 7: Date Envoi, 8: Date Relance
    var newRow = [
      company,
      jobTitle,
      jobType,
      url,
      location,
      source,
      formattedDateEnvoi,
      formattedDateRelance,
    ];

    sheet.appendRow(newRow);

    return ContentService.createTextOutput(
      JSON.stringify({ status: "success" }),
    ).setMimeType(ContentService.MimeType.JSON);
    //.setHeaders(headers); // ContentService ne permet pas de set des headers customs facilement, mais le setMimeType suffit généralement avec jsonp ou text/plain coté client
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: error.toString() }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Optionnel, pour réagir aux requetes OPTIONS (CORS preflight)
function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  return ContentService.createTextOutput("").setMimeType(
    ContentService.MimeType.TEXT,
  );
}
