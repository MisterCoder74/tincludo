const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  onlineOverride: null,
  selectedTermId: null,
  favorites: new Set(),
  dict: [],
  quiz: { idx: 0, answers: [], finished: false, topic: 'generale' },
  plus: { isPlus: false, score: 0 },
  profile: {
    termsViewed: new Set(),
    quizCompletions: [],
    badges: new Set(),
    diaryEntriesCount: 0,
    globalScore: null
  },
  savedNews: [],
  currentEditingDiaryId: null
};

/* -------------------- Toast -------------------- */
function toast(message) {
  let el = $("#toastEl");
  if (!el) {
    el = document.createElement("div");
    el.id = "toastEl";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    Object.assign(el.style, {
      position: "fixed", left: "50%", transform: "translateX(-50%)",
      bottom: "20px", zIndex: 9999,
      background: "rgba(0,0,0,.75)", border: "1px solid rgba(255,255,255,.18)",
      color: "rgba(255,255,255,.95)", padding: "10px 14px", borderRadius: "14px",
      boxShadow: "0 18px 50px rgba(0,0,0,.35)", maxWidth: "calc(100vw - 30px)",
      textAlign: "center", opacity: "1", transition: "opacity .2s ease"
    });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = "1";
  if (toast._t) clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.opacity = "0"; }, 2400);
}

/* -------------------- Network / Nav -------------------- */
function setNetworkPill(on) {
  const pill = $("#netPill");
  if (!pill) return;
  pill.textContent = on ? "Online" : "Offline";
  pill.style.borderColor = on ? "rgba(76,186,110,.55)" : "rgba(230,200,58,.55)";
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
  return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
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

/* -------------------- Profile persistence -------------------- */
function profileKey() { return "tiincludo_profile"; }
function loadProfileData() {
  try {
    const raw = localStorage.getItem(profileKey());
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.termsViewed) state.profile.termsViewed = new Set(data.termsViewed);
    if (data.quizCompletions) state.profile.quizCompletions = data.quizCompletions;
    if (data.badges) state.profile.badges = new Set(data.badges);
    if (typeof data.diaryEntriesCount === 'number') state.profile.diaryEntriesCount = data.diaryEntriesCount;
    if (typeof data.globalScore === 'number') state.profile.globalScore = data.globalScore;
  } catch { /* ignore */ }
}
function saveProfileData() {
  localStorage.setItem(profileKey(), JSON.stringify({
    termsViewed: Array.from(state.profile.termsViewed),
    quizCompletions: state.profile.quizCompletions,
    badges: Array.from(state.profile.badges),
    diaryEntriesCount: state.profile.diaryEntriesCount,
    globalScore: state.profile.globalScore
  }));
}

/* -------------------- Theme persistence -------------------- */
function loadTheme() {
  try {
    const theme = localStorage.getItem('tiincludo_theme') || 'default';
    const highContrast = localStorage.getItem('tiincludo_highcontrast') === 'true';
    if (highContrast) document.body.classList.add('high-contrast');
    const hcToggle = $('#highContrastToggle');
    if (hcToggle) hcToggle.checked = highContrast;
    applyTheme(theme);
    const sel = $('#themeSelect');
    if (sel) sel.value = theme;
  } catch {}
}
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'blue') {
    root.style.setProperty('--rainbow-1', '#3a7bd5');
    root.style.setProperty('--rainbow-2', '#5a9bd5');
    root.style.setProperty('--rainbow-3', '#7abbf5');
    root.style.setProperty('--rainbow-4', '#3a9bd5');
    root.style.setProperty('--rainbow-5', '#2a7bc5');
    root.style.setProperty('--rainbow-6', '#1a5ba5');
  } else if (theme === 'green') {
    root.style.setProperty('--rainbow-1', '#3a9b5a');
    root.style.setProperty('--rainbow-2', '#5abb7a');
    root.style.setProperty('--rainbow-3', '#7adb9a');
    root.style.setProperty('--rainbow-4', '#4cba6e');
    root.style.setProperty('--rainbow-5', '#2a9a4e');
    root.style.setProperty('--rainbow-6', '#1a7a3e');
  } else if (theme === 'purple') {
    root.style.setProperty('--rainbow-1', '#7c5bb0');
    root.style.setProperty('--rainbow-2', '#9c7bd0');
    root.style.setProperty('--rainbow-3', '#bc9bf0');
    root.style.setProperty('--rainbow-4', '#7c5bb0');
    root.style.setProperty('--rainbow-5', '#6c4ba0');
    root.style.setProperty('--rainbow-6', '#5c3b90');
  } else {
    root.style.setProperty('--rainbow-1', '#e8444a');
    root.style.setProperty('--rainbow-2', '#e8903a');
    root.style.setProperty('--rainbow-3', '#e6c83a');
    root.style.setProperty('--rainbow-4', '#4cba6e');
    root.style.setProperty('--rainbow-5', '#3a9bd5');
    root.style.setProperty('--rainbow-6', '#7c5bb0');
  }
}

/* -------------------- Offline toggle -------------------- */
function initOfflineToggle() {
  const btn = $("#toggleOfflineBtn");
  if (!btn) return;
  const apply = () => {
    const on = isOnline();
    setNetworkPill(on);
    btn.textContent = state.onlineOverride === "offline" ? "Torna online ✅" : "Simula offline ⛔";
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
    const items = state.dict.filter(d => state.favorites.has(d.id)).filter(d => {
      if (!q) return true;
      return (d.term || "").toLowerCase().includes(q) || (d.definizione || "").toLowerCase().includes(q) || (d.categoria || "").toLowerCase().includes(q);
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
      li.innerHTML = `<p class="news-title">${escapeHtml(item.term)}</p><p class="news-meta">${escapeHtml(item.categoria || "")}</p>`;
      li.addEventListener("click", () => {
        selectedId = item.id;
        if (selTitle) selTitle.textContent = item.term;
        if (selDef) selDef.textContent = item.definizione || "—";
        if (copyBtn) copyBtn.disabled = false;
        if (removeBtn) removeBtn.disabled = false;
        $$("#favList .news-item").forEach(n => n.style.borderColor = "rgba(255,255,255,.10)");
        li.style.borderColor = "rgba(58,155,213,.55)";
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
      updateProfileUI();
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
  toast(`"${featureName}" è riservata agli utenti Plus 🧡`);
  return false;
}

/* -------------------- Diary (FIX: edit + no title) -------------------- */
function diaryKey() { return "tiincludo_diary_entries"; }
function formatISODate(d) {
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
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

function openEditVoice(id) {
  const entries = loadDiary();
  const item = entries.find(v => v.id === id);
  if (!item) return;
  state.currentEditingDiaryId = id;

  const modal = document.createElement('div');
  modal.className = 'sheet';
  modal.innerHTML = `
    <div class="sheet-head"><h3>Modifica voce</h3><button id="closeEdit">✕</button></div>
    <div class="sheet-body">
      <label class="field">
        <span class="field-label">Data</span>
        <input type="date" id="editDate" value="${escapeHtml(item.date || '')}" />
      </label>
      <label class="field">
        <span class="field-label">Titolo</span>
        <input type="text" id="editTitle" value="${escapeHtml(item.title || '')}" style="width:100%;" />
      </label>
      <label class="field">
        <span class="field-label">Testo</span>
        <textarea id="editBody" style="width:100%;height:120px;">${escapeHtml(item.text || '')}</textarea>
      </label>
      <button id="saveEdit" class="btn primary" style="margin-top:10px;">Salva modifiche ✅</button>
      <button id="deleteFromEdit" class="btn danger" style="margin-top:10px;margin-left:8px;">Elimina 🗑️</button>
    </div>
  `;
  document.body.appendChild(modal);

  $("#closeEdit").addEventListener("click", () => { modal.remove(); state.currentEditingDiaryId = null; });
  $("#saveEdit").addEventListener("click", () => {
    item.date = $("#editDate").value.trim();
    item.title = $("#editTitle").value.trim();
    item.text = $("#editBody").value.trim();
    item.updatedAt = new Date().toISOString();
    saveDiary(entries);
    modal.remove();
    state.currentEditingDiaryId = null;
    toast("Voce aggiornata ✅");
    initDiaryUI();
  });
  $("#deleteFromEdit").addEventListener("click", () => {
    if (!confirm("Eliminare questa voce?")) return;
    const next = entries.filter(x => x.id !== id);
    saveDiary(next);
    modal.remove();
    state.currentEditingDiaryId = null;
    toast("Voce eliminata 🧹");
    initDiaryUI();
  });
}

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
    const entries = loadDiary().sort((a,b) => (b.date + ' ' + (b.createdAt||'')).localeCompare(a.date + ' ' + (a.createdAt||'')));
    const q = (searchEl?.value || "").trim().toLowerCase();
    const filtered = entries.filter(e => {
      if (!q) return true;
      return (e.title || "").toLowerCase().includes(q) || (e.text || "").toLowerCase().includes(q) || (e.date || "").toLowerCase().includes(q);
    });
    state.profile.diaryEntriesCount = entries.length;
    saveProfileData();

    listEl.innerHTML = "";
    if (emptyEl) emptyEl.hidden = filtered.length !== 0;
    if (filtered.length === 0) return;

    filtered.forEach(e => {
      const li = document.createElement("li");
      li.className = "news-item";
      const rawTitle = e.title ?? "";
      const safeTitle = (typeof rawTitle === "string" && rawTitle.trim() !== "") ? rawTitle : "Voce senza titolo";
      li.innerHTML = `
        <p class="news-title">${escapeHtml(safeTitle)}</p>
        <p class="news-meta">${escapeHtml(e.date)} • ${escapeHtml(((e.text || "").slice(0,90)).trim())}${(e.text||"").length>90?"…":""}</p>
      `;
      li.style.cursor = "pointer";

      // Click per caricare nel form
      li.addEventListener("click", () => {
        if (dateEl) dateEl.value = e.date || "";
        if (titleEl) titleEl.value = e.title || "";
        if (textEl) textEl.value = e.text || "";
        toast("Voce caricata nel form ✅");
      });

      // Pulsante Modifica
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn";
      editBtn.style.marginTop = "8px";
      editBtn.style.marginRight = "6px";
      editBtn.style.padding = "6px 10px";
      editBtn.textContent = "✏️ Modifica";
      editBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openEditVoice(e.id);
      });

      // Pulsante Elimina
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn danger";
      delBtn.style.marginTop = "8px";
      delBtn.style.padding = "6px 10px";
      delBtn.textContent = "🗑️";
      delBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (!confirm("Eliminare questa voce?")) return;
        const next = loadDiary().filter(x => x.id !== e.id);
        saveDiary(next);
        refreshList();
        toast("Voce eliminata 🧹");
      });

      const actionsDiv = document.createElement("div");
      actionsDiv.style.display = "flex";
      actionsDiv.style.gap = "6px";
      actionsDiv.style.marginTop = "6px";
      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(delBtn);
      li.appendChild(actionsDiv);
      listEl.appendChild(li);
    });
    updateProfileUI();
  };

  if (dateEl) dateEl.value = formatISODate(new Date());

  saveBtn?.addEventListener("click", () => {
    if (!dateEl || !textEl || !titleEl) { toast("Errore form diario."); return; }
    const date = String(dateEl.value || "").trim();
    const title = (typeof titleEl.value === "string") ? titleEl.value.trim() : "";
    const text = (typeof textEl.value === "string") ? textEl.value.trim() : "";
    if (!date || !text) {
      if (msgEl) { msgEl.textContent = "Inserisci una data e un testo prima di salvare."; msgEl.style.color = "var(--warn)"; }
      return;
    }
    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2),
      date,
      title,
      text,
      createdAt: new Date().toISOString()
    };
    const entries = loadDiary();
    saveDiary([entry, ...entries]);
    if (msgEl) { msgEl.textContent = "Salvato ✅"; msgEl.style.color = "var(--good)"; }
    refreshList();
    updateProfileUI();
  });

  clearBtn?.addEventListener("click", () => {
    if (titleEl) titleEl.value = "";
    if (textEl) textEl.value = "";
    state.currentEditingDiaryId = null;
    if (msgEl) msgEl.textContent = "";
  });

  searchEl?.addEventListener("input", refreshList);
  refreshList();
}

/* -------------------- Quiz (multi-topic) -------------------- */
function quizKey() { return "tiincludo_quiz_result"; }

function buildQuiz(topic) {
  const quizzes = {
    generale: [
      { q: "In chat una persona scrive in modo diverso o più lentamente. Cosa fai?", answers: [
        { text: "La ignoro per velocizzare", note: "Riduce accessibilità e partecipazione.", value: 10 },
        { text: "Aspetto e chiedo se ha bisogno di supporto", note: "Favorisce comprensione e spazio.", value: 85 },
        { text: "Cambio argomento senza motivo", note: "Taglia il dialogo.", value: 30 },
        { text: "Le do subito soluzioni senza chiedere", note: "Può essere invasivo.", value: 45 }
      ]},
      { q: "Qual è un approccio più inclusivo quando qualcuno non capisce un termine?", answers: [
        { text: "Spiegare con parole semplici e un esempio", note: "Chiarezza e accessibilità.", value: 90 },
        { text: "Dire 'è ovvio' e continuare", note: "Esclude chi è in difficoltà.", value: 15 },
        { text: "Cambiare tema per evitare la discussione", note: "Evitamento.", value: 20 },
        { text: "Usare solo tecnicismi per essere 'precisi'", note: "Riduce la comprensione.", value: 30 }
      ]},
      { q: "Una persona segnala che un'attività non è accessibile. Cosa fai?", answers: [
        { text: "Accetti il feedback e adatti l'attività insieme", note: "Co-progettazione inclusiva.", value: 95 },
        { text: "Chiedi di aspettare 'la prossima volta'", note: "Rimanda senza risolvere.", value: 35 },
        { text: "Dici che non è un problema", note: "Sminuisce il vissuto.", value: 10 },
        { text: "Cambi tutto da solo senza chiedere", note: "Può ignorare bisogni specifici.", value: 55 }
      ]},
      { q: "Come reagisci quando qualcuno usa un linguaggio che può ferire o escludere?", answers: [
        { text: "Correggo in modo rispettoso spiegando l'impatto", note: "Riparazione e dignità.", value: 92 },
        { text: "Faccio finta di niente per evitare conflitti", note: "Normalizza il problema.", value: 25 },
        { text: "Attacco la persona pubblicamente", note: "Escalation.", value: 5 },
        { text: "Rispondo con sarcasmo", note: "Aumenta ostilità.", value: 8 }
      ]}
    ],
    genere: [
      { q: "In un team di lavoro, vuoi essere inclusivo rispetto al genere. Cosa fai?", answers: [
        { text: "Chiedi i pronomi preferiti a ciascuno", note: "Rispetta l'identità.", value: 90 },
        { text: "Usi sempre il maschile come neutro", note: "Esclude identità non binarie.", value: 20 },
        { text: "Non parli mai di genere per 'non sbagliare'", note: "Evitamento, non inclusione.", value: 35 },
        { text: "Usi solo 'lui' perché è più comune", note: "Ignora la diversità.", value: 10 }
      ]},
      { q: "Un collega ti dice che preferisce essere chiamatə con un nome diverso. Cosa fai?", answers: [
        { text: "Lo chiami come richiesto e aggiorni i contatti", note: "Rispetto dell'autodeterminazione.", value: 95 },
        { text: "Continui col vecchio nome 'per abitudine'", note: "Invalida la sua identità.", value: 10 },
        { text: "Chiedi spiegazioni sul perché", note: "Può mettere a disagio.", value: 45 },
        { text: "Usi entrambi i nomi per non sbagliare", note: "Meglio di niente ma confusione.", value: 55 }
      ]},
      { q: "In un modulo, chiedi il genere. Come lo imposti?", answers: [
        { text: "Opzioni multiple: M/F/NB/Preferisco non dire", note: "Inclusivo e rispettoso.", value: 92 },
        { text: "Solo M/F", note: "Esclude persone non binarie.", value: 25 },
        { text: "Non lo chiedo mai", note: "Può essere ok, ma a volte serve sapere.", value: 50 },
        { text: "Campo libero di testo", note: "Raccogli dati non standardizzati.", value: 65 }
      ]},
      { q: "Come reagisci a uno stereotipo di genere in una riunione?", answers: [
        { text: "Intervengo con dati e rispetto", note: "Educa senza attaccare.", value: 88 },
        { text: "Rido per non creare tensione", note: "Normalizza lo stereotipo.", value: 20 },
        { text: "Ignoro e cambio argomento", note: "Occasione persa.", value: 30 },
        { text: "Correggo aspramente la persona", note: "Crea difesa, non cambiamento.", value: 25 }
      ]}
    ],
    disabilita: [
      { q: "Una persona con disabilità visiva partecipa a un evento online. Cosa fai?", answers: [
        { text: "Descrivi a voce le slide e le immagini", note: "Accessibilità concreta.", value: 90 },
        { text: "Condividi solo lo schermo senza descrizione", note: "Inaccessibile.", value: 15 },
        { text: "Mandi il PDF dopo (sperando basti)", note: "Fornisce materiale ma esclude in diretta.", value: 45 },
        { text: "Chiedi alla persona cosa le serve", note: "Coinvolge e personalizza.", value: 85 }
      ]},
      { q: "Come rendi un ufficio accessibile a persone con disabilità motoria?", answers: [
        { text: "Ramupe, porte larghe, bagni accessibili", note: "Accessibilità architettonica.", value: 95 },
        { text: "Solo piano terra senza ascensore", note: "Soluzione parziale.", value: 35 },
        { text: "Aspetti che qualcuno lo richieda", note: "Reattivo, non proattivo.", value: 20 },
        { text: "Scrivanie regolabili in altezza", note: "Buono ma non basta.", value: 55 }
      ]},
      { q: "Un collega con ADHD ti dice che ha difficoltà con le riunioni lunghe. Cosa fai?", answers: [
        { text: "Propongo riunioni più brevi con pause", note: "Adattamento inclusivo.", value: 90 },
        { text: "Dico di fare più attenzione", note: "Sminuisce la neurodiversità.", value: 10 },
        { text: "Mando solo il riassunto scritto", note: "Meglio di niente, ma esclude.", value: 40 },
        { text: "Alterno format: scritto e orale", note: "Flessibilità.", value: 80 }
      ]},
      { q: "Cosa significa 'accomodamento ragionevole'?", answers: [
        { text: "Modifiche per garantire pari opportunità senza onere sproporzionato", note: "Corretto.", value: 92 },
        { text: "Scuse per non assumere persone con disabilità", note: "Falso.", value: 5 },
        { text: "Privilegi ingiusti per alcuni", note: "Interpretazione errata.", value: 10 },
        { text: "Solo rampe e ascensori", note: "Visione limitata.", value: 30 }
      ]}
    ],
    etnia: [
      { q: "Un collega di origine straniera viene spesso interrotto nelle riunioni. Cosa fai?", answers: [
        { text: "Faccio notare il pattern e riporto la parola a lui", note: "Alleato attivo.", value: 92 },
        { text: "Intervengo solo se esplicito razzismo", note: "Troppo poco.", value: 30 },
        { text: "Non intervengo per non creare imbarazzo", note: "Silenzio complicità.", value: 15 },
        { text: "Parlo io al posto suo per dargli visibilità", note: "Toglie agency.", value: 40 }
      ]},
      { q: "Come scegli i materiali formativi per un team multiculturale?", answers: [
        { text: "Includo autori e casi studio di varie culture", note: "Rappresentanza.", value: 90 },
        { text: "Uso solo autori occidentali (standard)", note: "Prospettiva limitata.", value: 20 },
        { text: "Chiedo al team cosa preferisce", note: "Coinvolgimento diretto.", value: 85 },
        { text: "Traduco in più lingue", note: "Lingua sì, ma anche contenuto.", value: 65 }
      ]},
      { q: "Cosa significa 'privilegio bianco'?", answers: [
        { text: "Vantaggi non guadagnati per persone bianche in società razzializzate", note: "Definizione corretta.", value: 92 },
        { text: "Una cosa inventata per creare divisione", note: "Nega il fenomeno.", value: 5 },
        { text: "Essere ricchi e bianchi", note: "Semplificazione.", value: 30 },
        { text: "Un concetto superato", note: "Ignora il dibattito attuale.", value: 15 }
      ]},
      { q: "Un'idea proposta da una persona di minoranza etnica viene ignorata, poi riproposta da un collega bianco e accolta. Cosa fai?", answers: [
        { text: "Segnalo il caso e do credito alla fonte originale", note: "Corregge l'erasure.", value: 95 },
        { text: "Non dico niente per non creare conflitto", note: "Permette l'ingiustizia.", value: 15 },
        { text: "Ne parlo in privato solo con chi l'ha ignorata", note: "Meglio di niente.", value: 55 },
        { text: "Rido della situazione", note: "Banalizza.", value: 8 }
      ]}
    ],
    sostenibilita: [
      { q: "Come riduci l'impatto ambientale sul posto di lavoro?", answers: [
        { text: "Raccolta differenziata, luci LED, no plastica", note: "Azioni concrete.", value: 85 },
        { text: "Non ci penso, è compito dell'azienda", note: "Disinteresse.", value: 10 },
        { text: "Solo riciclo della carta", note: "Troppo poco.", value: 35 },
        { text: "Sensibilizzo i colleghi con dati e iniziative", note: "Impatto moltiplicato.", value: 90 }
      ]},
      { q: "Il cambiamento climatico colpisce di più le comunità vulnerabili. Cosa implica?", answers: [
        { text: "Giustizia climatica: chi inquina di più deve contribuire di più", note: "Equità.", value: 92 },
        { text: "Tutti sono colpiti ugualmente", note: "Ignora le disuguaglianze.", value: 15 },
        { text: "È un problema dei paesi poveri", note: "Visione limitata.", value: 10 },
        { text: "Bisogna aiutare i paesi più colpiti", note: "Giusto ma parziale.", value: 60 }
      ]},
      { q: "Quale pratica di consumo è più sostenibile e inclusiva?", answers: [
        { text: "Acquisti da cooperative locali e commercio equo", note: "Sostenibilità sociale e ambientale.", value: 90 },
        { text: "Comprare sempre nuovo e riciclare", note: "Meglio di niente.", value: 40 },
        { text: "Prodotti vegani e bio", note: "Buono ma non sempre accessibile.", value: 60 },
        { text: "Usare meno plastica", note: "Troppo poco.", value: 35 }
      ]},
      { q: "Il 'greenwashing' è un problema perché...", answers: [
        { text: "Inganna i consumatori e ritarda azioni reali", note: "Corretto.", value: 92 },
        { text: "Non esiste, è solo marketing", note: "Sottovaluta il problema.", value: 10 },
        { text: "Aiuta a vendere prodotti più verdi", note: "Giustifica l'inganno.", value: 20 },
        { text: "Confonde ma non è grave", note: "Non coglie l'impatto.", value: 25 }
      ]}
    ]
  };
  return quizzes[topic] || quizzes.generale;
}

function calcScoreFromStateAnswers(answersStateArray) {
  if (!Array.isArray(answersStateArray) || answersStateArray.length === 0) return 0;
  const values = answersStateArray.map(a => a?.answer?.value).map(v => Number(v)).filter(v => Number.isFinite(v));
  if (values.length === 0) return 0;
  const avg = values.reduce((s,v) => s+v, 0) / values.length;
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
  const badgesEl = $("#quizBadges");

  let quizData = buildQuiz(state.quiz.topic);
  state.quiz.idx = 0;
  state.quiz.answers = [];
  state.quiz.finished = false;

  const existing = loadQuizResult();
  if (existing && typeof existing.score === "number" && Number.isFinite(existing.score)) {
    if (scoreNumber) scoreNumber.textContent = `${existing.score}`;
    if (scoreValueHome) scoreValueHome.textContent = `${existing.score}`;
    if (scoreHintHome) scoreHintHome.textContent = "Punteggio salvato ✅";
    if (scoreText) scoreText.textContent = "Quiz completato ✅";
    applyScoreFeedback(existing.score);
  } else {
    if (scoreNumber) scoreNumber.textContent = "—";
    if (scoreText) scoreText.textContent = "Completa il quiz per ricevere consigli personalizzati.";
  }

  // Quiz topic tabs
  $$("#quizTabs .tab-btn").forEach(tab => {
    tab.addEventListener("click", () => {
      $$("#quizTabs .tab-btn").forEach(t => t.classList.toggle("is-active", t === tab));
      state.quiz.topic = tab.dataset.quiz;
      state.quiz.idx = 0;
      state.quiz.answers = [];
      state.quiz.finished = false;
      quizData = buildQuiz(state.quiz.topic);
      renderQuestion();
      toast(`Quiz: ${tab.textContent.trim()} 🎯`);
    });
  });

  let selectedIndex = null;

  function applyScoreFeedback(score) {
    if (!tipsEl) return;
    let tips = [];
    if (score >= 85) tips = ["Mantieni l'ascolto 👂","Offri supporto senza invadere 🤝","Valuta l'impatto 🌿"];
    else if (score >= 65) tips = ["Chiedi bisogni specifici ✅","Usa esempi accessibili 🧩","Verifica la partecipazione 🔎"];
    else if (score >= 40) tips = ["Rallenta ⏳","Spiega con parole semplici 🗣️","Correggi con rispetto ✨"];
    else tips = ["Non minimizzare 🛑","Immagina l'esperienza 👀","Passa da 'velocizzare' a 'includere' 🧭"];
    tipsEl.innerHTML = "";
    tips.forEach(t => { const li = document.createElement("li"); li.textContent = t; tipsEl.appendChild(li); });

    // Badge system
    if (badgesEl) {
      const badges = [];
      if (score >= 90) badges.push("🏅 Maestrə dell'inclusione");
      if (score >= 75) badges.push("🌟 Inclusivə avanzatə");
      if (score >= 60) badges.push("🌱 Inclusivə in crescita");
      badgesEl.textContent = badges.length > 0 ? badges.join(" · ") : "Completa altri quiz per badge!";
    }
  }

  function renderQuestion() {
    selectedIndex = null;
    const item = quizData[state.quiz.idx];
    if (!item) return;
    if (promptTitle) promptTitle.textContent = `Domanda ${state.quiz.idx+1} di ${quizData.length} · ${state.quiz.topic}`;
    if (questionEl) questionEl.textContent = item.q;
    if (answersWrap) {
      answersWrap.innerHTML = "";
      item.answers.forEach((a,i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quiz-answer";
        btn.innerHTML = `<div>${escapeHtml(a.text)}</div><small style="display:block;color:rgba(255,255,255,.65);font-weight:900;margin-top:6px">${escapeHtml(a.note)}</small>`;
        btn.addEventListener("click", () => {
          selectedIndex = i;
          $$(".quiz-answer", answersWrap).forEach(x => x.classList.toggle("is-selected", x===btn));
        });
        answersWrap.appendChild(btn);
      });
    }
    if (nextBtn) nextBtn.textContent = (state.quiz.idx === quizData.length-1) ? "Finisci ✅" : "Avanti ➡️";
  }

  formEl?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (selectedIndex === null) { toast("Seleziona un'opzione prima di continuare."); return; }
    const item = quizData[state.quiz.idx];
    const chosen = item.answers[selectedIndex];
    state.quiz.answers.push({ idx: state.quiz.idx, answer: chosen });
    if (state.quiz.idx < quizData.length-1) { state.quiz.idx += 1; renderQuestion(); return; }

    const score = calcScoreFromStateAnswers(state.quiz.answers);
    state.quiz.finished = true;
    saveQuizResult({ score, doneAt: new Date().toISOString(), answers: state.quiz.answers, topic: state.quiz.topic });

    // Track completion
    state.profile.quizCompletions.push({ topic: state.quiz.topic, score, date: new Date().toISOString() });
    if (score >= 75) state.profile.badges.add(`badge_${state.quiz.topic}_${score>=90?'gold':'silver'}`);
    state.profile.globalScore = calcGlobalScore();
    saveProfileData();

    if (scoreNumber) scoreNumber.textContent = `${score}`;
    if (scoreText) scoreText.textContent = "Quiz completato ✅";
    if (scoreValueHome) scoreValueHome.textContent = `${score}`;
    if (scoreHintHome) scoreHintHome.textContent = "Quiz completato ✅";
    applyScoreFeedback(score);
    toast("Quiz completato! 🎉");
    updateProfileUI();
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
    quizData = buildQuiz(state.quiz.topic);
    renderQuestion();
  });

  renderQuestion();
}

function loadQuizResult() {
  try { const raw = localStorage.getItem(quizKey()); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function saveQuizResult(obj) { localStorage.setItem(quizKey(), JSON.stringify(obj)); }

function calcGlobalScore() {
  const scores = state.profile.quizCompletions.map(q => q.score).filter(s => typeof s === 'number');
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a,b) => a+b, 0) / scores.length);
}

/* -------------------- News + Saved articles -------------------- */
function savedNewsKey() { return "tiincludo_saved_news"; }
function loadSavedNews() {
  try {
    const raw = localStorage.getItem(savedNewsKey());
    state.savedNews = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(state.savedNews)) state.savedNews = [];
  } catch { state.savedNews = []; }
}
function saveSavedNews() {
  localStorage.setItem(savedNewsKey(), JSON.stringify(state.savedNews));
}

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
    if (!items || items.length === 0) { if (empty) empty.hidden = false; return; }
    if (empty) empty.hidden = true;
    items.forEach(it => {
      const li = document.createElement("li");
      li.className = "news-item";
      const title = it.title || "Notizia senza titolo";
      const link = it.link || "#";
      const date = it.pubDate || it.date || "";
      const isSaved = state.savedNews.some(s => s.link === link);
      li.innerHTML = `
        <p class="news-title">${escapeHtml(title)}</p>
        <p class="news-meta">${escapeHtml(date ? new Date(date).toLocaleDateString("it-IT") : "Data non disponibile")}</p>
        ${link && link !== "#" ? `<a class="news-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Apri articolo →</a>` : ""}
        <div class="news-actions">
          <button class="btn save-news-btn" data-link="${escapeHtml(link)}" data-title="${escapeHtml(title)}" data-date="${escapeHtml(date)}" style="padding:5px 10px;font-size:.85rem;">
            ${isSaved ? "✅ Salvato" : "💾 Salva"}
          </button>
        </div>
      `;
      list.appendChild(li);
    });

    // Wire save buttons
    $$(".save-news-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const link = btn.dataset.link;
        const title = btn.dataset.title;
        const date = btn.dataset.date;
        if (state.savedNews.some(s => s.link === link)) {
          toast("Già salvato 📥");
          return;
        }
        state.savedNews.push({ link, title, date, savedAt: new Date().toISOString() });
        saveSavedNews();
        btn.textContent = "✅ Salvato";
        toast("Articolo salvato 📥");
        renderSavedNews();
        updateProfileUI();
      });
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
    const list = $("#newsList"); const empty = $("#newsEmpty");
    if (list) list.innerHTML = ""; if (empty) empty.hidden = false; if (statusEl) statusEl.textContent = "Pulito.";
  });

  // Saved news
  const savedList = $("#savedNewsList");
  const savedEmpty = $("#savedNewsEmpty");
  const savedActions = $("#savedNewsActions");
  const clearSavedBtn = $("#clearSavedNewsBtn");
  const viewSavedBtn = $("#viewSavedNewsBtn");
  const savedCountEl = $("#savedCount");
  const exportBtn = $("#exportSavedBtn");

  function renderSavedNews() {
    if (!savedList) return;
    savedList.innerHTML = "";
    if (savedCountEl) savedCountEl.textContent = state.savedNews.length;
    if (state.savedNews.length === 0) {
      if (savedEmpty) savedEmpty.hidden = false;
      if (savedActions) savedActions.hidden = true;
      return;
    }
    if (savedEmpty) savedEmpty.hidden = true;
    if (savedActions) savedActions.hidden = false;
    state.savedNews.forEach((item, idx) => {
      const li = document.createElement("li");
      li.className = "news-item saved-news-item";
      li.innerHTML = `
        <div class="news-content">
          <p class="news-title">${escapeHtml(item.title || "Senza titolo")}</p>
          <p class="news-meta">${escapeHtml(item.date ? new Date(item.date).toLocaleDateString("it-IT") : "Data n.d.")}</p>
          ${item.link && item.link !== "#" ? `<a class="news-link" href="${escapeHtml(item.link)}" target="_blank">Apri →</a>` : ""}
        </div>
        <button class="btn danger remove-saved-btn" data-idx="${idx}" style="padding:5px 8px;font-size:.8rem;">✕</button>
      `;
      savedList.appendChild(li);
    });
    $$(".remove-saved-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        state.savedNews.splice(idx, 1);
        saveSavedNews();
        renderSavedNews();
        toast("Rimosso dai salvati 🧹");
        // Re-render news list to update save button states
        doFetch();
      });
    });
  }

  clearSavedBtn?.addEventListener("click", () => {
    if (!confirm("Svuotare tutti gli articoli salvati?")) return;
    state.savedNews = [];
    saveSavedNews();
    renderSavedNews();
    toast("Salvati svuotati ♻️");
  });

  viewSavedBtn?.addEventListener("click", () => {
    const savedSection = $("#savedNewsList")?.parentElement;
    if (savedSection) savedSection.scrollIntoView({ behavior: "smooth" });
  });

  exportBtn?.addEventListener("click", () => {
    if (state.savedNews.length === 0) { toast("Niente da esportare."); return; }
    const txt = state.savedNews.map(s => `${s.title}\n${s.link}\n${s.date || ""}`).join("\n\n---\n\n");
    try { navigator.clipboard.writeText(txt); toast("Elenco copiato 📋"); }
    catch { toast("Copia manuale 📋"); }
  });

  renderSavedNews();
  loadSavedNews();
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

  const cats = Array.from(new Set(state.dict.map(x => x.categoria))).sort((a,b) => a.localeCompare(b,"it"));
  if (categoryEl) {
    categoryEl.innerHTML = `<option value="tutte">Tutte</option>` + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  }

  const renderResults = (items) => {
    resultsEl.innerHTML = "";
    if (countEl) countEl.textContent = `${items.length} termine${items.length===1?"":"i"}`;
    if (items.length === 0) {
      const li = document.createElement("li"); li.style.cursor = "default";
      li.innerHTML = `<div style="font-weight:1000">Nessun risultato</div><div class="list-meta">Prova un'altra ricerca.</div>`;
      resultsEl.appendChild(li); return;
    }
    items.forEach(item => {
      const li = document.createElement("li"); li.setAttribute("role","listitem"); li.dataset.termId = item.id;
      li.className = item.id === state.selectedTermId ? "is-selected" : "";
      li.innerHTML = `<div style="font-weight:1000">${escapeHtml(item.term)}</div><div style="color:rgba(255,255,255,.70);font-weight:900;font-size:.92rem;margin-top:2px">${escapeHtml(item.categoria||"")} • ${escapeHtml(item.livello||"")}</div>`;
      li.addEventListener("click", () => {
        state.selectedTermId = item.id;
        $$("#dictResults li").forEach(x => x.classList.toggle("is-selected", x.dataset.termId === item.id));
        renderDetail(item);
        initFavoritesUI();
        // Track viewed term
        state.profile.termsViewed.add(item.id);
        saveProfileData();
        updateProfileUI();
      });
      resultsEl.appendChild(li);
    });
  };

  const renderDetail = (item) => {
    if (emptyEl) emptyEl.hidden = true;
    if (detailEl) detailEl.hidden = false;
    if (titleEl) titleEl.textContent = item.term;
    if (metaEl) metaEl.textContent = `${item.categoria||""} • ${item.livello||""}`;
    if (defEl) defEl.textContent = item.definizione || "";
    if (examplesEl) { examplesEl.innerHTML = ""; (item.esempi||[]).forEach(t => { const li = document.createElement("li"); li.textContent = t; examplesEl.appendChild(li); }); }
    if (whenEl) whenEl.textContent = item.quandoUsarlo || "";
    if (synonymsEl) { synonymsEl.innerHTML = ""; (item.sinonimi||[]).forEach(s => { const span = document.createElement("span"); span.textContent = s; synonymsEl.appendChild(span); }); }
    if (favoriteBtn) {
      const inFav = state.favorites.has(item.id);
      favoriteBtn.textContent = inFav ? "⭐" : "☆";
      favoriteBtn.onclick = () => {
        if (state.favorites.has(item.id)) state.favorites.delete(item.id); else state.favorites.add(item.id);
        saveFavorites(); toast(state.favorites.has(item.id) ? "Aggiunto ai preferiti ⭐" : "Rimosso dai preferiti");
        renderDetail(item); initFavoritesUI(); updateProfileUI();
      };
    }
    if (copyBtn) {
      copyBtn.onclick = async () => {
        const txt = `${item.term} — ${item.definizione}\nCategoria: ${item.categoria||""}`;
        try { await navigator.clipboard.writeText(txt); toast("Copiato ✅"); } catch { toast("Copia manuale 📋"); }
      };
    }
  };

  const applyFilters = () => {
    const q = (searchEl?.value||"").trim().toLowerCase();
    const cat = categoryEl?.value || "tutte";
    const filtered = state.dict.filter(item => {
      const matchesQ = !q || (item.term||"").toLowerCase().includes(q) || (item.definizione||"").toLowerCase().includes(q) || (item.categoria||"").toLowerCase().includes(q);
      const matchesCat = (cat === "tutte") || item.categoria === cat;
      return matchesQ && matchesCat;
    });
    renderResults(filtered.slice(0,40));
    if (state.selectedTermId === null && filtered[0]) { state.selectedTermId = filtered[0].id; renderDetail(filtered[0]); }
  };

  searchEl?.addEventListener("input", applyFilters);
  categoryEl?.addEventListener("change", applyFilters);
  resetBtn?.addEventListener("click", () => {
    if (searchEl) searchEl.value = "";
    if (categoryEl) categoryEl.value = "tutte";
    state.selectedTermId = null;
    if (emptyEl) emptyEl.hidden = false;
    if (detailEl) detailEl.hidden = true;
    renderResults(state.dict.slice(0,20));
    applyFilters();
  });

  renderResults(state.dict.slice(0,20));
  applyFilters();
  if (state.favorites.size > 0) {
    const firstFav = state.dict.find(d => state.favorites.has(d.id));
    if (firstFav) { state.selectedTermId = firstFav.id; renderDetail(firstFav); }
  }
}

/* -------------------- Plus features -------------------- */
function initPlusUI() {
  const plusStatus = $("#plusStatus");
  const checkoutBtn = $("#stripeCheckoutBtn");
  const logoutBtn = $("#logoutBtn");
  const openExtendedDictBtn = $("#openExtendedDictBtn");
  const openRewriteBtn = $("#openRewriteBtn");
  const openCorrectionBtn = $("#openCorrectionBtn");
  const openBadgesBtn = $("#openBadgesBtn");
  const syncAllBtn = $("#syncAllBtn");
  const downloadDataBtn = $("#downloadDataBtn");
  const uploadDataBtn = $("#uploadDataBtn");
  const downloadCertBtn = $("#downloadCertBtn");
  const openExtendedDictFromDict = $("#openExtendedDictFromDict");
  const plusFeatures = $("#plusFeatures");
  const logoutBtnFromProfile = $("#logoutBtnFromProfile");

  if (plusFeatures) {
    const features = [
      "📚 Dizionario esteso + aggiungi voce personalizzata",
      "✍️ Generatore risposta inclusiva",
      "🧡 Correzione frasi inclusive",
      "🏅 Gamification: badge e obiettivi",
      "☁️ Sync cloud + download/upload dati",
      "📜 Certificato inclusività personalizzato"
    ];
    plusFeatures.innerHTML = features.map(f => `<li>${escapeHtml(f)}</li>`).join("");
  }

  const setGated = (isPlus) => {
    const gated = !isPlus;
    if (openExtendedDictBtn) openExtendedDictBtn.disabled = gated;
    if (openRewriteBtn) openRewriteBtn.disabled = gated;
    if (openCorrectionBtn) openCorrectionBtn.disabled = gated;
    if (openBadgesBtn) openBadgesBtn.disabled = gated;
    if (syncAllBtn) syncAllBtn.disabled = gated;
    if (downloadDataBtn) downloadDataBtn.disabled = gated;
    if (uploadDataBtn) uploadDataBtn.disabled = gated;
    if (downloadCertBtn) downloadCertBtn.disabled = gated;
    if (openExtendedDictFromDict) openExtendedDictFromDict.disabled = gated;
    if (checkoutBtn) checkoutBtn.disabled = isPlus;
    if (plusStatus) plusStatus.textContent = isPlus ? "Plus sbloccato ✅" : "Plus non sbloccato 💳";
  };

  async function refreshPlus() {
    try {
      const res = await fetch("./auth.php?action=plusStatus", { credentials: "same-origin" });
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      state.plus.isPlus = !!(data && data.plus);
    } catch { state.plus.isPlus = false; }
    setGated(state.plus.isPlus);
  }

  // Logout
  const doLogout = async () => {
    await fetch("./auth.php?action=logout", { method:"POST", credentials:"same-origin" }).catch(()=>{});
    state.plus.isPlus = false;
    setGated(false);
    toast("Disconnesso ✅ Arrivederci!");
    setTimeout(() => window.location.href = "./login.html", 500);
  };

  logoutBtn?.addEventListener("click", doLogout);
  logoutBtnFromProfile?.addEventListener("click", doLogout);

  checkoutBtn?.addEventListener("click", async () => {
    if (state.plus.isPlus) return;
    try {
      checkoutBtn.disabled = true;
      const res = await fetch("./stripe-checkout.php", { method:"POST", credentials:"same-origin" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "checkout error");
      window.location.href = data.checkoutUrl;
    } catch { toast("Errore avvio pagamento."); checkoutBtn.disabled = false; }
  });

  // Extended Dictionary (gated)
  openExtendedDictBtn?.addEventListener("click", () => {
    if (!checkPlus("Dizionario esteso")) return;
    showExtendedDictPanel();
  });
  openExtendedDictFromDict?.addEventListener("click", () => {
    if (!checkPlus("Dizionario esteso")) return;
    showExtendedDictPanel();
  });

  // Rewrite (gated)
  openRewriteBtn?.addEventListener("click", async () => {
    if (!checkPlus("Generatore risposta inclusiva")) return;
    const text = prompt("✍️ Incolla una bozza da rendere più inclusiva:");
    if (!text) return;
    try {
      const res = await fetch("./plus-features.php?action=rewrite", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "rewrite error");
      showResultSheet("Riscrittura inclusiva ✍️", data.rewritten, data.tips);
    } catch { toast("Errore generatore."); }
  });

  // Correction (gated)
  openCorrectionBtn?.addEventListener("click", async () => {
    if (!checkPlus("Correzione frase")) return;
    const text = prompt("🧡 Incolla una frase da correggere in chiave più inclusiva:");
    if (!text) return;
    try {
      const res = await fetch("./plus-features.php?action=rewrite", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "correction error");
      showResultSheet("Correzione inclusiva 🧡", data.rewritten, data.tips);
    } catch { toast("Errore correzione."); }
  });

  // Badges panel (gated)
  openBadgesBtn?.addEventListener("click", () => {
    if (!checkPlus("Badge")) return;
    const badges = Array.from(state.profile.badges);
    const earned = badges.length > 0
      ? badges.map(b => `<li>🏅 ${b.replace('badge_','Quiz: ').replace('_gold',' 🥇').replace('_silver',' 🥈').replace('_bronze',' 🥉')}</li>`).join("")
      : "<li>Nessun badge ancora. Completa quiz con punteggio ≥75.</li>";
    showResultSheet("Badge e obiettivi 🏅",
      `Hai ${badges.length} badge.\n\nCompleta tutti i quiz tematici con punteggio alto per sbloccare più badge! 🌈`,
      badges.length > 0 ? ["Completa tutti i 5 topic per il badge 'Completista' 🏆"] : ["Fai i quiz con ≥75% per badge d'argento", "≥90% per badge d'oro 🥇"]
    );
  });

  // Sync (gated)
  syncAllBtn?.addEventListener("click", async () => {
    if (!checkPlus("Sync")) return;
    try {
      const diary = loadDiary();
      const favorites = Array.from(state.favorites);
      const res = await fetch("./plus-storage.php?action=push", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diaryEntries: diary, favorites })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "sync error");
      toast("Sync completato ☁️✅");
    } catch { toast("Errore sync."); }
  });

  // Download data (gated)
  downloadDataBtn?.addEventListener("click", () => {
    if (!checkPlus("Download dati")) return;
    const data = {
      diary: loadDiary(),
      favorites: Array.from(state.favorites),
      profile: {
        quizCompletions: state.profile.quizCompletions,
        badges: Array.from(state.profile.badges),
        globalScore: state.profile.globalScore
      },
      savedNews: state.savedNews,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tiincludo_backup_${formatISODate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup scaricato ⬇️✅");
  });

  // Upload data (gated)
  uploadDataBtn?.addEventListener("click", () => {
    if (!checkPlus("Upload dati")) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.diary) saveDiary(data.diary);
        if (data.favorites) {
          state.favorites = new Set(data.favorites);
          saveFavorites();
        }
        if (data.savedNews) {
          state.savedNews = data.savedNews;
          saveSavedNews();
        }
        toast("Dati importati ✅ Ricarica la pagina.");
        setTimeout(() => window.location.reload(), 1000);
      } catch { toast("Errore import: file non valido."); }
    };
    input.click();
  });

  // Certificate (gated)
  const downloadCert = () => {
    if (!checkPlus("Certificato")) return;
    downloadCertificato();
  };
  downloadCertBtn?.addEventListener("click", downloadCert);
  $("#downloadCertFromProfile")?.addEventListener("click", downloadCert);

  refreshPlus();
}

function showExtendedDictPanel() {
  const modal = document.createElement('div');
  modal.className = 'sheet';
  const allTerms = state.dict.map(d =>
    `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,.08)">
      <strong>${escapeHtml(d.term)}</strong>
      <span class="muted small"> — ${escapeHtml(d.categoria||"")} • ${escapeHtml(d.livello||"")}</span>
    </div>`
  ).join("");

  modal.innerHTML = `
    <div class="sheet-head">
      <h3>📚 Dizionario esteso (${state.dict.length} termini)</h3>
      <button id="closeExtDict">✕</button>
    </div>
    <div class="sheet-body">
      <div style="max-height:300px;overflow-y:auto;margin-bottom:12px;">${allTerms}</div>
      <h4>Aggiungi un termine personalizzato ✍️</h4>
      <div class="field"><span class="field-label">Termine</span><input type="text" id="extTerm" placeholder="Es. Equità" /></div>
      <div class="field"><span class="field-label">Categoria</span>
        <select id="extCategory">
          <option value="Età">Età</option><option value="Gender">Gender</option>
          <option value="Etnia">Etnia</option><option value="Disabilità">Disabilità</option>
          <option value="Sostenibilità">Sostenibilità</option><option value="Altro">Altro</option>
        </select>
      </div>
      <div class="field"><span class="field-label">Definizione</span><textarea id="extDef" style="height:80px;"></textarea></div>
      <button class="btn primary" id="addTermBtn" style="margin-top:8px;">Aggiungi termine ➕</button>
      <p class="muted small" id="extMsg" style="margin-top:8px;"></p>
    </div>
  `;
  document.body.appendChild(modal);

  $("#closeExtDict").addEventListener("click", () => modal.remove());
  $("#addTermBtn").addEventListener("click", () => {
    const term = $("#extTerm").value.trim();
    const cat = $("#extCategory").value;
    const def = $("#extDef").value.trim();
    if (!term || !def) { $("#extMsg").textContent = "Compila termine e definizione."; return; }
    const newTerm = {
      id: "custom_"+Date.now(),
      term, categoria: cat, livello: "Personalizzato", definizione: def,
      esempi: [], quandoUsarlo: "", sinonimi: [], isPremium: false
    };
    state.dict.push(newTerm);
    const key = "tiincludo_custom_terms";
    try {
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push(newTerm);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch {}
    toast("Termine aggiunto ✅");
    $("#extMsg").textContent = `"${term}" aggiunto al dizionario!`;
    initDictionaryUI();
  });
}

function showResultSheet(title, content, tips) {
  const modal = document.createElement('div');
  modal.className = 'sheet';
  const tipsHtml = tips && tips.length > 0
    ? `<div class="detail-section"><h4>💡 Suggerimenti</h4><ul>${tips.map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>`
    : "";
  modal.innerHTML = `
    <div class="sheet-head"><h3>${escapeHtml(title)}</h3><button id="closeResult">✕</button></div>
    <div class="sheet-body">
      <div style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);">${escapeHtml(content)}</div>
      ${tipsHtml}
      <button class="btn primary" id="copyResult" style="margin-top:12px;">Copia risultato 📋</button>
    </div>
  `;
  document.body.appendChild(modal);
  $("#closeResult").addEventListener("click", () => modal.remove());
  $("#copyResult").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(content); toast("Copiato ✅"); }
    catch { toast("Copia manuale 📋"); }
  });
}

/* -------------------- Certificato -------------------- */
function downloadCertificato() {
  if (!checkPlus("Certificato")) return;
  const score = state.profile.globalScore ?? state.plus.score ?? 0;
  const newWindow = window.open('certificato.html', '_blank');
  // Wait and inject score
  const checkReady = setInterval(() => {
    if (newWindow && newWindow.document && newWindow.document.getElementById('userScoreDisplay')) {
      newWindow.document.getElementById('userScoreDisplay').textContent = score;
      clearInterval(checkReady);
    }
  }, 100);
  setTimeout(() => clearInterval(checkReady), 5000);
  toast("Generazione certificato in corso...");
}

/* -------------------- Profile UI -------------------- */
function updateProfileUI() {
  const globalScore = state.profile.globalScore ?? calcGlobalScore();
  if ($("#profileGlobalScore")) $("#profileGlobalScore").textContent = globalScore !== null ? `${globalScore}/100` : "—";
  if ($("#profileTermsCount")) $("#profileTermsCount").textContent = state.profile.termsViewed.size;
  if ($("#profileFavCount")) $("#profileFavCount").textContent = state.favorites.size;
  if ($("#profileDiaryCount")) $("#profileDiaryCount").textContent = state.profile.diaryEntriesCount;
  if ($("#profileQuizCount")) $("#profileQuizCount").textContent = state.profile.quizCompletions.length;
  if ($("#profileBadges")) $("#profileBadges").textContent = state.profile.badges.size;

  // Home stats
  if ($("#scoreValue") && globalScore !== null) $("#scoreValue").textContent = globalScore;
  if ($("#diaryCountHome")) $("#diaryCountHome").textContent = state.profile.diaryEntriesCount;

  // Cert preview
  if ($("#certPreviewScore")) $("#certPreviewScore").textContent = globalScore !== null ? `${globalScore}/100` : "—";
  if ($("#certPreviewDate")) {
    const today = new Date().toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" });
    $("#certPreviewDate").textContent = today;
  }

  saveProfileData();
}

function initProfileUI() {
  // High contrast toggle
  const hcToggle = $("#highContrastToggle");
  hcToggle?.addEventListener("change", () => {
    document.body.classList.toggle("high-contrast", hcToggle.checked);
    localStorage.setItem('tiincludo_highcontrast', hcToggle.checked ? 'true' : 'false');
  });

  // Theme select
  const themeSelect = $("#themeSelect");
  themeSelect?.addEventListener("change", () => {
    localStorage.setItem('tiincludo_theme', themeSelect.value);
    applyTheme(themeSelect.value);
  });

  // Reset stats
  $("#profileResetBtn")?.addEventListener("click", () => {
    if (!confirm("Resettare tutte le statistiche del profilo?")) return;
    state.profile.termsViewed = new Set();
    state.profile.quizCompletions = [];
    state.profile.badges = new Set();
    state.profile.diaryEntriesCount = 0;
    state.profile.globalScore = null;
    saveProfileData();
    updateProfileUI();
    toast("Statistiche resettate ♻️");
  });

  // Profile button in topbar
  $("#profiloBtn")?.addEventListener("click", () => showView("profilo"));

  updateProfileUI();
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
    if (refreshNews) { showView("news"); $("#fetchNewsBtn")?.click(); return; }

    const jump = e.target.closest("[data-jump]");
    if (jump) { e.preventDefault(); showView(jump.dataset.jump); return; }
  });
}

/* -------------------- Init -------------------- */
async function init() {
  wireNav();
  loadFavorites();
  loadProfileData();
  loadTheme();
  loadSavedNews();
  initOfflineToggle();

  try { if ("serviceWorker" in navigator) await navigator.serviceWorker.register("./service-worker.js"); } catch {}

  try {
    const dict = await loadJSON("./dizionario.json", { items: [] });
    state.dict = Array.isArray(dict.items) ? dict.items : (Array.isArray(dict) ? dict : []);
    // Load custom terms
    try {
      const custom = JSON.parse(localStorage.getItem("tiincludo_custom_terms") || "[]");
      if (Array.isArray(custom)) state.dict.push(...custom);
    } catch {}
  } catch { state.dict = []; }

  initDictionaryUI();
  initFavoritesUI();
  initDiaryUI();
  initQuizUI();
  initNewsUI();
  initPlusUI();
  initProfileUI();
}

init();