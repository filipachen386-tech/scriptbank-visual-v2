const state = {
  scripts: [],
  filtered: [],
  authenticated: false,
};

const els = {
  flash: document.getElementById("flash"),
  scriptsContainer: document.getElementById("scripts-container"),
  emptyState: document.getElementById("empty-state"),
  month: document.getElementById("filter-month"),
  grandTheme: document.getElementById("filter-grand-theme"),
  category: document.getElementById("filter-category"),
  keyword: document.getElementById("filter-keyword"),
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
  for (const el of [els.month, els.grandTheme, els.category, els.keyword]) {
    el.addEventListener("input", applyFilters);
    el.addEventListener("change", applyFilters);
  }

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
  const response = await fetch("/api/auth-status");
  const data = await response.json();
  state.authenticated = !!data.authenticated;
  els.logoutButton.classList.toggle("hidden", !state.authenticated);
  if (!state.authenticated) {
    els.adminPanel.classList.add("hidden");
  }
}

async function refreshScripts() {
  const response = await fetch("/api/scripts");
  const data = await response.json();
  state.scripts = Array.isArray(data.scripts) ? data.scripts : [];
  populateFilters();
  applyFilters();
}

function populateFilters() {
  fillSelect(els.month, "Todos os Meses", uniqueValues(state.scripts.map((item) => item.month)));
  fillSelect(
    els.grandTheme,
    "Todos os Grandes Temas",
    uniqueValues(state.scripts.map((item) => item.grand_theme || item.category)),
  );
  fillSelect(els.category, "Todas as Categorias", uniqueValues(state.scripts.map((item) => item.category)));
}

function fillSelect(select, defaultLabel, values) {
  const current = select.value;
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  select.appendChild(defaultOption);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === current;
    select.appendChild(option);
  });
}

function uniqueValues(values) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function applyFilters() {
  const month = els.month.value.trim();
  const grandTheme = els.grandTheme.value.trim();
  const category = els.category.value.trim();
  const keyword = els.keyword.value.trim().toLowerCase();

  state.filtered = state.scripts.filter((item) => {
    const haystack = [
      item.title,
      item.summary,
      item.hook,
      item.month,
      item.grand_theme,
      item.category,
      ...(item.tags || []),
      ...(item.character_profiles || []),
      ...(item.timeline || []),
      ...(item.replaceable_elements || []),
      ...((item.replaceable_sections || []).flatMap((section) => [section.title, ...(section.items || [])])),
    ]
      .join(" ")
      .toLowerCase();

    if (month && item.month !== month) return false;
    if (grandTheme && (item.grand_theme || item.category) !== grandTheme) return false;
    if (category && item.category !== category) return false;
    if (keyword && !haystack.includes(keyword)) return false;
    return true;
  });

  renderScripts();
}

function renderScripts() {
  els.scriptsContainer.innerHTML = "";
  els.emptyState.classList.toggle("hidden", state.filtered.length > 0);
  if (!state.filtered.length) return;

  state.filtered.forEach((item, index) => {
    const article = document.createElement("article");
    article.className = "script-card bg-white rounded-2xl card-shadow overflow-hidden border border-gray-100 transition-all duration-300 shadow-sm";
    article.innerHTML = `
      <div class="p-6 cursor-pointer hover:bg-gray-50 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white text-justify">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">${index + 1}</div>
          <div>
            <h2 class="text-xl font-bold text-gray-900 uppercase">${escapeHtml(item.title)}</h2>
            <p class="text-gray-500 text-sm italic">${escapeHtml(item.month || "Sem mês")} | ${escapeHtml(item.grand_theme || item.category || "Sem grande tema")} | ${escapeHtml(item.category || "Sem categoria")}</p>
          </div>
        </div>
        <i class="fa-solid fa-chevron-down text-gray-400 chevron-icon transition-transform duration-300"></i>
      </div>
      <div class="script-content border-t bg-white">
        <div class="p-6 bg-slate-50 border-b flex flex-wrap justify-between gap-3">
          <div class="flex flex-wrap gap-2">${renderTags(item.tags || [])}</div>
          <div class="flex flex-wrap gap-3">
            ${item.source_url ? `<button data-copy="${escapeAttribute(item.source_url)}" class="copy-button text-blue-600 bg-white px-5 py-2.5 rounded-lg border border-blue-200 shadow-sm font-semibold"><i class="fa-solid fa-copy"></i> Copiar Link</button>` : ""}
            ${item.source_url ? `<a href="${escapeAttribute(item.source_url)}" target="_blank" class="text-orange-500 bg-white px-5 py-2.5 rounded-lg border border-orange-200 shadow-sm font-semibold"><i class="fa-solid fa-play"></i> Assistir</a>` : ""}
            ${state.authenticated ? `<button data-delete="${escapeAttribute(item.id)}" class="delete-button text-red-600 bg-white px-5 py-2.5 rounded-lg border border-red-200 shadow-sm font-semibold"><i class="fa-solid fa-trash"></i> Excluir Script</button>` : ""}
          </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x">
          <div class="p-6 space-y-8 bg-gray-50/20">
            <section>
              <h3 class="text-blue-800 font-bold text-lg mb-4 border-b pb-2"><i class="fa-solid fa-users"></i> Perfis de Personagem</h3>
              <div class="space-y-4 text-sm text-gray-700 text-justify">${renderParagraphs(item.character_profiles, "Nenhum perfil cadastrado.")}</div>
            </section>
            <section>
              <h3 class="text-green-800 font-bold text-lg mb-4 border-b pb-2"><i class="fa-solid fa-clock"></i> Ritmo (Timeline)</h3>
              <div class="space-y-3 text-xs text-gray-700 text-justify font-medium">${renderParagraphs(item.timeline, "Nenhuma timeline cadastrada.")}</div>
            </section>
          </div>
          <div class="lg:col-span-2 p-6 space-y-8">
            <section>
              <h3 class="text-purple-800 font-bold text-lg mb-4">Elementos Substituíveis</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                <div class="bg-purple-50/50 p-4 rounded-xl border border-purple-100 md:col-span-2">
                  <p class="font-bold mb-2 uppercase text-xs text-purple-900">Link e Contexto</p>
                  <div class="space-y-3 text-gray-700">
                    <p><strong>Mês:</strong> ${escapeHtml(item.month || "Sem mês")}</p>
                    <p><strong>Grande Tema:</strong> ${escapeHtml(item.grand_theme || item.category || "Sem grande tema")}</p>
                    <p><strong>Categoria:</strong> ${escapeHtml(item.category || "Sem categoria")}</p>
                    <p><strong>Link Exemplo:</strong> ${item.source_url ? `<a href="${escapeAttribute(item.source_url)}" target="_blank" class="text-blue-600 underline break-all">${escapeHtml(item.source_url)}</a>` : "Sem link cadastrado."}</p>
                  </div>
                </div>
                ${renderReplaceableSections(item.replaceable_sections || [], item.replaceable_elements || [])}
                <div class="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <p class="font-bold mb-2 uppercase text-xs text-blue-900">Observações e Direção</p>
                  ${renderList(item.notes || [], "Nenhuma nota adicional cadastrada.")}
                </div>
                <div class="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                  <p class="font-bold mb-2 uppercase text-xs text-emerald-900">Estrutura Base</p>
                  <ul class="space-y-2 text-gray-700">
                    <li>Mês: ${escapeHtml(item.month || "Sem mês")}</li>
                    <li>Grande Tema: ${escapeHtml(item.grand_theme || item.category || "Sem grande tema")}</li>
                    <li>Categoria: ${escapeHtml(item.category || "Sem categoria")}</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    `;

    const header = article.firstElementChild;
    header.addEventListener("click", () => article.classList.toggle("active"));

    const copyButton = article.querySelector(".copy-button");
    if (copyButton) {
      copyButton.addEventListener("click", (event) => {
        event.stopPropagation();
        copyLink(copyButton.dataset.copy || "");
      });
    }

    const deleteButton = article.querySelector(".delete-button");
    if (deleteButton) {
      deleteButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (!window.confirm("Tem certeza de que deseja excluir este script?")) return;
        const response = await fetch("/api/delete-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script_id: deleteButton.dataset.delete }),
        });
        if (!response.ok) {
          showFlash("Não foi possível excluir o script.", true);
          return;
        }
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
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    els.passwordError.textContent = "Senha incorreta. Tente novamente.";
    els.passwordError.classList.remove("hidden");
    return;
  }
  closeModal();
  await refreshAuth();
  els.adminPanel.classList.remove("hidden");
  showFlash("Acesso liberado.");
}

async function importMarkdown() {
  const markdown = els.markdownContent.value.trim();
  if (!markdown) {
    showFlash("Cole um Markdown antes de importar.", true);
    return;
  }
  const response = await fetch("/api/import-markdown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown }),
  });
  const data = await response.json();
  if (!response.ok) {
    showFlash(data.error || "Falha ao importar Markdown.", true);
    return;
  }
  els.markdownContent.value = "";
  els.markdownFile.value = "";
  showFlash(`${data.count} scripts importados com sucesso.`);
  await refreshScripts();
}

async function importJson() {
  const file = els.jsonFile.files?.[0];
  if (!file) {
    showFlash("Selecione um arquivo JSON.", true);
    return;
  }
  const text = await file.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    showFlash("JSON inválido.", true);
    return;
  }
  const response = await fetch("/api/import-json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    showFlash(data.error || "Falha ao importar JSON.", true);
    return;
  }
  els.jsonFile.value = "";
  showFlash(`${data.count} scripts importados com sucesso do JSON.`);
  await refreshScripts();
}

function openModal() {
  els.passwordInput.value = "";
  els.passwordError.classList.add("hidden");
  els.modal.classList.remove("hidden");
}

function closeModal() {
  els.modal.classList.add("hidden");
}

function showFlash(message, isError = false) {
  els.flash.className = `mb-6 ${isError ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"} px-5 py-4 rounded-xl card-shadow`;
  els.flash.textContent = message;
  els.flash.classList.remove("hidden");
}

function renderTags(tags) {
  if (!tags.length) {
    return "<span class='text-xs text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm'>Sem tags</span>";
  }
  return tags
    .map((tag) => `<span class="text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">${escapeHtml(tag)}</span>`)
    .join("");
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
    return `
      <div class="bg-purple-50/50 p-4 rounded-xl border border-purple-100 md:col-span-2">
        <p class="font-bold mb-2 uppercase text-xs text-purple-900">Elementos Variáveis</p>
        ${renderList(fallback, "Nenhum elemento substituível cadastrado.")}
      </div>
    `;
  }

  return sections
    .map((section) => `
      <div class="bg-purple-50/50 p-4 rounded-xl border border-purple-100 ${section.items.length > 3 ? "md:col-span-2" : ""}">
        <p class="font-bold mb-2 uppercase text-xs text-purple-900">${escapeHtml(section.title)}</p>
        ${renderList(section.items, "Nenhum item cadastrado.")}
      </div>
    `)
    .join("");
}

async function copyLink(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
  const toast = document.getElementById("toast");
  toast.className = "copy-toast show";
  setTimeout(() => {
    toast.className = "copy-toast";
  }, 3000);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
