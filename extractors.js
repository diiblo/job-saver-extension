// Extraction automatique des informations d'une offre depuis la page courante.
// Exposé sous window.JobSaverExtract et utilisé par content.js.
(function () {
  // Nom de domaine -> nom de la source affiché dans le tableau
  const SOURCES = [
    [/(^|\.)linkedin\./, "LinkedIn"],
    [/(^|\.)indeed\./, "Indeed"],
    [/welcometothejungle\.|welcomekit\.co/, "Welcome to the Jungle"],
    [/labonnealternance\./, "La Bonne Alternance"],
    [/francetravail\.fr|pole-emploi\.fr/, "France Travail"],
    [/hellowork\.com/, "HelloWork"],
    [/(^|\.)apec\.fr/, "APEC"],
    [/jobteaser\./, "JobTeaser"],
    [/glassdoor\./, "Glassdoor"],
    [/monster\./, "Monster"],
    [/cadremploi\./, "Cadremploi"],
    [/meteojob\./, "Meteojob"],
    [/jobijoba\./, "Jobijoba"],
    [/studentjob\./, "StudentJob"],
    [/letudiant\.fr/, "L'Etudiant"],
    [/1jeune1solution\./, "1jeune1solution"],
    [/alternance\.emploi\.gouv\.fr/, "Portail de l'alternance"],
    [/choisirleservicepublic\./, "Choisir le service public"],
    [/optioncarriere\./, "Optioncarrière"],
    [/(^|\.)talent\.com/, "Talent.com"],
    [/free-work\./, "Free-Work"],
    [/malt\./, "Malt"],
    [/jobintree\./, "Jobintree"],
    [/keljob\./, "Keljob"],
    [/staffme\.|side\.co/, "Side"],
    [/myworkdayjobs\.com|workday\.com/, "Workday"],
    [/lever\.co/, "Lever"],
    [/greenhouse\.io/, "Greenhouse"],
    [/smartrecruiters\.com/, "SmartRecruiters"],
    [/teamtailor\.com/, "Teamtailor"],
    [/recruitee\.com/, "Recruitee"],
    [/taleo\.net/, "Taleo"],
    [/successfactors\./, "SuccessFactors"],
    [/flatchr\./, "Flatchr"],
    [/digitalrecruiters\./, "DigitalRecruiters"],
    [/jobaffinity\./, "JobAffinity"],
  ];

  // Paramètres de suivi retirés des liens (les identifiants d'offre sont conservés)
  const TRACKING_PARAMS = /^(utm_.*|fbclid|gclid|msclkid|trk|trkInfo|trackingId|refId|ref|referer|referrer|src|from|origin|lipi|eBP|tk|xpse|xfps|xkcb|advn|sjdu|_ga|mc_.*)$/i;

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function decodeEntities(text) {
    if (!text || !/&[#\w]+;/.test(text)) return text || "";
    const doc = new DOMParser().parseFromString(text, "text/html");
    return doc.documentElement.textContent;
  }

  function detectSource(hostname) {
    const host = hostname.replace(/^www\./, "");
    for (const [pattern, name] of SOURCES) {
      if (pattern.test(host)) return name;
    }
    // Source inconnue : nom de domaine principal, ex. "careers.acme.com" -> "Acme"
    const parts = host.split(".");
    const main = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    return main.charAt(0).toUpperCase() + main.slice(1);
  }

  function detectJobType(text) {
    const t = (text || "").toLowerCase();
    if (/altern|apprenti|contrat (de )?pro(fessionnalisation)?\b|work[- ]?study/.test(t)) return "Alternance";
    if (/\bstages?\b|stagiaire|internship|\bintern\b/.test(t)) return "Stage";
    if (/\bcdd\b|durée déterminée|temporary|intérim|interim/.test(t)) return "CDD";
    if (/\bcdi\b|durée indéterminée|permanent/.test(t)) return "CDI";
    return "";
  }

  function normalizeUrl(href) {
    let url;
    try { url = new URL(href); } catch (e) { return href; }
    const host = url.hostname;

    // LinkedIn : la liste de recherche contient l'offre affichée dans currentJobId
    if (/linkedin\./.test(host)) {
      const id = url.searchParams.get("currentJobId") || (url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/) || [])[1];
      if (id) return `https://www.linkedin.com/jobs/view/${id}/`;
    }
    // Indeed : l'offre affichée dans la liste est dans vjk, la page d'offre dans jk
    if (/indeed\./.test(host)) {
      const jk = url.searchParams.get("vjk") || url.searchParams.get("jk");
      if (jk) return `https://${host}/viewjob?jk=${jk}`;
    }

    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString();
  }

  // --- Données structurées schema.org JobPosting (utilisées par Google Jobs) ---

  function findJobPosting(node) {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findJobPosting(item);
        if (found) return found;
      }
      return null;
    }
    const type = node["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return node;
    return findJobPosting(node["@graph"]);
  }

  function formatLocation(jobLocation, locationType) {
    const places = Array.isArray(jobLocation) ? jobLocation : [jobLocation];
    const cities = [];
    for (const place of places) {
      if (!place) continue;
      const address = typeof place === "string" ? null : place.address;
      let city = typeof place === "string" ? place : "";
      if (address && typeof address === "object") {
        city = address.addressLocality || address.addressRegion || address.addressCountry || "";
      } else if (typeof address === "string") {
        city = address;
      }
      city = clean(decodeEntities(typeof city === "object" ? city.name : city));
      if (city && !cities.some(c => c.toLowerCase() === city.toLowerCase())) cities.push(city);
    }
    if (!cities.length && /TELECOMMUTE/i.test(locationType || "")) return "Télétravail";
    return cities.join(" / ");
  }

  function fromJsonLd() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      let json;
      try { json = JSON.parse(script.textContent); } catch (e) { continue; }
      const job = findJobPosting(json);
      if (!job) continue;

      const org = job.hiringOrganization;
      const employment = [].concat(job.employmentType || []).join(" ");
      return {
        title: clean(decodeEntities(job.title)),
        company: clean(decodeEntities(typeof org === "string" ? org : org && org.name)),
        location: formatLocation(job.jobLocation, job.jobLocationType),
        jobTypeHint: employment,
        description: clean(decodeEntities(job.description)).slice(0, 2000),
      };
    }
    return {};
  }

  // --- Repli : balises meta et titre de la page ---

  function meta(name) {
    const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    return el ? clean(el.content) : "";
  }

  function fromMeta() {
    const h1 = document.querySelector("h1");
    return {
      title: clean(h1 && h1.textContent) || meta("og:title") || clean(document.title),
    };
  }

  // --- Extracteurs propres à certains sites (prioritaires sur le reste) ---
  // Les classes CSS de ces sites changent régulièrement : chaque champ essaie
  // plusieurs sélecteurs, et les données JobPosting restent en repli.

  function text(...selectors) {
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const value = clean(el.innerText || el.textContent);
        if (value) return value;
      }
    }
    return "";
  }

  // "(3) Titre | Entreprise | LinkedIn" -> ["Titre", "Entreprise"]
  function splitTitle(separator) {
    return document.title.replace(/^\(\d+\)\s*/, "").split(separator).map(clean);
  }

  const siteExtractors = [
    {
      match: /(^|\.)linkedin\./,
      extract() {
        const [docTitle, docCompany] = splitTitle(" | ");
        const location = text(
          ".job-details-jobs-unified-top-card__primary-description-container .tvm__text",
          ".job-details-jobs-unified-top-card__bullet",
          ".jobs-unified-top-card__bullet",
          ".topcard__flavor--bullet"
        ).split("·")[0];
        return {
          title: text(
            ".job-details-jobs-unified-top-card__job-title",
            ".jobs-unified-top-card__job-title",
            ".top-card-layout__title"
          ) || docTitle,
          company: text(
            ".job-details-jobs-unified-top-card__company-name",
            ".jobs-unified-top-card__company-name",
            ".topcard__org-name-link"
          ) || (docCompany !== "LinkedIn" ? docCompany : ""),
          location: clean(location),
          jobTypeHint: text(
            ".job-details-fit-level-preferences",
            ".job-details-preferences-and-skills",
            ".job-details-jobs-unified-top-card__job-insight",
            ".description__job-criteria-list"
          ),
        };
      },
    },
    {
      match: /(^|\.)indeed\./,
      extract() {
        const title = text(
          '[data-testid="jobsearch-JobInfoHeader-title"]',
          ".jobsearch-JobInfoHeader-title"
        ).replace(/\s*-\s*(job post|offre d'emploi)$/i, "");
        return {
          title,
          company: text(
            '[data-testid="inlineHeader-companyName"]',
            '[data-company-name="true"]',
            ".jobsearch-CompanyInfoContainer a"
          ),
          location: text(
            '[data-testid="inlineHeader-companyLocation"]',
            '[data-testid="job-location"]',
            "#jobLocationText"
          ),
          jobTypeHint: text(
            "#salaryInfoAndJobType",
            '[data-testid="jobsearch-OtherJobDetailsContainer"]',
            "#jobDetailsSection"
          ),
        };
      },
    },
    {
      match: /labonnealternance\./,
      extract() {
        // Entreprise susceptible de recruter (candidature spontanée) :
        // "Candidature spontanée en <métier> chez <entreprise> - La bonne alternance"
        const spontaneous = document.title.match(/^Candidature spontanée en (.+) chez (.+?) - La bonne alternance/i);
        if (spontaneous || /\/recruteurs_lba\//.test(location.pathname)) {
          const desc = (meta("description") || "").match(/chez (.+?) à (.+?) \((.+?)\)/);
          const metier = spontaneous ? spontaneous[1] : desc && desc[3];
          return {
            title: metier ? `Candidature spontanée - ${metier}` : "Candidature spontanée",
            company: (spontaneous && spontaneous[2]) || (desc && desc[1]) || "",
            location: desc ? desc[2] : "",
            jobType: "Alternance",
            applicationKind: "Candidature spontanée",
          };
        }
        // Offre : les données JobPosting sont présentes, le titre de page sert de repli
        const offer = document.title.match(/^Offre d'emploi (.+) - La bonne alternance/i);
        return { title: offer ? offer[1] : "", jobType: "Alternance" };
      },
    },
    {
      match: /glassdoor\./,
      extract() {
        return {
          title: text('[data-test="job-title"]', '[class*="JobDetails_jobTitle"]'),
          company: text('[data-test="employer-name"]', '[class*="EmployerProfile_employerName"]'),
          location: text('[data-test="location"]', '[class*="JobDetails_location"]'),
        };
      },
    },
    {
      match: /welcometothejungle\./,
      extract() {
        return {
          title: text('[data-testid="job-section-title"] h2'),
          company: text('[data-testid="job-header-organization-title"]', 'a[href*="/companies/"] span'),
        };
      },
    },
  ];

  function fromSite() {
    for (const { match, extract } of siteExtractors) {
      if (!match.test(location.hostname)) continue;
      try { return extract() || {}; } catch (e) { return {}; }
    }
    return {};
  }

  function extract() {
    const site = fromSite();
    const ld = fromJsonLd();
    const fallback = fromMeta();
    const pick = (key) => site[key] || ld[key] || fallback[key] || "";

    const source = site.source || detectSource(location.hostname);
    const title = pick("title");

    // Type de poste : titre d'abord, puis type de contrat déclaré, puis description
    let jobType = site.jobType
      || detectJobType(title)
      || detectJobType(`${site.jobTypeHint || ""} ${ld.jobTypeHint || ""}`);
    if (!jobType && source === "La Bonne Alternance") jobType = "Alternance";
    if (!jobType) jobType = detectJobType((site.description || ld.description || "").slice(0, 600));

    return {
      company: pick("company"),
      title,
      location: pick("location"),
      jobType,
      source,
      url: normalizeUrl(site.url || location.href),
      applicationKind: site.applicationKind || "Offre",
    };
  }

  // Page d'offre : site d'emploi connu ou données JobPosting présentes
  function isJobPage() {
    const host = location.hostname.replace(/^www\./, "");
    return SOURCES.some(([pattern]) => pattern.test(host)) || !!fromJsonLd().title;
  }

  window.JobSaverExtract = {
    extract,
    isJobPage,
    detectSource,
    detectJobType,
    normalizeUrl,
    siteExtractors,
    helpers: { clean, decodeEntities, meta },
  };
})();
