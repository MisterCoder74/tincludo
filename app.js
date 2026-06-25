const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  onlineOverride: null,
  selectedTermId: null,
  favorites: new Set(),
  dict: [],
  quiz: { idx: 0, answers: [], finished: false },
  plus: { isPlus: false }
};

function toast(message) {
  let el = $("#toastEl");
  if (!el) {
    el = document.createElement("div");
    el.id = "toastEl";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      transform: "translateX(-50%)",
      bottom: "20px",
      zIndex: 9999,
      background: "rgba(0,0,0,.75)",
      border: "1px solid rgba(255,255,255,.18)",
      color: "rgba(255,255,255,.95)",
      padding: "10px 14px",
      borderRadius: "14px",
      boxShadow: "0 18px 50px rgba(0,0,0,.35)",
      maxWidth: "calc(100vw - 30px)",
      textAlign: "center",
      opacity: "1",
      transition: "opacity .2s ease"
    });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = "1";
  if (toast._t) clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.opacity = "0"; }, 2400);
}

function setNetworkPill(on) {
  const pill = $("#netPill");
  if (!pill) return;
  pill.textContent = on ? "Online" : "Offline";
  pill.style.borderColor = on ? "rgba(53,208,127,.55)" : "rgba(255,204,102,.55)";
}

function isOnline() {
  if (state.onlineOverride === "offline") return false;
  return navigator.onLine;
}

function showView(viewName) {
  $$(".nav-item").forEach(btn => btn.classList.toggle("is-active", btn.dataset.view === viewName));
  $$(".view").forEach(v => v.classList.toggle("is-active", v.dataset.view === viewName));
  $("#main")?.querySelector(`[data-view="${viewName}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* -------------------- Utilities -------------------- */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadJSON(url, fallback = null) {
  try {
    const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (fallback !== null) return fallback;
    throw e;
  }
}

/* -------------------- Offline toggle in dashboard (Home only) -------------------- */
function initOfflineToggle() {
  const btn = $("#toggleOfflineBtn");
  if (!btn) return;

  const apply = () => {
    const on = isOnline();
    setNetworkPill(on);
    btn.textContent = state.onlineOverride === "offline"
      ? "Torna online ✅"
      : "Simula offline (toggle) ⛔↩️";
  };

  btn.addEventListener("click", () => {
    state.onlineOverride = (state.onlineOverride === "offline") ? null : "offline";
    apply();
    toast(state.onlineOverride === "offline" ? "Modalità offline simulata 📴" : "Torna online ✅");
    if ($(".view.is-active")?.dataset?.view === "news") $("#fetchNewsBtn")?.click();
  });

  apply();
}

/* -------------------- Favorites -------------------- */
function favoritesKey() { return "tiincludo_favorites"; }

function loadFavorites() {
  try {
    const raw = localStorage.getItem(favoritesKey());
    const arr = raw ? JSON.parse(raw) : [];
    state.favorites = new Set(Array.isArray(arr) ? arr : []);
  } catch { state.favorites = new Set(); }
}

function saveFavorites() {
  localStorage.setItem(favoritesKey(), JSON.stringify(Array.from(state.favorites)));
}

function initFavoritesUI() {
  const list = $("#favList");
  const empty = $("#favEmpty");
  const count = $("#favCount");
  const search = $("#favSearch");
  const clearBtn = $("#favClearBtn");

  const selTitle = $("#favSelectedTitle");
  const selDef = $("#favSelectedDef");
  const copyBtn = $("#favCopyBtn");
  const removeBtn = $("#favRemoveBtn");

  if (!list) return;

  let selectedId = null;

  const refresh = () => {
    const q = (search?.value || "").trim().toLowerCase();
    const items = state.dict
      .filter(d => state.favorites.has(d.id))
      .filter(d => {
        if (!q) return true;
        return (d.term || "").toLowerCase().includes(q) ||
          (d.definizione || "").toLowerCase().includes(q) ||
          (d.categoria || "").toLowerCase().includes(q);
      });

    list.innerHTML = "";
    if (count) count.textContent = `${items.length} preferiti`;

    if (items.length === 0) {
      if (empty) empty.hidden = false;
      if (selTitle) selTitle.textContent = "—";
      if (selDef) selDef.textContent = "—";
      selectedId = null;
      if (copyBtn) copyBtn.disabled = true;
      if (removeBtn) removeBtn.disabled = true;
      return;
    }
    if (empty) empty.hidden = true;

    items.forEach(item => {
      const li = document.createElement("li");
      li.className = "news-item";
      li.style.cursor = "pointer";
      li.innerHTML = `
        <p class="news-title">${escapeHtml(item.term)}</p>
        <p class="news-meta">${escapeHtml(item.categoria || "")}</p>
      `;

      li.addEventListener("click", () => {
        selectedId = item.id;
        if (selTitle) selTitle.textContent = item.term;
        if (selDef) selDef.textContent = item.definizione || "—";
        if (copyBtn) copyBtn.disabled = false;
        if (removeBtn) removeBtn.disabled = false;

        $$("#favList .news-item").forEach(n => n.style.borderColor = "rgba(255,255,255,.10)");
        li.style.borderColor = "rgba(47,155,255,.55)";
      });

      list.appendChild(li);
    });

    if (selectedId === null && items[0]) {
      selectedId = items[0].id;
      if (selTitle) selTitle.textContent = items[0].term;
      if (selDef) selDef.textContent = items[0].definizione || "—";
      if (copyBtn) copyBtn.disabled = false;
      if (removeBtn) removeBtn.disabled = false;
    }
  };

  if (search) search.addEventListener("input", refresh);
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      state.favorites = new Set();
      saveFavorites();
      toast("Preferiti svuotati ♻️");
      refresh();
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      if (!selectedId) return;
      const item = state.dict.find(d => d.id === selectedId);
      if (!item) return;
      const txt = `${item.term} — ${item.definizione}\nCategoria: ${item.categoria || ""}`;
      try { await navigator.clipboard.writeText(txt); toast("Copiato 📋"); }
      catch { toast("Copia manuale 📋"); }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      if (!selectedId) return;
      state.favorites.delete(selectedId);
      saveFavorites();
      toast("Preferito rimosso 🧹");
      selectedId = null;
      refresh();
      initDictionaryUI();
    });
  }

  refresh();
}

/* -------------------- Profilo e Plus -------------------- */
async function loadProfile() {
  try {
    const data = await loadJSON("/api/profile");
    state.plus.isPlus = data.premium || false;
    state.plus.score = data.score || 0;
    if ($("#userScore")) $("#userScore").textContent = state.plus.score;
  } catch (e) {
    console.error("Errore caricamento profilo", e);
  }
}

function checkPlus(featureName) {
  if (state.plus.isPlus) return true;
  toast(`La funzione "${featureName}" è riservata agli utenti Plus 🧡`);
  return false;
}

/* -------------------- Modale Edit Diario -------------------- */
function openEditVoice(id) {
  const entries = loadDiary();
  const item = entries.find(v => v.id === id);
  if (!item) return;

  const modal = document.createElement('div');
  modal.className = 'sheet';
  modal.innerHTML = `
    <div class="sheet-head"><h3>Edit Voce</h3><button id="closeEdit">✕</button></div>
    <div class="sheet-body">
      <label>Titolo</label>
      <input type="text" id="editTitle" value="${escapeHtml(item.title || '')}" style="width:100%; margin-bottom:10px;">
      <label>Testo</label>
      <textarea id="editBody" style="width:100%; height:120px;">${escapeHtml(item.text || '')}</textarea>
      <button id="saveEdit" class="btn" style="margin-top:10px;">Salva</button>
    </div>
  `;
  document.body.appendChild(modal);

  $("#closeEdit").addEventListener("click", () => modal.remove());
  $("#saveEdit").addEventListener("click", () => {
    item.title = $("#editTitle").value.trim();
    item.text = $("#editBody").value.trim();
    item.updatedAt = new Date().toISOString();
    saveDiary(entries);
    modal.remove();
    toast("Voce aggiornata ✅");
    initDiaryUI();
  });
}

/* -------------------- Dictionary -------------------- */
function initDictionaryUI() {
  const searchEl = $("#dictSearch");
  const categoryEl = $("#dictCategory");
  const resetBtn = $("#dictResetBtn");
  const resultsEl = $("#dictResults");
  const countEl = $("#dictCount");

  const emptyEl = $("#dictEmpty");
  const detailEl = $("#dictDetail");

  const titleEl = $("#dictTermTitle");
  const metaEl = $("#dictTermMeta");
  const defEl = $("#dictTermDef");
  const examplesEl = $("#dictExamples");
  const whenEl = $("#dictWhen");
  const synonymsEl = $("#dictSynonyms");

  const favoriteBtn = $("#favoriteBtn");
  const copyBtn = $("#copyBtn");

  if (!state.dict || state.dict.length === 0) {
    if (emptyEl) emptyEl.hidden = false;
    if (detailEl) detailEl.hidden = true;
    if (resultsEl) resultsEl.innerHTML = "";
    if (countEl) countEl.textContent = "0 termini";
    return;
  }

  const cats = Array.from(new Set(state.dict.map(x => x.categoria))).sort((a, b) => a.localeCompare(b, "it"));
  if (categoryEl) {
    categoryEl.innerHTML = `<option value="tutte">Tutte</option>` + cats.map(c =>
      `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    ).join("");
  }

  const renderResults = (items) => {
    resultsEl.innerHTML = "";
    if (countEl) countEl.textContent = `${items.length} termine${items.length === 1 ? "" : "i"}`;

    if (items.length === 0) {
      const li = document.createElement("li");
      li.style.cursor = "default";
      li.innerHTML = `<div style="font-weight:1000">Nessun risultato</div><div class="list-meta">Prova un’altra ricerca.</div>`;
      resultsEl.appendChild(li);
      return;
    }

    items.forEach(item => {
      const li = document.createElement("li");
      li.setAttribute("role", "listitem");
      li.dataset.termId = item.id;
      li.className = item.id === state.selectedTermId ? "is-selected" : "";
      li.innerHTML = `
        <div style="font-weight:1000">${escapeHtml(item.term)}</div>
        <div style="color:rgba(255,255,255,.70);font-weight:900;font-size:.92rem;margin-top:2px">
          ${escapeHtml(item.categoria || "")} • ${escapeHtml(item.livello || "")}
        </div>
      `;

      li.addEventListener("click", () => {
        state.selectedTermId = item.id;
        $$("#dictResults li").forEach(x => x.classList.toggle("is-selected", x.dataset.termId === item.id));
        renderDetail(item);
        initFavoritesUI();
      });

      resultsEl.appendChild(li);
    });
  };

  const renderDetail = (item) => {
    if (emptyEl) emptyEl.hidden = true;
    if (detailEl) detailEl.hidden = false;

    if (titleEl) titleEl.textContent = item.term;
    if (metaEl) metaEl.textContent = `${item.categoria || ""} • ${item.livello || ""}`;
    if (defEl) defEl.textContent = item.definizione || "";

    if (examplesEl) {
      examplesEl.innerHTML = "";
      (item.esempi || []).forEach(t => {
        const li = document.createElement("li");
        li.textContent = t;
        examplesEl.appendChild(li);
      });
    }

    if (whenEl) whenEl.textContent = item.quandoUsarlo || "";

    if (synonymsEl) {
      synonymsEl.innerHTML = "";
      (item.sinonimi || []).forEach(s => {
        const span = document.createElement("span");
        span.textContent = s;
        synonymsEl.appendChild(span);
      });
    }

    if (favoriteBtn) {
      const inFav = state.favorites.has(item.id);
      favoriteBtn.textContent = inFav ? "⭐" : "☆";
      favoriteBtn.onclick = () => {
        if (state.favorites.has(item.id)) state.favorites.delete(item.id);
        else state.favorites.add(item.id);
        saveFavorites();
        toast(state.favorites.has(item.id) ? "Aggiunto ai preferiti ⭐" : "Rimosso dai preferiti");
        renderDetail(item);
        initFavoritesUI();
      };
    }

    if (copyBtn) {
      copyBtn.onclick = async () => {
        const txt = `${item.term} — ${item.definizione}\nCategoria: ${item.categoria || ""}`;
        try { await navigator.clipboard.writeText(txt); toast("Copiato ✅"); }
        catch { toast("Copia manuale 📋"); }
      };
    }
  };

  const applyFilters = () => {
    const q = (searchEl?.value || "").trim().toLowerCase();
    const cat = categoryEl?.value || "tutte";

    const filtered = state.dict.filter(item => {
      const matchesQ =
        !q ||
        (item.term || "").toLowerCase().includes(q) ||
        (item.definizione || "").toLowerCase().includes(q) ||
        (item.categoria || "").toLowerCase().includes(q);

      const matchesCat = (cat === "tutte") || item.categoria === cat;
      return matchesQ && matchesCat;
    });

    renderResults(filtered.slice(0, 40));

    if (state.selectedTermId === null && filtered[0]) {
      state.selectedTermId = filtered[0].id;
      renderDetail(filtered[0]);
    }
  };

  searchEl?.addEventListener("input", applyFilters);
  categoryEl?.addEventListener("change", applyFilters);

  resetBtn?.addEventListener("click", () => {
    if (searchEl) searchEl.value = "";
    if (categoryEl) categoryEl.value = "tutte";
    state.selectedTermId = null;
    if (emptyEl) emptyEl.hidden = false;
    if (detailEl) detailEl.hidden = true;
    renderResults(state.dict.slice(0, 20));
    applyFilters();
  });

  renderResults(state.dict.slice(0, 20));
  applyFilters();

  if (state.favorites.size > 0) {
    const firstFav = state.dict.find(d => state.favorites.has(d.id));
    if (firstFav) {
      state.selectedTermId = firstFav.id;
      renderDetail(firstFav);
    }
  }
}

/* -------------------- Diary (FIX title bug) -------------------- */
function diaryKey() { return "tiincludo_diary_entries"; }

function formatISODate(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function loadDiary() {
  try {
    const raw = localStorage.getItem(diaryKey());
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveDiary(entries) {
  localStorage.setItem(diaryKey(), JSON.stringify(entries));
}

// app.js (patch completa: sostituisci solo initDiaryUI() con questa versione)
function initDiaryUI() {
  const dateEl = $("#diaryDate");
  const titleEl = $("#diaryTitle");
  const textEl = $("#diaryText");
  const saveBtn = $("#saveDiaryBtn");
  const clearBtn = $("#clearDiaryBtn");
  const msgEl = $("#diarySavedMsg");

  const listEl = $("#diaryList");
  const emptyEl = $("#diaryEmpty");
  const searchEl = $("#diarySearch");

  const refreshList = () => {
    if (!listEl) return;

    const entries = loadDiary().sort((a, b) => b.date.localeCompare(a.date));
    const q = (searchEl?.value || "").trim().toLowerCase();

    const filtered = entries.filter(e => {
      if (!q) return true;
      return (e.title || "").toLowerCase().includes(q) ||
        (e.text || "").toLowerCase().includes(q) ||
        (e.date || "").toLowerCase().includes(q);
    });

    listEl.innerHTML = "";
    if (emptyEl) emptyEl.hidden = filtered.length !== 0;
    if (filtered.length === 0) return;

    filtered.forEach(e => {
      const li = document.createElement("li");
      li.className = "news-item";

      const rawTitle = e.title ?? "";
      const safeTitle = (typeof rawTitle === "string" && rawTitle.trim() !== "")
        ? rawTitle
        : "Voce senza titolo";

      li.innerHTML = `
        <p class="news-title">${escapeHtml(safeTitle)}</p>
        <p class="news-meta">${escapeHtml(e.date)} • ${escapeHtml(((e.text || "").slice(0, 90)).trim())}${(e.text || "").length > 90 ? "…" : ""}</p>
      `;
      li.style.cursor = "pointer";

      li.addEventListener("click", () => {
        if (dateEl) dateEl.value = e.date || "";
        if (titleEl) titleEl.value = e.title || "";
        if (textEl) textEl.value = e.text || "";
        toast("Voce caricata nel form ✅");
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn danger";
      del.style.marginTop = "10px";
      del.style.padding = "8px 10px";
      del.textContent = "Elimina";

      del.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const next = loadDiary().filter(x => x.id !== e.id);
        saveDiary(next);
        refreshList();
        toast("Voce eliminata 🧹");
      });

      li.appendChild(del);
      listEl.appendChild(li);
    });
  };

  // init date (solo se esiste)
  if (dateEl) dateEl.value = formatISODate(new Date());

  saveBtn?.addEventListener("click", () => {
    // Se la pagina non ha questi elementi (es. template non presente), non crasha.
    if (!dateEl || !textEl || !titleEl) {
      toast("Errore form diario: controlla i campi nel layout.");
      return;
    }

    const date = String(dateEl.value || "").trim();
    const titleRaw = titleEl.value;
    const title = (typeof titleRaw === "string") ? titleRaw.trim() : "";
    const textRaw = textEl.value;
    const text = (typeof textRaw === "string") ? textRaw.trim() : "";

    if (!date || !text) {
      if (msgEl) {
        msgEl.textContent = "Inserisci una data e un testo prima di salvare.";
        msgEl.style.color = "var(--warn)";
      }
      return;
    }

    const entry = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(16).slice(2),
      date,
      title, // <-- titolo reale, non "voce senza titolo"
      text,
      createdAt: new Date().toISOString()
    };

    const entries = loadDiary();
    saveDiary([entry, ...entries]);

    if (msgEl) {
      msgEl.textContent = "Salvato ✅";
      msgEl.style.color = "var(--good)";
    }

    refreshList();
  });

  clearBtn?.addEventListener("click", () => {
    if (titleEl) titleEl.value = "";
    if (textEl) textEl.value = "";
    if (msgEl) msgEl.textContent = "";
  });

  searchEl?.addEventListener("input", refreshList);
  refreshList();
}

/* -------------------- Certificato -------------------- */
function downloadCertificato() {
  if (!checkPlus("Certificato")) return;

  const score = state.plus.score || 0;
  const newWindow = window.open('certificato.html', '_blank');

  newWindow.onload = () => {
    newWindow.document.getElementById('userScoreDisplay').textContent = score;
  };

  toast("Generazione certificato in corso...");
}

function loadQuizResult() {
  try {
    const raw = localStorage.getItem(quizKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveQuizResult(obj) {
  localStorage.setItem(quizKey(), JSON.stringify(obj));
}

function buildQuiz() {
  return [
    {
      q: "In chat, una persona scrive in modo diverso o più lentamente. Cosa fai?",
      answers: [
        { text: "La ignoro per velocizzare", note: "Riduce accessibilità e partecipazione.", value: 10 },
        { text: "Aspetto e chiedo se ha bisogno di supporto", note: "Favorisce comprensione e spazio.", value: 85 },
        { text: "Cambio argomento senza motivo", note: "Taglia il dialogo.", value: 30 },
        { text: "Le do subito soluzioni, senza chiedere", note: "Può essere invasivo se non richiesto.", value: 45 }
      ]
    },
    {
      q: "Qual è un approccio più inclusivo quando qualcuno non capisce un termine?",
      answers: [
        { text: "Spiegare con parole semplici e un esempio", note: "Chiarezza e accessibilità.", value: 90 },
        { text: "Dire “è ovvio” e continuare", note: "Esclude chi è in difficoltà.", value: 15 },
        { text: "Cambiare tema per evitare la discussione", note: "Evitamento.", value: 20 },
        { text: "Usare solo tecnicismi per essere “precisi”", note: "Riduce la comprensione.", value: 30 }
      ]
    },
    {
      q: "Hai un ruolo di coordinamento. Una persona segnala che un’attività non è accessibile. Cosa fai?",
      answers: [
        { text: "Accetti il feedback e adatti l’attività insieme", note: "Co-progettazione inclusiva.", value: 95 },
        { text: "Chiedi di aspettare “la prossima volta” senza ascoltare", note: "Rimanda senza risolvere.", value: 35 },
        { text: "Dici che non è un problema e basta", note: "Sminuisce il vissuto.", value: 10 },
        { text: "Cambiare tutto da solo senza chiedere", note: "Può ignorare bisogni specifici.", value: 55 }
      ]
    },
    {
      q: "Come reagisci quando qualcuno usa un linguaggio che può ferire o escludere?",
      answers: [
        { text: "Correggo in modo rispettoso, spiegando l’impatto", note: "Riparazione e dignità.", value: 92 },
        { text: "Faccio finta di niente per evitare conflitti", note: "Normalizza il problema.", value: 25 },
        { text: "Attacco la persona pubblicamente", note: "Escalation e paura.", value: 5 },
        { text: "Rispondo con sarcasmo", note: "Aumenta ostilità.", value: 8 }
      ]
    }
  ];
}

function calcScoreFromStateAnswers(answersStateArray) {
  if (!Array.isArray(answersStateArray) || answersStateArray.length === 0) return 0;
  const values = answersStateArray
    .map(a => a?.answer?.value)
    .map(v => Number(v))
    .filter(v => Number.isFinite(v));
  if (values.length === 0) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.max(0, Math.min(100, Math.round(avg)));
}

function initQuizUI() {
  const questionEl = $("#quizQuestion");
  const answersWrap = $("#quizAnswers");
  const formEl = $("#quizForm");
  const restartBtn = $("#quizRestartBtn");
  const promptTitle = $("#quizPromptTitle");
  const nextBtn = $("#quizNextBtn");

  const scoreNumber = $("#quizScoreNumber");
  const scoreText = $("#quizScoreText");
  const tipsEl = $("#quizTips");

  const scoreValueHome = $("#scoreValue");
  const scoreHintHome = $("#scoreHint");

  const quizData = buildQuiz();

  state.quiz.idx = 0;
  state.quiz.answers = [];
  state.quiz.finished = false;

  const existing = loadQuizResult();
  if (existing && typeof existing.score === "number" && Number.isFinite(existing.score)) {
    if (scoreNumber) scoreNumber.textContent = `${existing.score}`;
    if (scoreValueHome) scoreValueHome.textContent = `${existing.score}`;
    if (scoreHintHome) scoreHintHome.textContent = "Punteggio salvato localmente ✅";
    if (scoreText) scoreText.textContent = "Punteggio salvato localmente ✅";
    applyScoreFeedback(existing.score);
  } else {
    if (scoreNumber) scoreNumber.textContent = "—";
    if (scoreText) scoreText.textContent = "Completa il quiz per ricevere consigli personalizzati.";
  }

  let selectedIndex = null;

  function applyScoreFeedback(score) {
    if (!tipsEl) return;

    let tips = [];
    if (score >= 85) tips = ["Mantieni l’ascolto 👂", "Offri supporto senza invadere 🤝", "Valuta l’impatto 🌿"];
    else if (score >= 65) tips = ["Chiedi bisogni specifici ✅", "Usa esempi accessibili 🧩", "Verifica la partecipazione 🔎"];
    else if (score >= 40) tips = ["Rallenta ⏳", "Spiega con parole semplici 🗣️", "Correggi con rispetto ✨"];
    else tips = ["Non minimizzare 🛑", "Immagina l’esperienza 👀", "Passa da “velocizzare” a “includere” 🧭"];

    tipsEl.innerHTML = "";
    tips.forEach(t => {
      const li = document.createElement("li");
      li.textContent = t;
      tipsEl.appendChild(li);
    });
  }

  function renderQuestion() {
    selectedIndex = null;
    const item = quizData[state.quiz.idx];

    if (promptTitle) promptTitle.textContent = `Domanda ${state.quiz.idx + 1} di ${quizData.length}`;
    if (questionEl) questionEl.textContent = item.q;

    if (answersWrap) {
      answersWrap.innerHTML = "";
      item.answers.forEach((a, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quiz-answer";
        btn.innerHTML = `<div>${escapeHtml(a.text)}</div><small style="display:block;color:rgba(255,255,255,.65);font-weight:900;margin-top:6px">${escapeHtml(a.note)}</small>`;
        btn.addEventListener("click", () => {
          selectedIndex = i;
          $$(".quiz-answer", answersWrap).forEach(x => x.classList.toggle("is-selected", x === btn));
        });
        answersWrap.appendChild(btn);
      });
    }

    if (nextBtn) nextBtn.textContent = (state.quiz.idx === quizData.length - 1) ? "Finisci ✅" : "Avanti ➡️";
  }

  formEl?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (selectedIndex === null) {
      toast("Seleziona un’opzione prima di continuare.");
      return;
    }

    const item = quizData[state.quiz.idx];
    const chosen = item.answers[selectedIndex];
    state.quiz.answers.push({ idx: state.quiz.idx, answer: chosen });

    if (state.quiz.idx < quizData.length - 1) {
      state.quiz.idx += 1;
      renderQuestion();
      return;
    }

    const score = calcScoreFromStateAnswers(state.quiz.answers);
    state.quiz.finished = true;

    saveQuizResult({ score, doneAt: new Date().toISOString(), answers: state.quiz.answers });

    if (scoreNumber) scoreNumber.textContent = `${score}`;
    if (scoreText) scoreText.textContent = "Quiz completato ✅";
    if (scoreValueHome) scoreValueHome.textContent = `${score}`;
    if (scoreHintHome) scoreHintHome.textContent = "Quiz completato ✅";

    applyScoreFeedback(score);
    toast("Quiz completato! 🎉");
  });

  restartBtn?.addEventListener("click", () => {
    localStorage.removeItem(quizKey());
    state.quiz.idx = 0;
    state.quiz.answers = [];
    state.quiz.finished = false;

    if (scoreNumber) scoreNumber.textContent = "—";
    if (scoreText) scoreText.textContent = "Completa il quiz per ricevere consigli personalizzati.";
    if (scoreValueHome) scoreValueHome.textContent = "—";
    if (scoreHintHome) scoreHintHome.textContent = "Completa il quiz per vedere il tuo punteggio.";
    if (tipsEl) tipsEl.innerHTML = "";

    renderQuestion();
  });

  renderQuestion();
}

/* -------------------- News -------------------- */
function initNewsUI() {
  const fetchBtn = $("#fetchNewsBtn");
  const clearBtn = $("#clearNewsBtn");
  const queryEl = $("#newsQuery");
  const statusEl = $("#newsStatus");

  const renderNews = (items) => {
    const list = $("#newsList");
    const empty = $("#newsEmpty");
    if (!list) return;

    list.innerHTML = "";
    if (!items || items.length === 0) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    items.forEach(it => {
      const li = document.createElement("li");
      li.className = "news-item";
      const title = it.title || "Notizia senza titolo";
      const link = it.link || "#";
      const date = it.pubDate || it.date || "";
      li.innerHTML = `
        <p class="news-title">${escapeHtml(title)}</p>
        <p class="news-meta">${escapeHtml(date ? new Date(date).toLocaleDateString("it-IT") : "Data non disponibile")}</p>
        ${link && link !== "#" ? `<a class="news-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Apri articolo →</a>` : ""}
      `;
      list.appendChild(li);
    });
  };

  const fetchNewsScaping = async (query) => {
    const url = `./news-proxy.php?query=${encodeURIComponent(query)}&limit=10`;
    const data = await loadJSON(url, null);
    return data && Array.isArray(data.items) ? data.items : [];
  };

  const loadOfflineFallback = async () => {
    const fb = await loadJSON("./news-fallback.json", { items: [] });
    return fb && Array.isArray(fb.items) ? fb.items : [];
  };

  const doFetch = async () => {
    const q = (queryEl?.value || "").trim() || "inclusione sociale accessibilità";
    if (statusEl) statusEl.textContent = "Aggiornamento…";

    try {
      if (!isOnline()) {
        const items = await loadOfflineFallback();
        renderNews(items);
        if (statusEl) statusEl.textContent = `Offline: ${items.length} articoli.`;
        return;
      }
      const items = await fetchNewsScaping(q);
      renderNews(items);
      if (statusEl) statusEl.textContent = `Aggiornate: ${items.length} notizie.`;
    } catch {
      const items = await loadOfflineFallback();
      renderNews(items);
      if (statusEl) statusEl.textContent = "Errore rete: fallback offline.";
    }
  };

  fetchBtn?.addEventListener("click", doFetch);

  clearBtn?.addEventListener("click", () => {
    const list = $("#newsList");
    const empty = $("#newsEmpty");
    if (list) list.innerHTML = "";
    if (empty) empty.hidden = false;
    if (statusEl) statusEl.textContent = "Pulito.";
  });
}

/* -------------------- Plus minimal (no changes) -------------------- */
function initPlusUI() {
  // lascia invariato se lo hai già; qui lo tengo semplice
  const plusStatus = $("#plusStatus");
  const checkoutBtn = $("#stripeCheckoutBtn");
  const logoutBtn = $("#logoutBtn");
  const openExtendedDictBtn = $("#openExtendedDictBtn");
  const openRepairTemplatesBtn = $("#openRepairTemplatesBtn");
  const openRewriteBtn = $("#openRewriteBtn");
  const syncAllBtn = $("#syncAllBtn");
  const plusFeatures = $("#plusFeatures");

  if (plusFeatures) {
    const features = [
      "📚 Dizionario esteso",
      "🧡 Riparazione (template)",
      "✍️ Generatore risposta inclusiva",
      "🏅 Gamification avanzata",
      "☁️ Sync diario & preferiti"
    ];
    plusFeatures.innerHTML = features.map(f => `<li>${escapeHtml(f)}</li>`).join("");
  }

  const setGated = (isPlus) => {
    const gated = !isPlus;
    if (openExtendedDictBtn) openExtendedDictBtn.disabled = gated;
    if (openRepairTemplatesBtn) openRepairTemplatesBtn.disabled = gated;
    if (openRewriteBtn) openRewriteBtn.disabled = gated;
    if (syncAllBtn) syncAllBtn.disabled = gated;
    if (checkoutBtn) checkoutBtn.disabled = isPlus;
    if (plusStatus) plusStatus.textContent = isPlus ? "Plus sbloccato ✅" : "Plus non sbloccato 💳";
  };

  async function refreshPlus() {
    try {
      const res = await fetch("./auth.php?action=plusStatus", { credentials: "same-origin" });
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      state.plus.isPlus = !!(data && data.plus);
    } catch {
      state.plus.isPlus = false;
    }
    setGated(state.plus.isPlus);
  }

  logoutBtn?.addEventListener("click", async () => {
    await fetch("./auth.php?action=logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    state.plus.isPlus = false;
    setGated(false);
    window.location.href = "./dashboard.html";
  });

  checkoutBtn?.addEventListener("click", async () => {
    if (state.plus.isPlus) return;
    try {
      checkoutBtn.disabled = true;
      const res = await fetch("./stripe-checkout.php", { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "checkout error");
      window.location.href = data.checkoutUrl;
    } catch {
      toast("Errore avvio pagamento. Riprova.");
      checkoutBtn.disabled = false;
    }
  });

  openExtendedDictBtn?.addEventListener("click", () => state.plus.isPlus ? toast("Demo dizionario esteso ✅") : toast("Sblocca Plus 💎"));
  openRepairTemplatesBtn?.addEventListener("click", () => state.plus.isPlus ? toast("Demo riparazione ✅") : toast("Sblocca Plus 💎"));
  openRewriteBtn?.addEventListener("click", async () => {
    if (!state.plus.isPlus) return toast("Sblocca Plus 💎");
    const text = prompt("Incolla una bozza da rendere più inclusiva ✍️");
    if (!text) return;
    try {
      const res = await fetch("./plus-features.php?action=rewrite", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "rewrite error");
      alert(data.rewritten);
    } catch {
      toast("Errore generatore. Riprova.");
    }
  });

  syncAllBtn?.addEventListener("click", async () => {
    if (!state.plus.isPlus) return toast("Sblocca Plus 💎");
    toast("Sync demo: apri Plus e usa la sincronizzazione.");
  });

  refreshPlus();
}

/* -------------------- Nav wiring -------------------- */
function wireNav() {
  $$(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  document.body.addEventListener("click", (e) => {
    const startQuiz = e.target.closest("[data-start-quiz]");
    if (startQuiz) return showView("quiz");

    const refreshNews = e.target.closest("[data-refresh-news]");
    if (refreshNews) {
      showView("news");
      $("#fetchNewsBtn")?.click();
      return;
    }

    const jump = e.target.closest("[data-jump]");
    if (jump) {
      e.preventDefault();
      showView(jump.dataset.jump);
      return;
    }
  });
}

/* -------------------- Init -------------------- */
async function init() {
  wireNav();
  loadFavorites();
  initOfflineToggle();

  try { if ("serviceWorker" in navigator) await navigator.serviceWorker.register("./service-worker.js"); } catch {}

  try {
    const dict = await loadJSON("./dizionario.json", { items: [] });
    state.dict = Array.isArray(dict.items) ? dict.items : (Array.isArray(dict) ? dict : []);
  } catch { state.dict = []; }

  initDictionaryUI();
  initFavoritesUI();
  initDiaryUI();
  initQuizUI();
  initNewsUI();
  initPlusUI();
}

init();
