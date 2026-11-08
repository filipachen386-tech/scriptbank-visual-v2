const state = {
  scripts: [],
  filtered: [],
  authenticated: false,
  bookmarks: JSON.parse(localStorage.getItem("sbv_bookmarks") || "{}"),
  bookmarkFilterOn: false,
};

const MONTH_ORDER = ["Agosto", "Setembro", "Outubro", "Novembro"];
const GRAND_THEME_ORDER = ["Drama Familiar", "Drama de Relacionamento", "Drama de Humor", "Drama Social", "Drama de Suspense"];
const THEME_LABEL_ORDER = [
  "Humilhação e superação familiar",
  "Golpes e exploração na família",
  "Poder e favoritismo familiar",
  "Conflitos geracionais e dependência financeira",
  "Herança e natureza humana",
  "Traição amorosa em público",
  "Manipulação emocional",
  "Dinheiro x sentimentos",
  "Controle e dependência",
  "Preconceito e virada de identidade",
  "Mal-entendidos e reviravoltas",
  "Ostentação e arrogância expostas",
  "Brincadeiras de casal",
  "Crítica ao materialismo e preconceito",
  "Humor do cotidiano no interior",
  "Dilemas morais e escolhas",
  "Amizade e traição",
  "Pressão social e reflexão",
  "Pais, filhos e amadurecimento",
  "Autoconhecimento e valores pessoais",
  "Mentiras e quebra de confiança",
  "Identidade e pertencimento",
  "Falhas de comunicação",
  "Crises e autoproteção",
  "Jogos psicológicos e conflitos sociais",
];
const THEME_LABEL_MIGRATION = {
  "Humilhação e superação de familiares vulneráveis": "Humilhação e superação familiar",
  "Engano familiar e exploração financeira": "Golpes e exploração na família",
  "Disputas de poder e favoritismo na família": "Poder e favoritismo familiar",
  "Conflitos entre gerações e dependência financeira": "Conflitos geracionais e dependência financeira",
  "Herança familiar e teste à natureza humana": "Herança e natureza humana",
  "Traição amorosa e flagrante em público": "Traição amorosa em público",
  "Manipulação e engano emocional": "Manipulação emocional",
  "Conflitos entre dinheiro e sentimentos": "Dinheiro x sentimentos",
  "Relações de controle e dependência": "Controle e dependência",
  "Preconceito social e reviravolta de identidade": "Preconceito e virada de identidade",
  "Mal-entendidos e reviravoltas inesperadas": "Mal-entendidos e reviravoltas",
  "Ostentação e arrogância desmascaradas": "Ostentação e arrogância expostas",
  "Brincadeiras entre casais": "Brincadeiras de casal",
  "Crítica ao materialismo e ao preconceito social": "Crítica ao materialismo e preconceito",
  "Dilemas morais e escolhas difíceis": "Dilemas morais e escolhas",
  "Amizade, confiança e traição": "Amizade e traição",
  "Pressão social e reflexão coletiva": "Pressão social e reflexão",
  "Relação entre pais e filhos e amadurecimento": "Pais, filhos e amadurecimento",
  "Autoconhecimento e construção de valores pessoais": "Autoconhecimento e valores pessoais",
  "Mentiras reveladas e quebra de confiança": "Mentiras e quebra de confiança",
  "Mistério de identidade e sentimento de pertencimento": "Identidade e pertencimento",
  "Mal-entendidos e falta de comunicação": "Falhas de comunicação",
  "Situações de crise e autoproteção": "Crises e autoproteção",
  "Jogos psicológicos e desafios nas relações sociais": "Jogos psicológicos e conflitos sociais",
};
const PERSONA_ORDER = [
  "Familiar que luta",
  "Cônjuge traído",
  "Mulher forte",
  "Protetor da família",
  "Casal engraçado",
  "Pessoa absurda",
  "Pessoa firme e justa",
  "Parente defensor",
  "Cônjuge enganado",
  "Profissional honesto",
  "Pessoa solidária",
  "Pessoa superadora",
  "Familiar discreto",
  "Familiar maltratado",
  "Profissional injustiçado",
  "Familiar carinhoso",
];

function saveBookmarks() {
  localStorage.setItem("sbv_bookmarks", JSON.stringify(state.bookmarks));
}

function toggleBookmark(key) {
  state.bookmarks[key] = !state.bookmarks[key];
  if (!state.bookmarks[key]) delete state.bookmarks[key];
  saveBookmarks();
  renderScripts();
}

const els = {
  flash: document.getElementById("flash"),
  scriptsContainer: document.getElementById("scripts-container"),
  emptyState: document.getElementById("empty-state"),
  month: document.getElementById("filter-month"),
  grandTheme: document.getElementById("filter-grand-theme"),
  themeLabel: document.getElementById("filter-theme-label"),
  persona: document.getElementById("filter-persona"),
  category: document.getElementById("filter-category"),
  keyword: document.getElementById("filter-keyword"),
  bookmarkBtn: document.getElementById("filter-bookmarked"),
  adminPanel: document.getElementById("admin-panel"),
  openAdminButton: document.getElementById("open-admin-button"),
  logoutButton: document.getElementById("logout-button"),
  modal: document.getElementById("password-modal"),
  passwordInput: document.getElementById("password-input"),
  passwordError: document.getElementById("password-error"),
  loginButton: document.getElementById("login-button"),
  closeModalButton: document.getElementById("close-modal-button"),
  markdownFile: document.getElementById("markdown-file"),
  markdownContent: document.getElementById("markdown-content"),
  importMarkdownButton: document.getElementById("import-markdown-button"),
  jsonFile: document.getElementById("json-file"),
  importJsonButton: document.getElementById("import-json-button"),
};

init();

async function init() {
  bindEvents();
  await refreshAuth();
  await refreshScripts();
}

function bindEvents() {
  for (const el of [els.month, els.themeLabel, els.persona, els.category, els.keyword]) {
    el.addEventListener("input", applyFilters);
    el.addEventListener("change", applyFilters);
  }
  els.grandTheme.addEventListener("change", () => {
    populateThemeLabels();
    applyFilters();
  });

  els.bookmarkBtn?.addEventListener("click", () => {
    state.bookmarkFilterOn = !state.bookmarkFilterOn;
    if (state.bookmarkFilterOn) {
      els.bookmarkBtn.classList.add("bg-rose-50", "border-rose-200");
      els.bookmarkBtn.classList.remove("bg-gray-50");
      els.bookmarkBtn.innerHTML = '<i class="fa-solid fa-heart text-rose-500 mr-1"></i> Favoritos';
    } else {
      els.bookmarkBtn.classList.remove("bg-rose-50", "border-rose-200");
      els.bookmarkBtn.classList.add("bg-gray-50");
      els.bookmarkBtn.innerHTML = '<i class="fa-regular fa-heart text-rose-400 mr-1"></i> Favoritos';
    }
    applyFilters();
  });

  els.openAdminButton.addEventListener("click", () => {
    if (state.authenticated) {
      els.adminPanel.classList.toggle("hidden");
      return;
    }
    openModal();
  });

  els.logoutButton.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    await refreshAuth();
    showFlash("Sessão encerrada.");
  });

  els.closeModalButton.addEventListener("click", closeModal);
  els.loginButton.addEventListener("click", submitLogin);
  els.passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitLogin();
  });

  els.markdownFile.addEventListener("change", async () => {
    const file = els.markdownFile.files?.[0];
    if (!file) return;
    els.markdownContent.value = await file.text();
  });

  els.importMarkdownButton.addEventListener("click", importMarkdown);
  els.importJsonButton.addEventListener("click", importJson);
}

async function refreshAuth() {
  const data = await apiFetchJson("/api/auth-status");
  state.authenticated = !!data.authenticated;
  els.logoutButton.classList.toggle("hidden", !state.authenticated);
  if (!state.authenticated) {
    els.adminPanel.classList.add("hidden");
  }
}

async function refreshScripts() {
  const data = await apiFetchJson("/api/scripts");
  state.scripts = Array.isArray(data.scripts) ? data.scripts.map((item) => ({ ...item, theme_label: normalizeThemeLabel(item.theme_label) })) : [];
  populateFilters();
  applyFilters();
}

function normalizeThemeLabel(value) {
  const label = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(THEME_LABEL_MIGRATION, label) ? THEME_LABEL_MIGRATION[label] : label;
}

function populateFilters() {
  fillSelect(els.month, "Todos os Meses", orderedValues(state.scripts.map((item) => item.month), MONTH_ORDER));
  fillSelect(els.grandTheme, "Todos os Grandes Temas", orderedValues(state.scripts.map((item) => item.grand_theme || item.category), GRAND_THEME_ORDER));
  populateThemeLabels();
  fillSelect(els.persona, "Todos os Personagens", orderedValues(state.scripts.map((item) => item.persona), PERSONA_ORDER));
  fillSelect(els.category, "Todas as Categorias", uniqueValues(state.scripts.map((item) => item.category)));
}

function populateThemeLabels() {
  const grandTheme = els.grandTheme.value.trim();
  const themeIndex = GRAND_THEME_ORDER.indexOf(grandTheme);
  const labels = themeIndex >= 0 ? THEME_LABEL_ORDER.slice(themeIndex * 5, themeIndex * 5 + 5) : THEME_LABEL_ORDER;
  fillSelect(els.themeLabel, "Todos os Rótulos do Tema", labels);
}

function fillSelect(select, defaultLabel, values) {
  const current = select.value;
  select.innerHTML = "";
  const d = document.createElement("option"); d.value = ""; d.textContent = defaultLabel; select.appendChild(d);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value; option.textContent = value; option.selected = value === current;
    select.appendChild(option);
  });
}

function uniqueValues(values) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function orderedValues(values, preferredOrder) {
  const available = uniqueValues(values);
  const order = new Map(preferredOrder.map((value, index) => [value, index]));
  return available.sort((a, b) => {
    const aIndex = order.has(a) ? order.get(a) : preferredOrder.length;
    const bIndex = order.has(b) ? order.get(b) : preferredOrder.length;
    return aIndex - bIndex || a.localeCompare(b);
  });
}

function applyFilters() {
  const month = els.month.value.trim();
  const grandTheme = els.grandTheme.value.trim();
  const themeLabel = els.themeLabel.value.trim();
  const persona = els.persona.value.trim();
  const category = els.category.value.trim();
  const keyword = els.keyword.value.trim().toLowerCase();

  state.filtered = state.scripts.filter((item) => {
    if (state.bookmarkFilterOn) {
      const bk = (item.month || "") + "|" + (item.title || "");
      if (!state.bookmarks[bk]) return false;
    }
    const haystack = [
      item.title, item.summary, item.hook, item.month, item.grand_theme, item.theme_label, item.category,
      item.persona, item.descricao_conteudo, item.ponto_viral,
      ...(item.tags || []), ...(item.character_profiles || []),
      ...(item.timeline || []), ...(item.replaceable_elements || []),
      ...((item.replaceable_sections || []).flatMap((section) => [section.title, ...(section.items || [])])),
    ].join(" ").toLowerCase();
    if (month && item.month !== month) return false;
    if (grandTheme && (item.grand_theme || item.category) !== grandTheme) return false;
    if (themeLabel && item.theme_label !== themeLabel) return false;
    if (persona && item.persona !== persona) return false;
    if (category && item.category !== category) return false;
    if (keyword && !haystack.includes(keyword)) return false;
    return true;
  }).sort(compareScripts);
  renderScripts();
}

function compareScripts(a, b) {
  const scoreDifference = (Number(b.weighted_score) || 0) - (Number(a.weighted_score) || 0);
  if (scoreDifference) return scoreDifference;
  const createdDifference = String(b.created_at || "").localeCompare(String(a.created_at || ""));
  if (createdDifference) return createdDifference;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

function renderScripts() {
  els.scriptsContainer.innerHTML = "";
  els.emptyState.classList.toggle("hidden", state.filtered.length > 0);
  if (!state.filtered.length) return;

  state.filtered.forEach((item, index) => {
    const article = document.createElement("article");
    article.className = "script-card bg-white rounded-2xl card-shadow overflow-hidden border border-gray-100 transition-all duration-300 shadow-sm";
    const bmKey = (item.month || "") + "|" + (item.title || "");
    const isBookmarked = !!state.bookmarks[bmKey];

    const linkBarHtml = `<div class="p-4 bg-slate-50 border-b"><div class="flex flex-wrap items-center gap-3">
      <span class="text-sm font-semibold text-gray-600"><i class="fa-solid fa-video"></i> Link do Vídeo:</span>
      ${item.source_url
        ? `<a href="${escapeAttribute(item.source_url)}" target="_blank" class="text-blue-600 underline break-all text-sm">${escapeHtml(item.source_url)}</a>
           <button data-copy="${escapeAttribute(item.source_url)}" class="copy-button text-blue-600 bg-white px-4 py-1.5 rounded-lg border border-blue-200 shadow-sm font-semibold text-sm"><i class="fa-solid fa-copy"></i> Copiar</button>
           <a href="${escapeAttribute(item.source_url)}" target="_blank" class="text-orange-500 bg-white px-4 py-1.5 rounded-lg border border-orange-200 shadow-sm font-semibold text-sm"><i class="fa-solid fa-play"></i> Assistir</a>`
        : `<span class="text-gray-400 text-sm italic">Sem link cadastrado</span>`}
      ${state.authenticated ? `<button data-delete="${escapeAttribute(item.id)}" class="delete-button text-red-600 bg-white px-4 py-1.5 rounded-lg border border-red-200 shadow-sm font-semibold text-sm"><i class="fa-solid fa-trash"></i> Excluir</button>` : ""}
    </div></div>`;

    article.innerHTML = `
      <div class="p-6 cursor-pointer hover:bg-gray-50 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white text-justify">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">${index + 1}</div>
          <div>
            <h2 class="text-xl font-bold text-gray-900 uppercase">${escapeHtml(item.title)}</h2>
            <p class="text-gray-500 text-sm italic">${escapeHtml(item.month || "Sem mês")} | ${escapeHtml(item.grand_theme || item.category || "Sem grande tema")} | ${item.persona ? escapeHtml(item.persona) + " | " : ""}${escapeHtml(item.category || "Sem categoria")}</p>
            ${item.theme_label ? `<p class="text-blue-700 text-sm mt-1"><span class="font-semibold">Rótulo do tema:</span> ${escapeHtml(item.theme_label)}</p>` : ""}
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button data-bmkey="${escapeHtml(bmKey)}" class="bookmark-btn text-2xl ${isBookmarked ? "active" : ""}" title="Favoritar"><i class="fa-${isBookmarked ? "solid" : "regular"} fa-heart"></i></button>
          <i class="fa-solid fa-chevron-down text-gray-400 chevron-icon transition-transform duration-300"></i>
        </div>
      </div>
      <div class="script-content border-t bg-white">
        ${linkBarHtml}
        <div class="p-6 space-y-8">
          ${renderLeftSidebar(item)}
          <section>
            <h3 class="text-purple-800 font-bold text-lg mb-4">Elementos Substituíveis</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              ${renderReplaceableSections(item.replaceable_sections || [], item.replaceable_elements || [])}
            </div>
          </section>
        </div>
      </div>`;

    const header = article.firstElementChild;
    header.addEventListener("click", (e) => {
      if (e.target.closest(".bookmark-btn")) return;
      article.classList.toggle("active");
    });

    const bmBtn = article.querySelector(".bookmark-btn");
    if (bmBtn) bmBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleBookmark(bmBtn.dataset.bmkey || ""); });

    const copyButton = article.querySelector(".copy-button");
    if (copyButton) copyButton.addEventListener("click", (event) => { event.stopPropagation(); copyLink(copyButton.dataset.copy || ""); });

    const deleteButton = article.querySelector(".delete-button");
    if (deleteButton) {
      deleteButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (!window.confirm("Tem certeza de que deseja excluir este script?")) return;
        const response = await fetch("/api/delete-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script_id: deleteButton.dataset.delete }) });
        if (!response.ok) { showFlash("Não foi possível excluir o script.", true); return; }
        showFlash("Script removido com sucesso.");
        await refreshScripts();
      });
    }

    els.scriptsContainer.appendChild(article);
  });
}
async function submitLogin() {
  const password = els.passwordInput.value.trim();
  els.passwordError.classList.add("hidden");
  try {
    await apiFetchJson("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  } catch (error) {
    els.passwordError.textContent = error?.message || "Senha incorreta. Tente novamente.";
    els.passwordError.classList.remove("hidden"); return;
  }
  closeModal(); await refreshAuth(); els.adminPanel.classList.remove("hidden"); showFlash("Acesso liberado.");
}

async function importMarkdown() {
  const markdown = els.markdownContent.value.trim();
  if (!markdown) { showFlash("Cole um Markdown antes de importar.", true); return; }
  els.importMarkdownButton.disabled = true;
  els.importMarkdownButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importando...';
  try {
    const data = await apiFetchJson("/api/import-markdown", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markdown }) });
    els.markdownContent.value = ""; els.markdownFile.value = "";
    showFlash(`${data.count} scripts importados com sucesso.`);
    await refreshScripts();
  } catch (error) { showFlash(`Falha: ${error?.message || "erro desconhecido"}`, true); }
  finally { els.importMarkdownButton.disabled = false; els.importMarkdownButton.innerHTML = '<i class="fa-solid fa-file-import"></i> Importar Markdown'; }
}

async function importJson() {
  const file = els.jsonFile.files?.[0];
  if (!file) { showFlash("Selecione um arquivo JSON.", true); return; }
  const text = await file.text();
  let payload; try { payload = JSON.parse(text); } catch { showFlash("JSON inválido.", true); return; }
  try {
    const data = await apiFetchJson("/api/import-json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    els.jsonFile.value = ""; showFlash(`${data.count} scripts importados do JSON.`); await refreshScripts();
  } catch (error) { showFlash(error?.message || "Falha ao importar JSON.", true); }
}

function openModal() { els.passwordInput.value = ""; els.passwordError.classList.add("hidden"); els.modal.classList.remove("hidden"); }
function closeModal() { els.modal.classList.add("hidden"); }
function showFlash(message, isError = false) {
  els.flash.className = `mb-6 ${isError ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"} px-5 py-4 rounded-xl card-shadow`;
  els.flash.textContent = message; els.flash.classList.remove("hidden");
  els.flash.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function apiFetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  let data = null, text = "";
  if (contentType.includes("application/json")) { data = await response.json().catch(() => null); }
  else { text = await response.text().catch(() => ""); }
  if (!response.ok) {
    const error = new Error(data?.error || extractHtmlTitle(text) || `HTTP ${response.status}`);
    error.status = response.status; error.payload = data; error.rawText = text; throw error;
  }
  if (data) return data; throw new Error("Resposta não veio em JSON.");
}

function extractHtmlTitle(t) { const m = String(t || "").match(/<title>([^<]+)<\/title>/i); return m ? m[1].trim() : ""; }
function parsePontoViralSections(text) {
  const sections = [], titleRegex = /([A-Z][A-Za-zÀ-ÿ\s]+(?:\([^)]+\))?\s*):\s*/g;
  let match; const positions = [];
  while ((match = titleRegex.exec(text)) !== null) positions.push({ title: match[1].trim(), index: match.index, end: match.index + match[0].length });
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].end, end = i + 1 < positions.length ? positions[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    if (content) sections.push({ title: positions[i].title, content });
  }
  return sections;
}

function renderLeftSidebar(item) {
  const hasNewFields = item.descricao_conteudo || item.ponto_viral;
  if (hasNewFields) {
    let html = "";
    if (item.descricao_conteudo) {
      html += `<section><h3 class="text-amber-800 font-bold text-lg mb-4 border-b pb-2"><i class="fa-solid fa-file-lines"></i> Descrição do Conteúdo</h3><div class="space-y-4 text-sm text-gray-700 text-justify leading-7">${escapeHtml(item.descricao_conteudo)}</div></section>`;
    }
    if (item.ponto_viral) {
      const viralSections = parsePontoViralSections(item.ponto_viral);
      if (viralSections.length > 1) {
        html += `<section><h3 class="text-rose-800 font-bold text-lg mb-4 border-b pb-2"><i class="fa-solid fa-fire"></i> Ponto Viral do Vídeo</h3><div class="space-y-3">${viralSections.map(s => `<div class="mb-4"><p class="font-bold text-rose-700 text-sm mb-1">${escapeHtml(s.title)}:</p><p class="text-sm text-gray-700 text-justify leading-6">${escapeHtml(s.content)}</p></div>`).join("")}</div></section>`;
      } else {
        html += `<section><h3 class="text-rose-800 font-bold text-lg mb-4 border-b pb-2"><i class="fa-solid fa-fire"></i> Ponto Viral do Vídeo</h3><div class="space-y-4 text-sm text-gray-700 text-justify leading-7">${escapeHtml(item.ponto_viral)}</div></section>`;
      }
    }
    html += `<section><h3 class="text-green-800 font-bold text-lg mb-4 border-b pb-2"><i class="fa-solid fa-clock"></i> Ritmo (Timeline)</h3><div class="space-y-3 text-xs text-gray-700 text-justify font-medium">${renderParagraphs(item.timeline, "Nenhuma timeline cadastrada.")}</div></section>`;
    return html;
  }
  return `<section><h3 class="text-blue-800 font-bold text-lg mb-4 border-b pb-2"><i class="fa-solid fa-users"></i> Perfis de Personagem</h3><div class="space-y-4 text-sm text-gray-700 text-justify">${renderParagraphs(item.character_profiles, "Nenhum perfil cadastrado.")}</div></section><section><h3 class="text-green-800 font-bold text-lg mb-4 border-b pb-2"><i class="fa-solid fa-clock"></i> Ritmo (Timeline)</h3><div class="space-y-3 text-xs text-gray-700 text-justify font-medium">${renderParagraphs(item.timeline, "Nenhuma timeline cadastrada.")}</div></section>`;
}

function renderParagraphs(items = [], emptyText) {
  if (!items.length) return `<p class="text-gray-500 text-sm">${escapeHtml(emptyText)}</p>`;
  return items.map((item) => `<p class="leading-7">${escapeHtml(item)}</p>`).join("");
}

function renderList(items = [], emptyText) {
  if (!items.length) return `<p class="text-gray-500 text-sm">${escapeHtml(emptyText)}</p>`;
  return `<ul class="space-y-2 text-gray-700">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderReplaceableSections(sections = [], fallback = []) {
  if (!sections.length) {
    return `<div class="bg-purple-50/50 p-4 rounded-xl border border-purple-100 md:col-span-2"><p class="font-bold mb-2 uppercase text-xs text-purple-900">Elementos Variáveis</p>${renderList(fallback, "Nenhum elemento substituível cadastrado.")}</div>`;
  }
  return sections.map((section) => `<div class="bg-purple-50/50 p-4 rounded-xl border border-purple-100 ${section.items.length > 3 ? "md:col-span-2" : ""}"><p class="font-bold mb-2 uppercase text-xs text-purple-900">${escapeHtml(section.title)}</p>${renderList(section.items, "Nenhum item cadastrado.")}</div>`).join("");
}

async function copyLink(text) {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); } catch { const el = document.createElement("textarea"); el.value = text; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); }
  const toast = document.getElementById("toast"); toast.className = "copy-toast show"; setTimeout(() => { toast.className = "copy-toast"; }, 3000);
}

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function escapeAttribute(value) { return escapeHtml(value); }
