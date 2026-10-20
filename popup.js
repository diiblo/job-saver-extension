document.addEventListener("DOMContentLoaded", () => {
  const webhookUrlInput = document.getElementById("webhookUrl");
  const secretTokenInput = document.getElementById("secretToken");
  const saveBtn = document.getElementById("saveBtn");
  const statusDiv = document.getElementById("status");

  // Charger la configuration stockée
  chrome.storage.local.get(["webhookUrl", "secretToken"], (data) => {
    if (data.webhookUrl) webhookUrlInput.value = data.webhookUrl;
    if (data.secretToken) secretTokenInput.value = data.secretToken;
  });

  // Bouton Enregistrer
  saveBtn.addEventListener("click", () => {
    const url = webhookUrlInput.value.trim();
    if (!url) {
      showStatus("Veuillez renseigner une URL valide.", "error");
      return;
    }

    chrome.storage.local.set({ webhookUrl: url, secretToken: secretTokenInput.value.trim() }, () => {
      // Recharge la liste des candidatures déjà enregistrées
      chrome.runtime.sendMessage({ action: "refreshCache" });
      showStatus("Configuration enregistrée !", "success");
      setTimeout(() => window.close(), 1500); // ferme la popup
    });
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status-msg status-${type}`;
    statusDiv.classList.remove("hidden");

    setTimeout(() => {
      if(statusDiv) statusDiv.classList.add("hidden");
    }, 3000);
  }
});
