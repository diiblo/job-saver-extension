document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const webhookUrlInput = $("webhookUrl");
  const secretTokenInput = $("secretToken");
  const detectInput = $("detectApplications");
  const alwaysShowInput = $("alwaysShowButton");
  const statusDiv = $("status");
  let statusTimer = null;

  // Charger la configuration stockée
  chrome.storage.local.get(["webhookUrl", "secretToken", "detectApplications", "alwaysShowButton"], (data) => {
    if (data.webhookUrl) webhookUrlInput.value = data.webhookUrl;
    if (data.secretToken) secretTokenInput.value = data.secretToken;
    detectInput.checked = data.detectApplications !== false;
    alwaysShowInput.checked = !!data.alwaysShowButton;
  });
  refreshStats();

  // Une URL d'application web Apps Script se termine par /exec (et non /dev ou /edit)
  function validateUrl(url) {
    if (!url) return "Veuillez renseigner une URL valide.";
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
      return "L'URL doit commencer par https://script.google.com/ et finir par /exec.";
    }
    return "";
  }

  function saveConfig() {
    const url = webhookUrlInput.value.trim();
    const error = validateUrl(url);
    if (error) {
      showStatus(error, "error");
      return Promise.reject(new Error(error));
    }
    return chrome.storage.local.set({ webhookUrl: url, secretToken: secretTokenInput.value.trim() });
  }

  $("saveBtn").addEventListener("click", async () => {
    try { await saveConfig(); } catch (e) { return; }
    // Recharge la liste des candidatures déjà enregistrées
    chrome.runtime.sendMessage({ action: "refreshCache" }, refreshStats);
    showStatus("Configuration enregistrée !", "success");
  });

  $("testBtn").addEventListener("click", async () => {
    try { await saveConfig(); } catch (e) { return; }
    showStatus("Test en cours...", "success");
    chrome.runtime.sendMessage({ action: "ping" }, (result) => {
      if (result && result.status === "success") showStatus("✅ Connexion réussie !", "success");
      else showStatus("❌ " + ((result && result.message) || "Échec de la connexion"), "error");
    });
  });

  detectInput.addEventListener("change", () => {
    chrome.storage.local.set({ detectApplications: detectInput.checked });
  });
  alwaysShowInput.addEventListener("change", () => {
    chrome.storage.local.set({ alwaysShowButton: alwaysShowInput.checked });
    showStatus("Rechargez les pages ouvertes pour appliquer.", "success");
  });

  $("openPanelBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
      window.close();
    } catch (e) {
      showStatus("Impossible sur cette page (rechargez-la ou essayez un autre site).", "error");
    }
  });

  $("syncBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "refreshCache" }, (result) => {
      if (result && result.status === "success") showStatus(`✅ ${result.count} candidature(s) synchronisée(s).`, "success");
      else showStatus("❌ " + ((result && result.message) || "Synchronisation impossible"), "error");
      refreshStats();
    });
  });

  $("flushBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "flushQueue" }, (result) => {
      if (result) showStatus(`${result.sent} envoyée(s), ${result.remaining} en attente.`, result.remaining ? "error" : "success");
      refreshStats();
    });
  });

  $("exportBtn").addEventListener("click", () => {
    chrome.storage.local.get("history", ({ history }) => {
      if (!history || !history.length) {
        showStatus("Aucune candidature dans l'historique local.", "error");
        return;
      }
      downloadCsv(history);
    });
  });

  function refreshStats() {
    chrome.storage.local.get(["savedJobs", "pendingQueue", "history"], (data) => {
      const known = data.savedJobs ? Object.keys(data.savedJobs.byUrl).length : 0;
      const queue = (data.pendingQueue || []).length;
      const history = (data.history || []).length;
      $("knownCount").textContent = `${known} offre(s) connue(s)`;
      $("queueCount").textContent = `${queue} en attente d'envoi`;
      $("historyCount").textContent = `${history} dans l'historique local`;
    });
  }

  function downloadCsv(history) {
    const columns = [
      ["company", "Entreprise"],
      ["jobTitle", "Titre de l'offre"],
      ["jobType", "Type de poste"],
      ["url", "Lien"],
      ["location", "Lieu"],
      ["source", "Source"],
      ["appliedAt", "Date d'Envoi"],
      ["applicationKind", "Type de candidature"],
      ["notes", "Notes"],
    ];
    const escape = (value) => `"${String(value || "").replace(/"/g, '""')}"`;
    const rows = history.map((entry) => columns.map(([key]) => {
      const value = key === "appliedAt" && entry[key] ? new Date(entry[key]).toLocaleDateString("fr-FR") : entry[key];
      return escape(value);
    }).join(";"));
    // BOM pour qu'Excel lise correctement les accents
    const csv = "﻿" + [columns.map(([, label]) => escape(label)).join(";"), ...rows].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `candidatures-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status-msg status-${type}`;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => statusDiv.classList.add("hidden"), 4000);
  }
});
