// Injection de l'interface flottante dans la page
const injectedHTML = `
<div id="job-saver-wrapper" class="jsaver-closed">
  <button id="jsaver-toggle-btn" title="Ouvrir Job Saver">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
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
      <div class="jsaver-group">
        <label>Source</label>
        <input type="text" id="jsaver-source" placeholder="Ex: LinkedIn, Welcome...">
      </div>
      <div class="jsaver-group">
        <label>Lien de l'offre</label>
        <input type="text" id="jsaver-url" placeholder="https://...">
      </div>
      <button id="jsaver-send-btn">Sauvegarder</button>
      <div id="jsaver-status"></div>
    </div>
  </div>
</div>
`;

// Initialisation au chargement
function initJobSaver() {
  if (document.getElementById("job-saver-wrapper")) return;

  const container = document.createElement("div");
  container.innerHTML = injectedHTML;
  document.body.appendChild(container.firstElementChild);

  const wrapper = document.getElementById("job-saver-wrapper");
  const toggleBtn = document.getElementById("jsaver-toggle-btn");
  const closeBtn = document.getElementById("jsaver-close-btn");
  const sendBtn = document.getElementById("jsaver-send-btn");
  
  const inCompany = document.getElementById("jsaver-company");
  const inTitle = document.getElementById("jsaver-title");
  const inLocation = document.getElementById("jsaver-location");
  const inType = document.getElementById("jsaver-type");
  const inSource = document.getElementById("jsaver-source");
  const inUrl = document.getElementById("jsaver-url");
  const statusDiv = document.getElementById("jsaver-status");

  const detectBtn = document.getElementById("jsaver-detect-btn");
  const autoFields = { company: inCompany, title: inTitle, location: inLocation, source: inSource, url: inUrl };

  // Dernières valeurs détectées : un champ qui les contient encore n'a pas été
  // modifié à la main et peut être mis à jour quand on change d'offre.
  let autoValues = {};
  let typeTouched = false;
  inType.addEventListener("change", () => { typeTouched = true; });

  function autofill(force) {
    const data = JobSaverExtract.extract();
    for (const [key, input] of Object.entries(autoFields)) {
      const value = data[key];
      if (!value) continue;
      if (force || !input.value || input.value === autoValues[key]) input.value = value;
      autoValues[key] = value;
    }
    if (data.jobType && (force || !typeTouched)) {
      inType.value = data.jobType;
      typeTouched = false;
    }
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

  toggleBtn.addEventListener("click", () => {
    autofill(false);
    wrapper.classList.remove("jsaver-closed");
    wrapper.classList.add("jsaver-open");
  });

  detectBtn.addEventListener("click", () => autofill(true));

  closeBtn.addEventListener("click", () => {
    wrapper.classList.remove("jsaver-open");
    wrapper.classList.add("jsaver-closed");
    statusDiv.textContent = "";
    statusDiv.className = "";
  });

  function resetForm() {
    inCompany.value = "";
    inTitle.value = "";
    inLocation.value = "";
    inSource.value = "";
    inType.selectedIndex = 0;
    autoValues = {};
    typeTouched = false;
  }

  sendBtn.addEventListener("click", () => {
    const payload = {
      company: inCompany.value.trim(),
      jobTitle: inTitle.value.trim(),
      location: inLocation.value.trim(),
      jobType: inType.value,
      source: inSource.value.trim(),
      url: inUrl.value.trim(),
      appliedAt: new Date().toISOString()
    };

    if (!payload.company && !payload.jobTitle && !payload.url) {
      showStatus("Aucune donnée à envoyer.", "error");
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = "Envoi...";
    statusDiv.textContent = "";

    chrome.runtime.sendMessage({ action: "saveJob", payload }, (result) => {
      sendBtn.disabled = false;
      sendBtn.textContent = "Sauvegarder";

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
      if (request.field === "company") inCompany.value = request.value;
      if (request.field === "title") inTitle.value = request.value;
      if (request.field === "location") inLocation.value = request.value;
      if (request.field === "source") inSource.value = request.value;
      if (request.field === "url") inUrl.value = request.value;
      
      wrapper.classList.remove("jsaver-closed");
      wrapper.classList.add("jsaver-open");
      
      let targetId = "";
      if (request.field === "company") targetId = "jsaver-company";
      else if (request.field === "title") targetId = "jsaver-title";
      else if (request.field === "location") targetId = "jsaver-location";
      else if (request.field === "source") targetId = "jsaver-source";
      else targetId = "jsaver-url";

      const targetInput = document.getElementById(targetId);
      if(targetInput) {
        targetInput.style.backgroundColor = "#e0f2fe";
        setTimeout(() => targetInput.style.backgroundColor = "", 800);
      }
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
