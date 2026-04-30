const COOKIE_NAME = "scriptbank_upload_auth";
const DEFAULT_PASSWORD = "kwai666";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, url) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (url.pathname === "/api/scripts" && request.method === "GET") {
    await ensureSchema(env);
    const scripts = await listScripts(env);
    return json({ scripts });
  }

  if (url.pathname === "/api/auth-status" && request.method === "GET") {
    return json({ authenticated: isAuthenticated(request) });
  }

  if (url.pathname === "/api/login" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const password = String(body.password || "").trim();
    if (password !== String(env.UPLOAD_PASSWORD || DEFAULT_PASSWORD)) {
      return json({ error: "Senha incorreta." }, 403);
    }
    return json(
      { ok: true },
      200,
      {
        "Set-Cookie": `${COOKIE_NAME}=ok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
      },
    );
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    return json(
      { ok: true },
      200,
      {
        "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      },
    );
  }

  if (!isAuthenticated(request)) {
    return json({ error: "Unauthorized" }, 403);
  }

  if (url.pathname === "/api/import-markdown" && request.method === "POST") {
    await ensureSchema(env);
    const body = await request.json().catch(() => ({}));
    const markdown = String(body.markdown || "");
    const scripts = parseMarkdownScripts(markdown);
    if (!scripts.length) {
      return json({ error: "Nenhum bloco # SCRIPT foi encontrado." }, 400);
    }
    for (const script of scripts) {
      await upsertScript(env, script);
    }
    return json({ ok: true, count: scripts.length });
  }

  if (url.pathname === "/api/import-json" && request.method === "POST") {
    await ensureSchema(env);
    const body = await request.json().catch(() => ({}));
    const list = Array.isArray(body?.scripts) ? body.scripts : [];
    if (!list.length) {
      return json({ error: "JSON inválido: scripts não encontrados." }, 400);
    }
    const normalized = list.map(normalizeImportedScript).filter(Boolean);
    for (const script of normalized) {
      await upsertScript(env, script);
    }
    return json({ ok: true, count: normalized.length });
  }

  if (url.pathname === "/api/delete-script" && request.method === "POST") {
    await ensureSchema(env);
    const body = await request.json().catch(() => ({}));
    const scriptId = String(body.script_id || "").trim();
    if (!scriptId) {
      return json({ error: "script_id é obrigatório." }, 400);
    }
    await env.DB.prepare("DELETE FROM scripts WHERE id = ?").bind(scriptId).run();
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function parseCookie(headerValue) {
  const cookies = {};
  for (const chunk of String(headerValue || "").split(";")) {
    const idx = chunk.indexOf("=");
    if (idx === -1) continue;
    const key = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim();
    cookies[key] = value;
  }
  return cookies;
}

function isAuthenticated(request) {
  const cookies = parseCookie(request.headers.get("Cookie"));
  return cookies[COOKIE_NAME] === "ok";
}

async function ensureSchema(env) {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      title TEXT NOT NULL,
      month TEXT,
      grand_theme TEXT,
      category TEXT,
      source_url TEXT,
      data_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON scripts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_scripts_month ON scripts(month);
    CREATE INDEX IF NOT EXISTS idx_scripts_grand_theme ON scripts(grand_theme);
    CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts(category);
  `);
}

async function listScripts(env) {
  const result = await env.DB.prepare(
    "SELECT data_json FROM scripts ORDER BY datetime(created_at) DESC, created_at DESC",
  ).all();
  return (result.results || [])
    .map((row) => {
      try {
        return JSON.parse(row.data_json);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function upsertScript(env, script) {
  const normalized = normalizeImportedScript(script);
  await env.DB.prepare(
    `
      INSERT INTO scripts (id, created_at, title, month, grand_theme, category, source_url, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        created_at = excluded.created_at,
        title = excluded.title,
        month = excluded.month,
        grand_theme = excluded.grand_theme,
        category = excluded.category,
        source_url = excluded.source_url,
        data_json = excluded.data_json
    `,
  )
    .bind(
      normalized.id,
      normalized.created_at,
      normalized.title,
      normalized.month,
      normalized.grand_theme,
      normalized.category,
      normalized.source_url,
      JSON.stringify(normalized),
    )
    .run();
}

function normalizeImportedScript(input) {
  if (!input || typeof input !== "object") return null;
  const title = String(input.title || "").trim();
  const month = String(input.month || "").trim();
  const grandTheme = String(input.grand_theme || input.category || "").trim();
  const category = String(input.category || "").trim();
  const sourceUrl = String(input.source_url || "").trim();
  const id = String(input.id || buildId(month, title)).trim();

  if (!title) return null;

  return {
    id,
    created_at: String(input.created_at || new Date().toISOString()).trim(),
    title,
    month,
    grand_theme: grandTheme,
    category,
    viral_theme: String(input.viral_theme || category).trim(),
    source_url: sourceUrl,
    hook: String(input.hook || "").trim(),
    summary: String(input.summary || [month, grandTheme, category, title].filter(Boolean).join(" | ")).trim(),
    tags: normalizeArray(input.tags),
    character_profiles: normalizeArray(input.character_profiles),
    timeline: normalizeArray(input.timeline),
    replaceable_elements: normalizeArray(input.replaceable_elements),
    replaceable_sections: normalizeSections(input.replaceable_sections),
    notes: normalizeArray(input.notes),
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeSections(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((section) => {
      if (!section || typeof section !== "object") return null;
      const title = String(section.title || "").trim();
      const items = normalizeArray(section.items);
      if (!title || !items.length) return null;
      return { title, items };
    })
    .filter(Boolean);
}

function buildId(month, title) {
  return `${slugify(month || "script")}-${slugify(title || "novo-script")}-${crypto.randomUUID().slice(0, 6)}`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-") || "script";
}

function normalizeMarkdownLine(line) {
  return String(line || "")
    .trim()
    .replace(/^\s*[-*]\s*/, "")
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/\\\./g, ".")
    .replace(/\\_/g, "_")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, "$1: $2")
    .replace(/\s{2,}$/g, "")
    .trim();
}

function extractMetadataRaw(blockText, fieldName) {
  const pattern = new RegExp(`^\\s*\\*\\*${escapeRegExp(fieldName)}:\\*\\*\\s*(.+?)\\s*$`, "im");
  const match = blockText.match(pattern);
  return match ? match[1].trim() : "";
}

function extractMetadataValue(blockText, fieldName) {
  return normalizeMarkdownLine(extractMetadataRaw(blockText, fieldName));
}

function extractFirstLink(text) {
  const markdownMatch = text.match(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
  if (markdownMatch) return markdownMatch[1].replace(/\\_/g, "_");
  const urlMatch = text.match(/https?:\/\/[^\s)\]]+/);
  return urlMatch ? urlMatch[0].replace(/\\_/g, "_") : "";
}

function numberedSectionPattern(number, label) {
  return new RegExp(`^\\s*(?:\\*\\*)?#*\\s*${number}\\\\?\\.\\s*${label}(?:\\*\\*)?\\s*$`, "im");
}

function extractSection(markdownText, startPattern, endPatterns) {
  const startMatch = markdownText.match(startPattern);
  if (!startMatch || startMatch.index == null) return "";
  const start = startMatch.index + startMatch[0].length;
  let end = markdownText.length;
  const slice = markdownText.slice(start);
  for (const pattern of endPatterns) {
    const match = slice.match(pattern);
    if (match && match.index != null) {
      end = Math.min(end, start + match.index);
    }
  }
  return markdownText.slice(start, end).trim();
}

function parseReplaceableSections(sectionText) {
  const pattern =
    /^\s*(?:[-*]\s*)?(?:\*\*)?(Conflito Central.*|Formas de Evidência.*|O Vínculo do Amante.*|O Plano Final da Vilã.*|Cenas de Impacto.*|Argumento de Defesa.*|A Prova de Amor.*|A Prova de Amor\/Sacrifício do Marido.*|Ações de Impacto.*|Cenários Sugeridos.*|O Ato de Cuidado.*|O Apoio Financeiro.*|Gesto de Segurança\/Proteção.*|Cenas Característica.*|Ameaças de "Bens".*|A Comparação Fatal.*|A Punição Final.*|Ações Característica.*)(?:\*\*)?:?\s*$/gim;
  const matches = [...sectionText.matchAll(pattern)];
  if (!matches.length) {
    const fallback = sectionText
      .split(/\r?\n/)
      .map(normalizeMarkdownLine)
      .filter(Boolean);
    return fallback.length ? [{ title: "Elementos Substituíveis", items: fallback }] : [];
  }

  const sections = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index || sectionText.length : sectionText.length;
    const title = String(match[1] || "").trim().replace(/:$/, "");
    const items = sectionText
      .slice(start, end)
      .split(/\r?\n/)
      .map(normalizeMarkdownLine)
      .filter(Boolean);
    if (title && items.length) sections.push({ title, items });
  }
  return sections;
}

function parseScriptBlock(blockText) {
  const month = extractMetadataValue(blockText, "Mês");
  const grandTheme = extractMetadataValue(blockText, "Grande Tema");
  const category = extractMetadataValue(blockText, "Categoria");
  const title = extractMetadataValue(blockText, "Título");
  const sourceUrl = extractFirstLink(extractMetadataRaw(blockText, "Link Exemplo") || blockText);

  const profilesText = extractSection(
    blockText,
    numberedSectionPattern(1, "Perfis de Personagem"),
    [numberedSectionPattern(2, "Ritmo \\(Timeline\\)"), numberedSectionPattern(3, "Elementos Substituíveis")],
  );
  const timelineText = extractSection(
    blockText,
    numberedSectionPattern(2, "Ritmo \\(Timeline\\)"),
    [numberedSectionPattern(3, "Elementos Substituíveis")],
  );
  const replaceableText = extractSection(
    blockText,
    numberedSectionPattern(3, "Elementos Substituíveis"),
    [],
  );

  const characterProfiles = profilesText.split(/\r?\n/).map(normalizeMarkdownLine).filter(Boolean);
  const timeline = timelineText.split(/\r?\n/).map(normalizeMarkdownLine).filter(Boolean);
  const replaceableSections = parseReplaceableSections(replaceableText);
  const replaceableElements = replaceableSections.flatMap((section) => section.items || []);

  return normalizeImportedScript({
    title,
    month,
    grand_theme: grandTheme,
    category,
    viral_theme: category,
    source_url: sourceUrl,
    hook: timeline[0] || "",
    summary: [month, grandTheme, category, title].filter(Boolean).join(" | "),
    character_profiles: characterProfiles,
    timeline,
    replaceable_elements: replaceableElements,
    replaceable_sections: replaceableSections,
    notes: [],
  });
}

function parseMarkdownScripts(markdownText) {
  const text = String(markdownText || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const blocks = text.split(/(?=^#\s+SCRIPT\b)/gim).map((block) => block.trim()).filter(Boolean);
  return blocks.map(parseScriptBlock).filter(Boolean);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
