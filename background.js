const QUEUE_KEY = "pendingQueue";
const RETRY_ALARM = "retryQueue";
const CACHE_ALARM = "refreshCache";

function setupMenusAndAlarms() {
  chrome.contextMenus.removeAll(() => {
    // "link" est nécessaire sur le parent, sinon le menu n'apparaît pas au clic droit sur un lien
    chrome.contextMenus.create({ id: "jobSaverMenu", title: "Job Saver", contexts: ["selection", "page", "link"] });
    chrome.contextMenus.create({ id: "saveCompany", parentId: "jobSaverMenu", title: "Copier vers : Entreprise", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "saveJobTitle", parentId: "jobSaverMenu", title: "Copier vers : Titre de l'offre", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "saveLocation", parentId: "jobSaverMenu", title: "Copier vers : Lieu", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "saveSource", parentId: "jobSaverMenu", title: "Copier vers : Source", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "saveUrl", parentId: "jobSaverMenu", title: "Copier vers : Lien de l'offre", contexts: ["page", "selection", "link"] });
  });
  createAlarms();
}

function createAlarms() {
  chrome.alarms.create(RETRY_ALARM, { periodInMinutes: 5 });
  chrome.alarms.create(CACHE_ALARM, { periodInMinutes: 60 });
  refreshSavedCache();
}

chrome.runtime.onInstalled.addListener(setupMenusAndAlarms);
// Les alarmes peuvent être effacées au redémarrage du navigateur
chrome.runtime.onStartup.addListener(createAlarms);

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

// --- Envoi vers le webhook (depuis le service worker : pas de contrainte CORS/CSP de la page) ---

class ConfigError extends Error {}

async function getConfig() {
  const { webhookUrl, secretToken } = await chrome.storage.local.get(["webhookUrl", "secretToken"]);
  if (!webhookUrl) throw new ConfigError("Webhook non configuré");
  return { webhookUrl, token: secretToken || "" };
}

async function postToWebhook(payload) {
  const { webhookUrl, token } = await getConfig();
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, token })
  });
  return res.json();
}

async function getFromWebhook(action) {
  const { webhookUrl, token } = await getConfig();
  const url = new URL(webhookUrl);
  url.searchParams.set("action", action);
  url.searchParams.set("token", token);
  const res = await fetch(url);
  return res.json();
}

// --- Cache local des candidatures, pour afficher "Déjà postulé" sans requête ---

// Clé entreprise + titre, identique à celle de content.js et d'Apps Script
function jobKey(company, title) {
  const c = String(company || "").trim().toLowerCase();
  const t = String(title || "").trim().toLowerCase();
  return c && t ? `${c}|${t}` : "";
}

function urlKey(url) {
  return String(url || "").trim().replace(/\/+$/, "").toLowerCase();
}

function addToCache(cache, { url, company, title, date }) {
  const u = urlKey(url);
  const k = jobKey(company, title);
  if (u) cache.byUrl[u] = date;
  if (k) cache.byKey[k] = date;
}

async function refreshSavedCache() {
  try {
    const result = await getFromWebhook("list");
    if (result.status !== "success") return result;
    const cache = { byUrl: {}, byKey: {} };
    for (const item of result.items || []) addToCache(cache, item);
    await chrome.storage.local.set({ savedJobs: cache });
    return { status: "success", count: (result.items || []).length };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

async function cacheLocally(payload) {
  const { savedJobs } = await chrome.storage.local.get("savedJobs");
  const cache = savedJobs || { byUrl: {}, byKey: {} };
  addToCache(cache, {
    url: payload.url,
    company: payload.company,
    title: payload.jobTitle,
    date: new Date(payload.appliedAt || Date.now()).toLocaleDateString("fr-FR"),
  });
  await chrome.storage.local.set({ savedJobs: cache });
}

async function getQueue() {
  const data = await chrome.storage.local.get(QUEUE_KEY);
  return data[QUEUE_KEY] || [];
}

async function enqueue(payload) {
  const queue = await getQueue();
  queue.push(payload);
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

async function saveJob(payload) {
  try {
    const result = await postToWebhook(payload);
    if (result.status === "success") {
      await cacheLocally(payload);
      await addToHistory(payload);
      return { status: "success" };
    }
    if (result.status === "duplicate") return { status: "duplicate", date: result.date };
    return { status: "error", message: result.message || "Réponse inattendue du script" };
  } catch (err) {
    if (err instanceof ConfigError) return { status: "noConfig" };
    // Erreur réseau : on garde la candidature pour la renvoyer plus tard
    await enqueue(payload);
    await cacheLocally(payload);
    await addToHistory(payload);
    return { status: "queued" };
  }
}

// Historique local (export CSV depuis la popup), limité aux 500 dernières candidatures
const HISTORY_KEY = "history";
const HISTORY_MAX = 500;

async function addToHistory(payload) {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  const { token, force, ...entry } = payload;
  const history = [entry, ...(data[HISTORY_KEY] || [])].slice(0, HISTORY_MAX);
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

async function ping() {
  try {
    const result = await getFromWebhook("ping");
    return result.status === "success" ? result : { status: "error", message: result.message };
  } catch (err) {
    if (err instanceof ConfigError) return { status: "noConfig" };
    // Ancienne version de Code.gs (sans doGet) : la réponse n'est pas du JSON
    return { status: "error", message: "Réponse invalide : vérifiez l'URL et redéployez le dernier Code.gs." };
  }
}

async function flushQueue() {
  const queue = await getQueue();
  if (!queue.length) return { sent: 0, remaining: 0 };

  const remaining = [];
  let sent = 0;
  for (const payload of queue) {
    try {
      const result = await postToWebhook(payload);
      // Un doublon est déjà dans le tableau : inutile de le renvoyer
      if (result.status === "success" || result.status === "duplicate") sent++;
      else remaining.push(payload);
    } catch (err) {
      remaining.push(payload);
    }
  }
  await chrome.storage.local.set({ [QUEUE_KEY]: remaining });
  return { sent, remaining: remaining.length };
}

// Dernière offre consultée dans l'onglet, ou dans l'onglet qui l'a ouvert
// (le bouton "Postuler" ouvre souvent le site du recruteur dans un nouvel onglet)
async function getLastJob(tab) {
  const ids = [tab.id, tab.openerTabId].filter((id) => id !== undefined);
  const keys = ids.map((id) => `lastJob_${id}`);
  const data = await chrome.storage.session.get(keys);
  for (const key of keys) if (data[key]) return data[key];
  return null;
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`lastJob_${tabId}`);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RETRY_ALARM) flushQueue();
  if (alarm.name === CACHE_ALARM) refreshSavedCache();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveJob") {
    saveJob(request.payload).then(sendResponse);
    return true; // réponse asynchrone
  }
  if (request.action === "flushQueue") {
    flushQueue().then(sendResponse);
    return true;
  }
  if (request.action === "rememberJob" && sender.tab) {
    chrome.storage.session.set({ [`lastJob_${sender.tab.id}`]: request.job });
    return;
  }
  if (request.action === "getLastJob" && sender.tab) {
    getLastJob(sender.tab).then(sendResponse);
    return true;
  }
  if (request.action === "refreshCache") {
    refreshSavedCache().then(sendResponse);
    return true;
  }
  if (request.action === "ping") {
    ping().then(sendResponse);
    return true;
  }
});

// Raccourci clavier (Alt+Shift+J par défaut)
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "toggle-panel" || !tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { action: "togglePanel" }).catch(() => {});
});
