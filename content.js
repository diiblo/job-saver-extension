// Injection de l'interface flottante dans la page
const injectedHTML = `
<div id="job-saver-wrapper" class="jsaver-closed">
  <button id="jsaver-toggle-btn" title="Ouvrir Job Saver">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
    <span id="jsaver-applied-dot" title="Déjà postulé"></span>
  </button>

  <div id="jsaver-panel">
    <div class="jsaver-header">
      <h3>Job Saver</h3>
      <div class="jsaver-header-actions">
        <button id="jsaver-detect-btn" title="Re-détecter les infos de la page">&#x21bb;</button>
        <button id="jsaver-close-btn">&times;</button>
      </div>
    </div>
    <div class="jsaver-body">
      <div id="jsaver-already"></div>
      <div class="jsaver-group">
        <label>Entreprise</label>
        <input type="text" id="jsaver-company" placeholder="Nom de la boîte">
      </div>
      <div class="jsaver-group">
        <label>Titre de l'offre</label>
        <input type="text" id="jsaver-title" placeholder="Intitulé du poste">
      </div>
      <div class="jsaver-group row-flex">
        <div class="jsaver-half">
          <label>Lieu</label>
          <input type="text" id="jsaver-location" placeholder="Ex: Paris">
        </div>
        <div class="jsaver-half">
          <label>Type de poste</label>
          <select id="jsaver-type">
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="Alternance">Alternance</option>
            <option value="Stage">Stage</option>
            <option value="Autres">Autres</option>
          </select>
        </div>
      </div>
      <div class="jsaver-group row-flex">
        <div class="jsaver-half">
          <label>Source</label>
          <input type="text" id="jsaver-source" placeholder="Ex: LinkedIn">
        </div>
        <div class="jsaver-half">
          <label>Candidature</label>
          <select id="jsaver-kind">
            <option value="Offre">Offre</option>
            <option value="Candidature spontanée">Spontanée</option>
          </select>
        </div>
      </div>
      <div class="jsaver-group">
        <label>Lien de l'offre</label>
        <input type="text" id="jsaver-url" placeholder="https://...">
      </div>
      <div class="jsaver-group">
        <label>Notes</label>
        <textarea id="jsaver-notes" rows="2" placeholder="Contact, salaire, remarques..."></textarea>
      </div>
      <button id="jsaver-send-btn">Sauvegarder</button>
      <div id="jsaver-status"></div>
    </div>
  </div>
</div>
`;

// Clé entreprise + titre, identique à celle du service worker et d'Apps Script
function jobKey(company, title) {
  const c = (company || "").trim().toLowerCase();
  const t = (title || "").trim().toLowerCase();
  return c && t ? `${c}|${t}` : "";
}

function urlKey(url) {
  return (url || "").trim().replace(/\/+$/, "").toLowerCase();
}

// Initialisation au chargement
function initJobSaver() {
  if (document.getElementById("job-saver-wrapper")) return;

  const container = document.createElement("div");
  container.innerHTML = injectedHTML;
  document.body.appendChild(container.firstElementChild);

  const root = document;
  const $ = (id) => root.getElementById(id);

  const wrapper = $("job-saver-wrapper");
  const toggleBtn = $("jsaver-toggle-btn");
  const closeBtn = $("jsaver-close-btn");
  const detectBtn = $("jsaver-detect-btn");
  const sendBtn = $("jsaver-send-btn");
  const statusDiv = $("jsaver-status");
  const alreadyDiv = $("jsaver-already");

  const inputs = {
    company: $("jsaver-company"),
    title: $("jsaver-title"),
    location: $("jsaver-location"),
    jobType: $("jsaver-type"),
    source: $("jsaver-source"),
    applicationKind: $("jsaver-kind"),
    url: $("jsaver-url"),
    notes: $("jsaver-notes"),
  };
  const autoKeys = ["company", "title", "location", "jobType", "source", "applicationKind", "url"];

  // Dernières valeurs détectées : un champ qui les contient encore n'a pas été
  // modifié à la main et peut être mis à jour quand on change d'offre.
  let autoValues = {};
  let forceNext = false;

  function autofill(force) {
    const data = JobSaverExtract.extract();
    for (const key of autoKeys) {
      const value = data[key];
      if (!value) continue;
      const input = inputs[key];
      const untouched = !input.value || input.value === autoValues[key] || input.tagName === "SELECT" && !autoValues[key];
      if (force || untouched) input.value = value;
      autoValues[key] = value;
    }
    forceNext = false;
    sendBtn.textContent = "Sauvegarder";
    checkAlreadyApplied();
  }

  // Affiche "Déjà postulé" si l'offre est dans le cache des candidatures
  function checkAlreadyApplied() {
    chrome.storage.local.get("savedJobs", ({ savedJobs }) => {
      const cache = savedJobs || { byUrl: {}, byKey: {} };
      const date = cache.byUrl[urlKey(inputs.url.value)]
        || cache.byKey[jobKey(inputs.company.value, inputs.title.value)];
      alreadyDiv.textContent = date ? `✔ Déjà postulé le ${date}` : "";
      alreadyDiv.classList.toggle("visible", !!date);
      wrapper.classList.toggle("jsaver-applied", !!date);
    });
  }

  // Les sites comme LinkedIn, Indeed ou La Bonne Alternance changent d'offre
  // sans recharger la page : on suit les changements d'URL et on re-détecte
  // une fois le contenu de la nouvelle offre affiché.
  let lastHref = window.location.href;
  autofill(false);

  setInterval(() => {
    if (window.location.href === lastHref) return;
    lastHref = window.location.href;
    setTimeout(() => autofill(false), 1500);
  }, 1000);

  for (const key of ["company", "title", "url"]) {
    inputs[key].addEventListener("change", checkAlreadyApplied);
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.savedJobs) checkAlreadyApplied();
  });

  function openPanel() {
    wrapper.classList.remove("jsaver-closed");
    wrapper.classList.add("jsaver-open");
  }

  toggleBtn.addEventListener("click", () => {
    autofill(false);
    openPanel();
  });

  detectBtn.addEventListener("click", () => autofill(true));

  closeBtn.addEventListener("click", () => {
    wrapper.classList.remove("jsaver-open");
    wrapper.classList.add("jsaver-closed");
    statusDiv.textContent = "";
    statusDiv.className = "";
  });

  function resetForm() {
    for (const key of ["company", "title", "location", "source", "notes"]) inputs[key].value = "";
    inputs.jobType.selectedIndex = 0;
    inputs.applicationKind.selectedIndex = 0;
    autoValues = {};
    forceNext = false;
  }

  function collectPayload() {
    return {
      company: inputs.company.value.trim(),
      jobTitle: inputs.title.value.trim(),
      location: inputs.location.value.trim(),
      jobType: inputs.jobType.value,
      source: inputs.source.value.trim(),
      applicationKind: inputs.applicationKind.value,
      url: inputs.url.value.trim(),
      notes: inputs.notes.value.trim(),
      appliedAt: new Date().toISOString(),
    };
  }

  sendBtn.addEventListener("click", () => {
    const payload = collectPayload();

    if (!payload.company && !payload.jobTitle && !payload.url) {
      showStatus("Aucune donnée à envoyer.", "error");
      return;
    }
    if (forceNext) payload.force = true;

    sendBtn.disabled = true;
    sendBtn.textContent = "Envoi...";
    statusDiv.textContent = "";

    chrome.runtime.sendMessage({ action: "saveJob", payload }, (result) => {
      sendBtn.disabled = false;
      sendBtn.textContent = "Sauvegarder";
      forceNext = false;

      if (chrome.runtime.lastError || !result) {
        showStatus("❌ Extension indisponible, rechargez la page.", "error");
        return;
      }
      if (result.status === "success") {
        showStatus("✅ Sauvegardé avec succès !", "success");
        resetForm();
        setTimeout(() => closeBtn.click(), 2000);
      } else if (result.status === "queued") {
        showStatus("📥 Pas de connexion : candidature gardée, renvoi automatique.", "success");
        resetForm();
      } else if (result.status === "duplicate") {
        showStatus(`⚠️ Déjà enregistrée le ${result.date}.`, "error");
        forceNext = true;
        sendBtn.textContent = "Ajouter quand même";
      } else if (result.status === "noConfig") {
        showStatus("⚠️ Configurez l'URL Webhook via l'icône de l'extension !", "error");
      } else {
        showStatus("❌ Erreur Scripts : " + result.message, "error");
      }
    });
  });

  function showStatus(msg, type) {
    statusDiv.textContent = msg;
    statusDiv.className = type;
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateField") {
      const input = inputs[request.field];
      if (input) {
        input.value = request.value;
        input.style.backgroundColor = "#e0f2fe";
        setTimeout(() => input.style.backgroundColor = "", 800);
      }
      openPanel();
      checkAlreadyApplied();
      sendResponse({ received: true });
    }
  });
}

// On attend que la page soit prête
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initJobSaver);
} else {
  initJobSaver();
}
