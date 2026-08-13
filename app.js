const form = document.getElementById("search-form");
const findBtn = document.getElementById("find-btn");
const btnLabel = findBtn.querySelector(".btn-label");
const spinner = findBtn.querySelector(".spinner");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const matchesEl = document.getElementById("matches");
const resultsTitle = document.getElementById("results-title");
const resultsSub = document.getElementById("results-sub");
const modelInfo = document.getElementById("model-info");

const letterModal = document.getElementById("letter-modal");
const letterTarget = document.getElementById("letter-target");
const letterLoading = document.getElementById("letter-loading");
const letterOutput = document.getElementById("letter-output");
const letterActions = document.getElementById("letter-actions");

let currentProfile = null;
let currentLetter = "";

async function loadModelInfo() {
  try {
    const { model } = await apiFetch("/api/model");
    modelInfo.textContent = `AI model: ${model}`;
  } catch {
    modelInfo.hidden = true;
  }
}
loadModelInfo();

function setLoading(on, label) {
  findBtn.disabled = on;
  spinner.hidden = !on;
  btnLabel.textContent = label;
}

function showStatus(type, message) {
  statusEl.innerHTML = "";
  if (!message) return;
  const div = document.createElement("div");
  div.className = `alert alert-${type}`;
  div.textContent = message;
  statusEl.appendChild(div);
}

function clearStatus() {
  showStatus(null, "");
}

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* noop */
  }
  if (!res.ok) {
    throw new Error(data.error || `Something went wrong (HTTP ${res.status}).`);
  }
  return data;
}

function scoreClass(score) {
  if (score >= 75) return "score-high";
  if (score >= 50) return "score-mid";
  return "score-low";
}

function renderMatches(matches, meta) {
  matchesEl.innerHTML = "";
  resultsEl.hidden = false;

  resultsSub.textContent = meta
    ? `Scored ${meta.evaluated || matches.length} jobs by AI against your profile.`
    : "";

  matches.forEach((match, index) => {
    const m = match.job || {};
    const location = (m.location || []).join(", ") || (m.remote ? "Remote" : "Location not stated");

    const li = document.createElement("li");
    li.className = "match-card";

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `#${index + 1}`;

    const score = document.createElement("span");
    score.className = `score ${scoreClass(match.score)}`;
    score.textContent = `${match.score}`;
    score.title = `${match.score}/100 match`;

    const body = document.createElement("div");
    body.className = "match-body";

    const head = document.createElement("div");
    head.className = "match-head";
    const title = document.createElement("h3");
    title.textContent = m.title || "Unknown role";
    const company = document.createElement("span");
    company.className = "company";
    company.textContent = m.company_name || "";
    head.append(title, company);

    const metaRow = document.createElement("div");
    metaRow.className = "meta";
    const loc = document.createElement("span");
    loc.textContent = location;
    metaRow.appendChild(loc);
    if (m.remote) {
      const remote = document.createElement("span");
      remote.className = "badge badge-remote";
      remote.textContent = "Remote";
      metaRow.appendChild(remote);
    }

    const tags = document.createElement("div");
    tags.className = "tags";
    (m.tags || []).slice(0, 8).forEach((tag) => {
      const t = document.createElement("span");
      t.className = "tag";
      t.textContent = tag;
      tags.appendChild(t);
    });

    const why = document.createElement("p");
    why.className = "why";
    why.textContent = match.why || "";

    const prepare = document.createElement("p");
    prepare.className = "prepare";
    const strong = document.createElement("strong");
    strong.textContent = "Prepare: ";
    prepare.append(strong, document.createTextNode(match.prepare || ""));

    const link = document.createElement("a");
    link.className = "apply-link";
    link.href = m.url || "#";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "View original posting →";

    const letterBtn = document.createElement("button");
    letterBtn.type = "button";
    letterBtn.className = "letter-btn";
    letterBtn.textContent = "Bewerbung generieren";
    letterBtn.addEventListener("click", () => openLetterModal(m, match.prepare || ""));

    body.append(head, metaRow, tags, why, prepare, link, letterBtn);
    li.append(rank, score, body);
    matchesEl.appendChild(li);
  });
}

async function openLetterModal(job, prepareQuestion) {
  letterModal.hidden = false;
  document.body.style.overflow = "hidden";

  const jobName = [job.title, job.company_name].filter(Boolean).join(" @ ");
  letterTarget.textContent = jobName;
  letterOutput.hidden = true;
  letterActions.hidden = true;
  letterLoading.hidden = false;
  letterLoading.innerHTML = "";
  const spinnerEl = document.createElement("span");
  spinnerEl.className = "spinner";
  spinnerEl.style.borderColor = "rgba(79, 70, 229, 0.25)";
  spinnerEl.style.borderTopColor = "var(--brand)";
  spinnerEl.appendChild(document.createTextNode(""));
  letterLoading.append(spinnerEl, document.createTextNode("Dein Anschreiben wird geschrieben…"));

  currentLetter = "";
  try {
    const result = await apiFetch("/api/cover-letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...currentProfile, job, prepareQuestion, language: "German" }),
    });
    currentLetter = result.letter || "";
    letterLoading.hidden = true;
    letterOutput.hidden = false;
    letterActions.hidden = false;
    letterOutput.textContent = currentLetter;
  } catch (err) {
    letterLoading.hidden = true;
    letterOutput.hidden = false;
    letterOutput.textContent = `Fehler beim Generieren: ${err.message}`;
  }
}

function closeLetterModal() {
  letterModal.hidden = true;
  document.body.style.overflow = "";
}

document.getElementById("letter-close").addEventListener("click", closeLetterModal);
letterModal.addEventListener("click", (event) => {
  if (event.target === letterModal) closeLetterModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLetterModal();
});

document.getElementById("letter-copy").addEventListener("click", () => {
  if (!currentLetter) return;
  navigator.clipboard.writeText(currentLetter).then(
    () => {
      const btn = document.getElementById("letter-copy");
      btn.textContent = "Kopiert ✓";
      setTimeout(() => (btn.textContent = "Kopieren"), 1500);
    },
    () => {}
  );
});

document.getElementById("letter-download").addEventListener("click", () => {
  if (!currentLetter) return;
  const blob = new Blob([currentLetter], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `anschreiben-${letterTarget.textContent
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "bewerbung"}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

const alertForm = document.getElementById("alert-form");
const alertEmail = document.getElementById("alert-email");
const alertBtn = document.getElementById("alert-btn");
const alertStatus = document.getElementById("alert-status");
const alertUnsub = document.getElementById("alert-unsub");

function setAlertStatus(type, message) {
  alertStatus.textContent = message;
  alertStatus.className = `alert-status ${type}`;
}

alertForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = alertEmail.value.trim();
  const profile = {
    email,
    skills: form.elements.skills.value.trim(),
    targetRole: form.elements.targetRole.value.trim(),
    city: form.elements.city.value.trim(),
  };

  if (!email) {
    setAlertStatus("err", "Please enter your email address.");
    return;
  }

  alertBtn.disabled = true;
  alertBtn.textContent = "Saving…";
  try {
    const res = await apiFetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setAlertStatus("ok", res.message || "Subscribed!");
    alertUnsub.hidden = false;
  } catch (err) {
    setAlertStatus("err", err.message || "Couldn't subscribe. Please try again.");
  } finally {
    alertBtn.disabled = false;
    alertBtn.textContent = "Subscribe to daily digest";
  }
});

alertUnsub.addEventListener("click", async () => {
  const email = alertEmail.value.trim();
  if (!email) {
    setAlertStatus("err", "Enter your email to cancel the alert.");
    return;
  }
  alertUnsub.disabled = true;
  try {
    const res = await apiFetch("/api/alerts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setAlertStatus("ok", res.message || "Alert cancelled.");
    alertUnsub.hidden = true;
  } catch (err) {
    setAlertStatus("err", err.message || "Couldn't cancel. Please try again.");
  } finally {
    alertUnsub.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const skills = form.elements.skills.value.trim();
  const targetRole = form.elements.targetRole.value.trim();
  const city = form.elements.city.value.trim();
  currentProfile = { skills, targetRole, city };

  if (!skills && !targetRole) {
    showStatus("error", "Add at least a skill or a target role so we know what to look for.");
    return;
  }

  resultsEl.hidden = true;
  clearStatus();

  const params = new URLSearchParams();
  if (skills) params.set("skills", skills);
  if (targetRole) params.set("targetRole", targetRole);
  if (city) params.set("city", city);

  try {
    setLoading(true, "Searching the job board…");

    const board = await apiFetch(`/api/jobs?${params.toString()}`);

    if (!Array.isArray(board.jobs) || board.jobs.length === 0) {
      showStatus(
        "warn",
        city
          ? `No jobs matched "${skills || targetRole}" near "${city}". Try broader skills or leave the city empty.`
          : `No jobs matched "${skills || targetRole}". Try broader keywords or different skills.`
      );
      return;
    }
    setLoading(true, "Scoring your matches with AI…");

    const matchResult = await apiFetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills, targetRole, city, jobs: board.jobs }),
    });

    if (!Array.isArray(matchResult.matches) || matchResult.matches.length === 0) {
      showStatus(
        "warn",
        matchResult.meta?.note ||
          "We found jobs but the AI couldn't score them. Please try again."
      );
      return;
    }

    renderMatches(matchResult.matches, matchResult.meta);
    resultsTitle.textContent =
      matchResult.matches.length === 1 ? "Your top match" : `Your top ${matchResult.matches.length} matches`;
    showStatus("info", `Found ${board.meta?.totalFiltered ?? board.jobs.length} relevant jobs, scored your best ones.`);
  } catch (err) {
    showStatus("error", err.message || "Something went wrong. Please try again.");
  } finally {
    setLoading(false, "Find my matches");
  }
});