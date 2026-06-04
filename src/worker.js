const COOKIE_NAME = "scriptbank_upload_auth";
const DEFAULT_PASSWORD = "kwai666";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("Assets binding is unavailable.", { status: 500 });
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, url) {
  try {
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
        return json({ error: "Nenhum bloco de script reconhecido foi encontrado no Markdown." }, 400);
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
  } catch (error) {
    return json(
      {
        error: error && error.message ? error.message : "Worker threw exception.",
        stack: error && error.stack ? String(error.stack).split("\n").slice(0, 6) : [],
      },
      500,
    );
  }
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
  if (!env.DB) {
    throw new Error("D1 binding DB is unavailable.");
  }

  // Core table + indexes — safe to re-run
  const statements = [
    "CREATE TABLE IF NOT EXISTS scripts (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, title TEXT NOT NULL, month TEXT, grand_theme TEXT, category TEXT, persona TEXT, source_url TEXT, data_json TEXT NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON scripts(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_scripts_month ON scripts(month)",
    "CREATE INDEX IF NOT EXISTS idx_scripts_grand_theme ON scripts(grand_theme)",
    "CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts(category)",
    "CREATE INDEX IF NOT EXISTS idx_scripts_persona ON scripts(persona)",
  ];

  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }

  // Migration: add persona column for existing databases (no-op if already present)
  try {
    await env.DB.prepare("ALTER TABLE scripts ADD COLUMN persona TEXT").run();
  } catch {
    // Column already exists — ignore
  }
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
      INSERT INTO scripts (id, created_at, title, month, grand_theme, category, persona, source_url, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        created_at = excluded.created_at,
        title = excluded.title,
        month = excluded.month,
        grand_theme = excluded.grand_theme,
        category = excluded.category,
        persona = excluded.persona,
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
      normalized.persona,
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
  const persona = String(input.persona || "").trim();
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
    persona,
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
    .replace(/\\!/g, "!")
    .replace(/\\_/g, "_")
    .replace(/\*\*(.*?)\*\*/g, "$1")   // paired bold: **text**
    .replace(/\*([^*]+)\*/g, "$1")      // paired italic: *text*
    .replace(/\*+/g, "")               // leftover lone asterisks
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
  // Generic strategy: any line that is immediately followed by "A. " style
  // option lines is treated as a section title — no whitelist needed.
  const lines = sectionText.split(/\r?\n/);

  // Identify which line indices are section titles:
  // a line is a title if it is non-empty, not itself an option line (A./B./C./D.),
  // and the next non-empty line starts with a letter-option pattern.
  const optionLineRe = /^\s*(?:\*\*)?[A-Z]\.\s/;
  const titleIndices = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (optionLineRe.test(line)) continue; // it's an option, not a title

    // look ahead for the next non-empty line
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j < lines.length && optionLineRe.test(lines[j].trim())) {
      titleIndices.push(i);
    }
  }

  if (!titleIndices.length) {
    // fallback: dump everything as flat list
    const fallback = lines.map(normalizeMarkdownLine).filter(Boolean);
    return fallback.length ? [{ title: "Elementos Substituíveis", items: fallback }] : [];
  }

  const sections = [];
  for (let t = 0; t < titleIndices.length; t++) {
    const titleLineIdx = titleIndices[t];
    const nextTitleIdx = t + 1 < titleIndices.length ? titleIndices[t + 1] : lines.length;
    const rawTitle = normalizeMarkdownLine(lines[titleLineIdx]);
    const items = lines
      .slice(titleLineIdx + 1, nextTitleIdx)
      .map(normalizeMarkdownLine)
      .filter(Boolean);
    if (rawTitle && items.length) sections.push({ title: rawTitle, items });
  }
  return sections;
}

function parseScriptBlock(blockText) {
  const month = extractMetadataValue(blockText, "Mês");
  const grandTheme = extractMetadataValue(blockText, "Grande Tema");
  const category = extractMetadataValue(blockText, "Categoria");
  const persona = extractMetadataValue(blockText, "Personagem Principal");
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
    persona,
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
  if (blocks.length) {
    return blocks.map(parseScriptBlock).filter(Boolean);
  }
  return parseLegacyMarkdownScripts(text);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseLegacyMarkdownScripts(text) {
  let currentCategory = "";
  let currentViral = "";
  let currentTitle = "";
  let currentLines = [];
  const scripts = [];

  function flushCurrent() {
    if (!currentTitle) return;
    const blockText = currentLines.join("\n").trim();
    scripts.push(...splitLegacyTitleGroupIntoScripts(currentCategory, currentViral, currentTitle, blockText));
    currentTitle = "";
    currentLines = [];
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    const titleMatch = line.match(/^###\s+\*\*(.+?)\*\*\s*$/) || line.match(/^###\s+(.+)$/);
    const viralMatch = !line.startsWith("###") ? line.match(/^##\s+(.+)$/) : null;
    const categoryMatch = !line.startsWith("##") ? line.match(/^#\s+(.+)$/) : null;

    if (titleMatch) {
      flushCurrent();
      currentTitle = String(titleMatch[1] || "").trim();
      currentLines = [line];
      continue;
    }

    if (viralMatch) {
      flushCurrent();
      currentViral = String(viralMatch[1] || "").trim();
      continue;
    }

    if (categoryMatch) {
      flushCurrent();
      currentCategory = String(categoryMatch[1] || "").trim();
      continue;
    }

    if (currentTitle) {
      currentLines.push(line);
    }
  }

  flushCurrent();
  return scripts.filter(Boolean);
}

function splitLegacyTitleGroupIntoScripts(category, viralTheme, title, blockText) {
  const linkMatches = [...blockText.matchAll(/^(?:link\d*|link)\s*:\s*.*$/gim)];
  if (!linkMatches.length) {
    const single = parseLegacyScriptBlock(category, viralTheme, title, blockText);
    return single ? [single] : [];
  }

  const scripts = [];
  for (let index = 0; index < linkMatches.length; index += 1) {
    const start = linkMatches[index].index || 0;
    const end = index + 1 < linkMatches.length ? linkMatches[index + 1].index || blockText.length : blockText.length;
    const segment = blockText.slice(start, end).trim();
    const parsed = parseLegacyScriptBlock(category, viralTheme, title, segment);
    if (parsed) scripts.push(parsed);
  }
  return scripts;
}

function parseLegacyScriptBlock(category, viralTheme, title, blockText) {
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
    title: String(title || "").trim(),
    month: "",
    grand_theme: String(category || "").trim(),
    category: String(viralTheme || "").trim(),
    persona: extractMetadataValue(blockText, "Personagem Principal"),
    viral_theme: String(viralTheme || "").trim(),
    source_url: extractFirstLink(blockText),
    hook: timeline[0] || "",
    summary: [category, viralTheme, title].filter(Boolean).join(" | "),
    character_profiles: characterProfiles,
    timeline,
    replaceable_elements: replaceableElements,
    replaceable_sections: replaceableSections,
    notes: [],
  });
}
