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
        <input type="text" autocomplete="off" id="jsaver-company" placeholder="Nom de la boîte">
      </div>
      <div class="jsaver-group">
        <label>Titre de l'offre</label>
        <input type="text" autocomplete="off" id="jsaver-title" placeholder="Intitulé du poste">
      </div>
      <div class="jsaver-group row-flex">
        <div class="jsaver-half">
          <label>Lieu</label>
          <input type="text" autocomplete="off" id="jsaver-location" placeholder="Ex: Paris">
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
          <input type="text" autocomplete="off" id="jsaver-source" placeholder="Ex: LinkedIn">
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
        <input type="text" autocomplete="off" id="jsaver-url" placeholder="https://...">
      </div>
      <div class="jsaver-group">
        <label>Notes</label>
        <textarea autocomplete="off" id="jsaver-notes" rows="2" placeholder="Contact, salaire, remarques..."></textarea>
      </div>
      <button id="jsaver-send-btn">Sauvegarder</button>
      <div id="jsaver-status"></div>
    </div>
  </div>

  <div id="jsaver-toast">
    <div id="jsaver-toast-msg"></div>
    <div class="jsaver-toast-actions">
      <button id="jsaver-toast-save">Enregistrer</button>
      <button id="jsaver-toast-edit">Vérifier</button>
      <button id="jsaver-toast-close" title="Ignorer">&times;</button>
    </div>
  </div>
</div>
`;

// Messages affichés par les sites une fois la candidature envoyée
const CONFIRM_PATTERNS = [
  /votre candidature (a|à) (bien )?été (envoyée|transmise|reçue|enregistrée|prise en compte)/i,
  /candidature (a|à) (bien )?été (envoyée|transmise)/i,
  /merci (pour|de) votre candidature/i,
  /your application (has been|was) (sent|submitted|received)/i,
  /thanks? (you )?for (your application|applying)/i,
  /^application (sent|submitted)( successfully)?[.!]?$/i,
];

// Boutons "Postuler" : redirection vers le site du recruteur
const APPLY_LABEL = /^(postuler|candidater|je postule|apply|apply now|postuler maintenant|postuler sur le site|envoyer (ma|la) candidature|submit application)\b/i;
// Formulaires intégrés au site : on attend plutôt le message de confirmation
const INLINE_APPLY = /candidature simplifiée|easy apply/i;
const INLINE_APPLY_SELECTOR = '[data-testid="postuler-button"]';

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
  if (document.getElementById("job-saver-host")) return;

  // Shadow DOM : le style du site ne peut pas casser le panneau, et inversement
  const host = document.createElement("div");
  host.id = "job-saver-host";
  host.style.display = "none";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = chrome.runtime.getURL("content.css");
  style.addEventListener("load", () => { host.style.display = ""; });
  root.appendChild(style);
  const container = document.createElement("div");
  container.innerHTML = injectedHTML;
  root.appendChild(container.firstElementChild);
  document.body.appendChild(host);

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

  // Bouton flottant : uniquement sur les pages d'offres, sauf option "toujours afficher".
  // Le panneau reste accessible partout via le raccourci, le clic droit ou l'icône.
  let alwaysShowButton = false;
  chrome.storage.local.get("alwaysShowButton", (data) => {
    alwaysShowButton = !!data.alwaysShowButton;
    updateButtonVisibility();
  });

  function updateButtonVisibility() {
    const visible = alwaysShowButton || JobSaverExtract.isJobPage();
    wrapper.classList.toggle("jsaver-button-hidden", !visible);
  }

  function autofill(force) {
    updateButtonVisibility();
    const data = JobSaverExtract.extract();
    for (const key of autoKeys) {
      const value = data[key];
      const input = inputs[key];
      if (!value) {
        // Rien de détecté sur la nouvelle offre : on vide la valeur de l'offre précédente
        // (sauf si elle a été saisie à la main)
        if (input.tagName !== "SELECT" && autoValues[key] && input.value === autoValues[key]) input.value = "";
        delete autoValues[key];
        continue;
      }
      const untouched = !input.value || input.value === autoValues[key] || input.tagName === "SELECT" && !autoValues[key];
      if (force || untouched) input.value = value;
      autoValues[key] = value;
    }
    forceNext = false;
    sendBtn.textContent = "Sauvegarder";
    checkAlreadyApplied();
    if (data.company && data.title) rememberJob();
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

  // --- Détection automatique des candidatures ---

  const toast = $("jsaver-toast");
  const toastMsg = $("jsaver-toast-msg");
  let promptedFor = "";
  let detectEnabled = true;
  chrome.storage.local.get("detectApplications", (data) => {
    detectEnabled = data.detectApplications !== false;
  });

  function hideToast() {
    toast.classList.remove("visible");
  }

  $("jsaver-toast-close").addEventListener("click", hideToast);
  $("jsaver-toast-edit").addEventListener("click", () => {
    hideToast();
    openPanel();
  });
  $("jsaver-toast-save").addEventListener("click", () => {
    hideToast();
    openPanel();
    sendBtn.click();
  });

  // Mémorise l'offre consultée dans cet onglet : la page de confirmation du
  // recruteur (souvent sur un autre site) ne contient pas toujours ses infos.
  function rememberJob() {
    const payload = collectPayload();
    if (!payload.company && !payload.jobTitle) return;
    chrome.runtime.sendMessage({ action: "rememberJob", job: payload });
  }

  function isAlreadySaved() {
    return new Promise((resolve) => {
      chrome.storage.local.get("savedJobs", ({ savedJobs }) => {
        const cache = savedJobs || { byUrl: {}, byKey: {} };
        resolve(!!(cache.byUrl[urlKey(inputs.url.value)]
          || cache.byKey[jobKey(inputs.company.value, inputs.title.value)]));
      });
    });
  }

  async function promptSave(message, useLastJob) {
    if (!detectEnabled || wrapper.classList.contains("jsaver-open")) return;
    autofill(false);

    if (useLastJob) {
      const last = await chrome.runtime.sendMessage({ action: "getLastJob" }).catch(() => null);
      // Page de confirmation d'un autre site (ou sans infos) : l'offre d'origine
      // est plus fiable, y compris son lien et sa source.
      if (last && (!inputs.company.value || last.source !== inputs.source.value)) {
        inputs.company.value = last.company || "";
        inputs.title.value = last.jobTitle || "";
        inputs.location.value = last.location || "";
        inputs.url.value = last.url || inputs.url.value;
        inputs.source.value = last.source || inputs.source.value;
        inputs.jobType.value = last.jobType || inputs.jobType.value;
        inputs.applicationKind.value = last.applicationKind || inputs.applicationKind.value;
      }
    }

    const key = urlKey(inputs.url.value) || jobKey(inputs.company.value, inputs.title.value);
    if (!key || promptedFor === key || await isAlreadySaved()) return;
    promptedFor = key;

    const label = [inputs.title.value, inputs.company.value].filter(Boolean).join(" – ");
    toastMsg.textContent = label ? `${message}\n${label}` : message;
    toast.classList.add("visible");
  }

  function matchesConfirmation(text) {
    return text.split("\n").some((line) => {
      const trimmed = line.trim();
      return CONFIRM_PATTERNS.some((pattern) => pattern.test(trimmed));
    });
  }

  // Les confirmations apparaissent souvent dans une fenêtre ajoutée dynamiquement
  let pendingNodes = [];
  let scanTimer = null;
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && !wrapper.contains(node)) pendingNodes.push(node);
      }
    }
    if (!pendingNodes.length || scanTimer) return;
    scanTimer = setTimeout(() => {
      const nodes = pendingNodes;
      pendingNodes = [];
      scanTimer = null;
      for (const node of nodes) {
        const text = (node.innerText || "").trim();
        if (text && text.length < 5000 && matchesConfirmation(text)) {
          promptSave("🎉 Candidature envoyée détectée !", true);
          return;
        }
      }
    }, 800);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Page de confirmation chargée directement (sites carrière, ATS)
  setTimeout(() => {
    if (matchesConfirmation((document.body.innerText || "").slice(0, 30000))) {
      promptSave("🎉 Candidature envoyée détectée !", true);
    }
  }, 1500);

  // Clic sur "Postuler" : on mémorise l'offre et on propose de l'enregistrer
  document.addEventListener("click", (event) => {
    const el = event.target.closest && event.target.closest("button, a, [role='button']");
    if (!el || wrapper.contains(el)) return;
    const label = (el.innerText || el.getAttribute("aria-label") || "").trim();
    const inline = INLINE_APPLY.test(label) || el.matches(INLINE_APPLY_SELECTOR);
    if (!inline && !APPLY_LABEL.test(label)) return;

    autofill(false);
    rememberJob();
    if (!inline) setTimeout(() => promptSave("Vous postulez à cette offre ?", false), 1500);
  }, true);

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
    if (request.action === "togglePanel") {
      if (wrapper.classList.contains("jsaver-open")) closeBtn.click();
      else toggleBtn.click();
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
