// Injection de l'interface flottante dans la page
const injectedHTML = `
<div id="job-saver-wrapper" class="jsaver-closed">
  <button id="jsaver-toggle-btn" title="Ouvrir Job Saver">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
  </button>
  
  <div id="jsaver-panel">
    <div class="jsaver-header">
      <h3>Job Saver</h3>
      <button id="jsaver-close-btn">&times;</button>
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

  // Remplir automatiquement l'URL courante au 1er clic si vide
  inUrl.value = window.location.href;

  toggleBtn.addEventListener("click", () => {
    wrapper.classList.remove("jsaver-closed");
    wrapper.classList.add("jsaver-open");
  });

  closeBtn.addEventListener("click", () => {
    wrapper.classList.remove("jsaver-open");
    wrapper.classList.add("jsaver-closed");
    statusDiv.textContent = "";
    statusDiv.className = "";
  });

  sendBtn.addEventListener("click", () => {
    chrome.storage.local.get("webhookUrl", (data) => {
      const webhookUrl = data.webhookUrl;
      if (!webhookUrl) {
        showStatus("⚠️ Configurez l'URL Webhook via l'icône de l'extension !", "error");
        return;
      }

      const payload = {
        company: inCompany.value.trim(),
        jobTitle: inTitle.value.trim(),
        location: inLocation.value.trim(),
        jobType: inType.value,
        source: inSource.value.trim(),
        url: inUrl.value.trim()
      };

      if (!payload.company && !payload.jobTitle && !payload.url) {
        showStatus("Aucune donnée à envoyer.", "error");
        return;
      }

      sendBtn.disabled = true;
      sendBtn.textContent = "Recherche...";
      statusDiv.textContent = "";

      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(result => {
        if (result.status === "success") {
          showStatus("✅ Sauvegardé avec succès !", "success");
          inCompany.value = "";
          inTitle.value = "";
          inLocation.value = "";
          inSource.value = "";
          setTimeout(() => closeBtn.click(), 2000);
        } else {
          showStatus("❌ Erreur Scripts : " + result.message, "error");
        }
      })
      .catch(err => {
        showStatus("❌ Erreur. Vérifiez l'URL de l'App Script.", "error");
      })
      .finally(() => {
        sendBtn.disabled = false;
        sendBtn.textContent = "Sauvegarder";
      });
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
