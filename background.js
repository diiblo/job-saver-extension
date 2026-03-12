chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "jobSaverMenu", title: "Job Saver", contexts: ["selection", "page"] });
  chrome.contextMenus.create({ id: "saveCompany", parentId: "jobSaverMenu", title: "Copier vers : Entreprise", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "saveJobTitle", parentId: "jobSaverMenu", title: "Copier vers : Titre de l'offre", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "saveLocation", parentId: "jobSaverMenu", title: "Copier vers : Lieu", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "saveSource", parentId: "jobSaverMenu", title: "Copier vers : Source", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "saveUrl", parentId: "jobSaverMenu", title: "Copier vers : Lien de l'offre", contexts: ["page", "selection", "link"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  // On détermine quel champ on veut modifier et la valeur
  let targetField = "";
  let value = info.selectionText ? info.selectionText.trim() : "";

  if (info.menuItemId === "saveCompany") targetField = "company";
  else if (info.menuItemId === "saveJobTitle") targetField = "title";
  else if (info.menuItemId === "saveLocation") targetField = "location";
  else if (info.menuItemId === "saveSource") targetField = "source";
  else if (info.menuItemId === "saveUrl") {
    targetField = "url";
    value = info.linkUrl || info.pageUrl;
  }

  // On envoie le message au script injecté dans la page active
  if (targetField) {
    chrome.tabs.sendMessage(tab.id, {
      action: "updateField",
      field: targetField,
      value: value
    }).catch(err => {
      // Le content script n'est potentiellement pas injecté sur des pages 
      // spéciales comme chrome:// ou certaines sécurisées.
      console.warn("Impossible d'injecter dans cette page :", err);
    });
  }
});
