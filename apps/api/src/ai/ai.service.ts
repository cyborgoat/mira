import { BadGatewayException, BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import * as https from "node:https";
import * as net from "node:net";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import * as tls from "node:tls";

export type LlmWikiLanguage = "en" | "zh";

export type LlmWikiSource = {
  path: string;
  filename: string;
  size: number;
  updatedAt: string;
};

export type LlmWikiPage = {
  path: string;
  title: string;
  size: number;
  updatedAt: string;
};

export type LlmWikiOverview = {
  sources: LlmWikiSource[];
  pages: LlmWikiPage[];
  index: string;
  log: string;
};

export type LlmWikiQueryResult = {
  answer: string;
  savedPage?: string;
  writtenPages: string[];
  logEntry?: string;
};

export type LlmWikiIngestResult = {
  sourcePath: string;
  summary: string;
  writtenPages: string[];
  logEntry?: string;
};

export type LlmWikiLintResult = {
  findings: string[];
  notes: string;
  logEntry?: string;
};

type Provider = "openai" | "openrouter" | "anthropic" | "custom-openai-compatible";
type OpenAiCompatibleChoice = {
  finish_reason?: string;
  message?: {
    content?: string | Array<{ text?: string; type?: string }>;
    refusal?: string;
    reasoning?: unknown;
    reasoning_details?: unknown;
  };
};

type WikiFileInstruction = {
  path?: unknown;
  content?: unknown;
};

@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  async wikiOverview(userId: string): Promise<LlmWikiOverview> {
    const vault = await this.ensureVault(userId);
    const [sources, pages, index, log] = await Promise.all([
      this.listSources(vault.rawDir),
      this.listPages(vault.wikiDir),
      this.readOptional(join(vault.wikiDir, "index.md")),
      this.readOptional(join(vault.wikiDir, "log.md")),
    ]);
    return { sources, pages, index, log: this.tailLog(log) };
  }

  async uploadWikiSource(userId: string, payload: { filename: string; content: string }): Promise<LlmWikiSource> {
    const vault = await this.ensureVault(userId);
    const filename = this.safeSourceFilename(payload.filename);
    const content = typeof payload.content === "string" ? payload.content : "";
    const maxBytes = Number(this.config.get<string>("MIRA_WIKI_MAX_SOURCE_BYTES", "1000000")) || 1000000;
    if (!content.trim()) throw new BadRequestException("Source content is required");
    if (Buffer.byteLength(content, "utf8") > maxBytes) throw new BadRequestException("Source file is too large");

    const finalName = await this.uniqueFilename(vault.rawDir, filename);
    const filePath = join(vault.rawDir, finalName);
    await writeFile(filePath, content, "utf8");
    const info = await stat(filePath);
    await this.appendLog(vault.wikiDir, `source | Uploaded ${finalName}`);
    return {
      path: `raw/${finalName}`,
      filename: finalName,
      size: info.size,
      updatedAt: info.mtime.toISOString(),
    };
  }

  async ingestWikiSource(userId: string, payload: { sourcePath: string; language: LlmWikiLanguage }): Promise<LlmWikiIngestResult> {
    const vault = await this.ensureVault(userId);
    const sourceFile = this.resolveRawPath(vault.rawDir, payload.sourcePath);
    if (!existsSync(sourceFile)) throw new NotFoundException("Source file not found");
    const sourceContent = await this.readLimited(sourceFile, this.sourcePromptChars());
    const context = await this.wikiContext(vault.wikiDir);

    const parsed = await this.completeJson(this.wikiJsonSystem(), [
      this.languageLine(payload.language),
      "Ingest the raw source into the persistent markdown wiki.",
      "Create or update durable wiki pages. Update index.md. Do not include hidden reasoning.",
      "Return JSON with this shape: {\"summary\":\"string\",\"files\":[{\"path\":\"index.md or pages/name.md\",\"content\":\"markdown\"}],\"logEntry\":\"string\"}.",
      "Do not write raw sources or log.md in files. Use Obsidian-style [[links]] where helpful.",
      "",
      "Existing wiki context:",
      context,
      "",
      `Source path: ${payload.sourcePath}`,
      "Source content:",
      sourceContent,
    ].join("\n"));

    const writtenPages = await this.applyWikiFiles(vault.wikiDir, parsed.files);
    const logEntry = this.optionalString(parsed.logEntry) || `ingest | ${payload.sourcePath}`;
    await this.appendLog(vault.wikiDir, logEntry);
    return {
      sourcePath: payload.sourcePath,
      summary: this.optionalString(parsed.summary) || "Source ingested.",
      writtenPages,
      logEntry,
    };
  }

  async queryWiki(userId: string, payload: { question: string; language: LlmWikiLanguage; saveAsPage?: boolean }): Promise<LlmWikiQueryResult> {
    const question = payload.question.trim();
    if (!question) throw new BadRequestException("Question is required");

    const vault = await this.ensureVault(userId);
    const context = await this.wikiContext(vault.wikiDir, true);
    const parsed = await this.completeJson(this.wikiJsonSystem(), [
      this.languageLine(payload.language),
      "Answer the user's question from the existing markdown wiki. Cite relevant wiki page names or source names in prose.",
      payload.saveAsPage
        ? "Also save the answer as a durable wiki page and update index.md."
        : "Do not write files unless the answer must update index.md for correctness.",
      "Return JSON with this shape: {\"answer\":\"markdown\",\"files\":[{\"path\":\"index.md or pages/name.md\",\"content\":\"markdown\"}],\"logEntry\":\"string\"}.",
      "If saving an answer page, put it under pages/ with a concise kebab-case filename.",
      "",
      "Wiki context:",
      context,
      "",
      `Question: ${question}`,
    ].join("\n"));

    const writtenPages = payload.saveAsPage ? await this.applyWikiFiles(vault.wikiDir, parsed.files) : [];
    const logEntry = this.optionalString(parsed.logEntry) || `query | ${question.slice(0, 120)}`;
    await this.appendLog(vault.wikiDir, logEntry);
    return {
      answer: this.optionalString(parsed.answer) || "No answer returned.",
      savedPage: writtenPages.find((path) => path.startsWith("pages/")),
      writtenPages,
      logEntry,
    };
  }

  async lintWiki(userId: string, payload: { language: LlmWikiLanguage }): Promise<LlmWikiLintResult> {
    const vault = await this.ensureVault(userId);
    const context = await this.wikiContext(vault.wikiDir, true);
    const parsed = await this.completeJson(this.wikiJsonSystem(), [
      this.languageLine(payload.language),
      "Health-check this persistent markdown wiki.",
      "Look for contradictions, stale claims, orphan pages, missing cross-references, missing pages for recurring concepts, and useful next sources.",
      "Return JSON with this shape: {\"findings\":[\"string\"],\"notes\":\"markdown\",\"logEntry\":\"string\"}.",
      "",
      "Wiki context:",
      context,
    ].join("\n"));

    const logEntry = this.optionalString(parsed.logEntry) || "lint | Wiki health check";
    await this.appendLog(vault.wikiDir, logEntry);
    return {
      findings: Array.isArray(parsed.findings) ? parsed.findings.filter((item): item is string => typeof item === "string") : [],
      notes: this.optionalString(parsed.notes),
      logEntry,
    };
  }

  async readWikiPage(userId: string, pagePath: string) {
    const vault = await this.ensureVault(userId);
    const filePath = this.resolveWikiPath(vault.wikiDir, pagePath);
    if (!existsSync(filePath)) throw new NotFoundException("Wiki page not found");
    return {
      path: this.toPosix(relative(vault.wikiDir, filePath)),
      content: await readFile(filePath, "utf8"),
    };
  }

  private async ensureVault(userId: string) {
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const root = resolve(this.configString("MIRA_WIKI_ROOT", resolve(process.cwd(), "data", "llm-wiki")));
    const vaultDir = join(root, safeUserId);
    const rawDir = join(vaultDir, "raw");
    const wikiDir = join(vaultDir, "wiki");
    await Promise.all([mkdir(rawDir, { recursive: true }), mkdir(join(wikiDir, "pages"), { recursive: true })]);
    await this.ensureFile(join(wikiDir, "index.md"), "# Index\n\nNo wiki pages yet.\n");
    await this.ensureFile(join(wikiDir, "log.md"), "# Log\n\n");
    return { root, vaultDir, rawDir, wikiDir };
  }

  private async ensureFile(path: string, content: string) {
    if (existsSync(path)) return;
    await writeFile(path, content, "utf8");
  }

  private async listSources(rawDir: string): Promise<LlmWikiSource[]> {
    const entries = await readdir(rawDir, { withFileTypes: true });
    const files = await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
      const path = join(rawDir, entry.name);
      const info = await stat(path);
      return {
        path: `raw/${entry.name}`,
        filename: entry.name,
        size: info.size,
        updatedAt: info.mtime.toISOString(),
      };
    }));
    return files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private async listPages(wikiDir: string): Promise<LlmWikiPage[]> {
    const files = await this.walkMarkdown(join(wikiDir, "pages"));
    const pages = await Promise.all(files.map(async (file) => {
      const content = await this.readLimited(file, 4000);
      const info = await stat(file);
      const path = this.toPosix(relative(wikiDir, file));
      return {
        path,
        title: this.markdownTitle(content) || basename(file, extname(file)).replace(/[-_]+/g, " "),
        size: info.size,
        updatedAt: info.mtime.toISOString(),
      };
    }));
    return pages.sort((a, b) => a.path.localeCompare(b.path));
  }

  private async walkMarkdown(dir: string): Promise<string[]> {
    if (!existsSync(dir)) return [];
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return this.walkMarkdown(path);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) return [path];
      return [];
    }));
    return nested.flat();
  }

  private async wikiContext(wikiDir: string, includePages = false) {
    const index = await this.readOptional(join(wikiDir, "index.md"));
    const log = this.tailLog(await this.readOptional(join(wikiDir, "log.md")));
    const pages = includePages ? await this.pageContext(wikiDir) : "";
    return [
      "## index.md",
      index,
      "## recent log.md",
      log,
      pages ? `## pages\n${pages}` : "",
    ].filter(Boolean).join("\n\n").slice(0, this.contextChars());
  }

  private async pageContext(wikiDir: string) {
    const pages = await this.listPages(wikiDir);
    const chunks: string[] = [];
    for (const page of pages.slice(0, 30)) {
      const content = await this.readLimited(join(wikiDir, page.path), 6000);
      chunks.push(`### ${page.path}\n${content}`);
    }
    return chunks.join("\n\n");
  }

  private async applyWikiFiles(wikiDir: string, files: unknown) {
    if (!Array.isArray(files)) return [];
    const written: string[] = [];
    for (const file of files as WikiFileInstruction[]) {
      const path = typeof file.path === "string" ? file.path : "";
      const content = typeof file.content === "string" ? file.content : "";
      if (!path || !content.trim()) continue;
      const target = this.resolveWikiPath(wikiDir, path);
      const relativePath = this.toPosix(relative(wikiDir, target));
      if (relativePath === "log.md") continue;
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content.endsWith("\n") ? content : `${content}\n`, "utf8");
      written.push(relativePath);
    }
    return written;
  }

  private resolveRawPath(rawDir: string, input: string) {
    const normalized = this.safeRelative(input.replace(/^raw[\\/]/, ""));
    return this.resolveUnder(rawDir, normalized);
  }

  private resolveWikiPath(wikiDir: string, input: string) {
    const normalized = this.safeRelative(input);
    if (normalized !== "index.md" && normalized !== "log.md" && !normalized.startsWith(`pages${sep}`) && !normalized.startsWith("pages/")) {
      throw new BadRequestException("Wiki path must be index.md, log.md, or pages/*.md");
    }
    if (!normalized.toLowerCase().endsWith(".md")) throw new BadRequestException("Wiki pages must be markdown files");
    return this.resolveUnder(wikiDir, normalized);
  }

  private safeRelative(input: string) {
    const value = input.replace(/\\/g, sep).replace(/\//g, sep).trim();
    if (!value || value.includes("..") || value.startsWith(sep) || value.includes(`:${sep}`)) {
      throw new BadRequestException("Invalid path");
    }
    return value;
  }

  private resolveUnder(root: string, input: string) {
    const target = resolve(root, input);
    const rootPath = resolve(root);
    if (target !== rootPath && !target.startsWith(`${rootPath}${sep}`)) throw new BadRequestException("Invalid path");
    return target;
  }

  private safeSourceFilename(filename: string) {
    const original = basename(filename || "");
    const extension = extname(original).toLowerCase();
    if (![".md", ".markdown", ".txt"].includes(extension)) throw new BadRequestException("Only .md, .markdown, and .txt sources are supported");
    const stem = basename(original, extname(original)).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "source";
    return `${stem}${extension}`;
  }

  private async uniqueFilename(dir: string, filename: string) {
    if (!existsSync(join(dir, filename))) return filename;
    const extension = extname(filename);
    const stem = basename(filename, extension);
    return `${stem}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}${extension}`;
  }

  private async appendLog(wikiDir: string, text: string) {
    const entry = text.trim();
    if (!entry) return;
    const date = new Date().toISOString().slice(0, 10);
    await appendFile(join(wikiDir, "log.md"), `\n## [${date}] ${entry}\n`, "utf8");
  }

  private tailLog(log: string) {
    const entries = log.split(/\n(?=## \[)/).filter(Boolean);
    if (entries.length <= 12) return log;
    return [entries[0], ...entries.slice(-12)].join("\n");
  }

  private markdownTitle(content: string) {
    return content.split(/\r?\n/).find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").trim() || "";
  }

  private async readOptional(path: string) {
    try {
      return await readFile(path, "utf8");
    } catch {
      return "";
    }
  }

  private async readLimited(path: string, chars: number) {
    const content = await readFile(path, "utf8");
    return content.slice(0, chars);
  }

  private sourcePromptChars() {
    return Number(this.config.get<string>("MIRA_WIKI_SOURCE_PROMPT_CHARS", "60000")) || 60000;
  }

  private contextChars() {
    return Number(this.config.get<string>("MIRA_WIKI_CONTEXT_CHARS", "90000")) || 90000;
  }

  private toPosix(path: string) {
    return path.split(sep).join("/");
  }

  private languageLine(language: LlmWikiLanguage) {
    return language === "zh" ? "Write user-facing content in Chinese." : "Write user-facing content in English.";
  }

  private optionalString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }

  private async completeJson(system: string, prompt: string) {
    const text = await this.complete(system, prompt, true);
    const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      throw new BadGatewayException("AI provider returned invalid JSON");
    }
  }

  private async complete(system: string, prompt: string, jsonMode: boolean) {
    const provider = this.provider();
    const apiKey = this.config.get<string>("MIRA_AI_API_KEY", "").trim();
    if (!apiKey) throw new ServiceUnavailableException("AI provider is not configured");
    return provider === "anthropic"
      ? this.callAnthropic(apiKey, system, prompt)
      : this.callOpenAiCompatible(provider, apiKey, system, prompt, jsonMode);
  }

  private provider(): Provider {
    const value = this.configString("MIRA_AI_PROVIDER", "openai");
    if (["openai", "openrouter", "anthropic", "custom-openai-compatible"].includes(value)) return value as Provider;
    throw new ServiceUnavailableException(`Unsupported AI provider: ${value}`);
  }

  private async callOpenAiCompatible(provider: Provider, apiKey: string, system: string, prompt: string, jsonMode: boolean) {
    const baseUrl = this.configString("MIRA_AI_BASE_URL", this.defaultBaseUrl(provider)).replace(/\/+$/, "");
    const responseFormat = jsonMode && provider !== "openrouter" ? { response_format: { type: "json_object" } } : {};
    const reasoning = provider === "openrouter" ? { reasoning: { effort: "none", exclude: true }, include_reasoning: false } : {};
    const response = await this.fetchJson(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider === "openrouter" ? this.openRouterHeaders() : {}),
      },
      body: JSON.stringify({
        model: this.model(provider),
        max_tokens: this.maxTokens(),
        temperature: 0.2,
        ...responseFormat,
        ...reasoning,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    return this.extractOpenAiCompatibleText(response);
  }

  private async callAnthropic(apiKey: string, system: string, prompt: string) {
    const baseUrl = this.configString("MIRA_AI_BASE_URL", "https://api.anthropic.com").replace(/\/+$/, "");
    const response = await this.fetchJson(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model("anthropic"),
        max_tokens: this.maxTokens(),
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const text = (response as { content?: Array<{ type?: string; text?: string }> }).content?.find((item) => item.type === "text")?.text;
    if (!text) throw new BadGatewayException("AI provider returned an empty response");
    return text;
  }

  private async fetchJson(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeoutMs = Number(this.config.get<string>("MIRA_AI_TIMEOUT_MS", "45000")) || 45000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.requestText(url, { ...init, signal: controller.signal });
      const body = response.body;
      if (!response.ok) {
        const prefix = response.status === 401 || response.status === 403 ? "AI provider authentication failed" : "AI provider request failed";
        throw new BadGatewayException(`${prefix}: ${response.status}${this.providerError(body)}`);
      }
      try {
        return JSON.parse(body);
      } catch {
        throw new BadGatewayException(`AI provider returned non-JSON response${this.providerError(body)}`);
      }
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      const message = error instanceof Error ? `: ${error.message}` : "";
      throw new BadGatewayException(`AI provider request failed${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestText(url: string, init: RequestInit) {
    const proxyUrl = this.proxyUrl(url);
    if (proxyUrl) return this.requestTextViaProxy(url, init, proxyUrl);
    const response = await fetch(url, init);
    return { ok: response.ok, status: response.status, body: await response.text() };
  }

  private proxyUrl(targetUrl: string) {
    const target = new URL(targetUrl);
    const configured = this.config.get<string>("MIRA_AI_PROXY", "").trim();
    if (this.proxyDisabled(configured)) return "";
    if (configured) return configured;
    if (this.noProxyMatches(target.hostname)) return "";
    if (target.protocol === "https:") {
      return this.config.get<string>("HTTPS_PROXY", "").trim()
        || this.config.get<string>("https_proxy", "").trim()
        || this.config.get<string>("HTTP_PROXY", "").trim()
        || this.config.get<string>("http_proxy", "").trim();
    }
    return "";
  }

  private proxyDisabled(value: string) {
    return ["0", "false", "off", "none", "direct", "disabled", "no"].includes(value.toLowerCase());
  }

  private noProxyMatches(hostname: string) {
    const value = this.config.get<string>("NO_PROXY", "").trim() || this.config.get<string>("no_proxy", "").trim();
    if (!value) return false;
    return value.split(",").map((item) => item.trim()).filter(Boolean).some((pattern) => {
      if (pattern === "*") return true;
      if (pattern.startsWith(".")) return hostname.endsWith(pattern);
      return hostname === pattern || hostname.endsWith(`.${pattern}`);
    });
  }

  private requestTextViaProxy(url: string, init: RequestInit, proxyUrl: string) {
    const target = new URL(url);
    if (target.protocol !== "https:") return fetch(url, init).then(async (response) => ({ ok: response.ok, status: response.status, body: await response.text() }));
    const proxy = new URL(proxyUrl);
    const body = typeof init.body === "string" ? init.body : "";
    const headers = {
      ...this.headerRecord(init.headers),
      "Accept-Encoding": "identity",
      "Content-Length": Buffer.byteLength(body).toString(),
    };

    return new Promise<{ ok: boolean; status: number; body: string }>((resolvePromise, reject) => {
      const options: https.RequestOptions & { createConnection: (options: unknown, callback: (error: Error | null, socket?: net.Socket | tls.TLSSocket) => void) => net.Socket | undefined } = {
        hostname: target.hostname,
        port: Number(target.port || 443),
        method: init.method || "GET",
        path: `${target.pathname}${target.search}`,
        headers,
        createConnection: (_options, callback) => {
          this.createProxyTunnel(target, proxy, callback as (error: Error | null, socket?: tls.TLSSocket) => void);
          return undefined;
        },
      };
      const request = https.request(options, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const statusCode = response.statusCode || 0;
          resolvePromise({ ok: statusCode >= 200 && statusCode < 300, status: statusCode, body: Buffer.concat(chunks).toString("utf8") });
        });
      });
      request.on("error", reject);
      if (init.signal) init.signal.addEventListener("abort", () => request.destroy(new Error("request aborted")), { once: true });
      if (body) request.write(body);
      request.end();
    });
  }

  private createProxyTunnel(target: URL, proxy: URL, callback: (error: Error | null, socket?: tls.TLSSocket) => void) {
    const proxyPort = Number(proxy.port || (proxy.protocol === "https:" ? 443 : 80));
    const proxySocket = proxy.protocol === "https:"
      ? tls.connect({ host: proxy.hostname, port: proxyPort, servername: proxy.hostname })
      : net.connect({ host: proxy.hostname, port: proxyPort });
    let settled = false;
    let buffered = "";

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      proxySocket.destroy();
      callback(error);
    };

    proxySocket.setTimeout(15000, () => fail(new Error("proxy connection timed out")));
    proxySocket.once("error", fail);
    const connect = () => {
      const targetPort = target.port || "443";
      const auth = proxy.username ? `Proxy-Authorization: Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString("base64")}\r\n` : "";
      proxySocket.write(`CONNECT ${target.hostname}:${targetPort} HTTP/1.1\r\nHost: ${target.hostname}:${targetPort}\r\n${auth}Proxy-Connection: Keep-Alive\r\n\r\n`);
    };
    if (proxy.protocol === "https:") proxySocket.once("secureConnect", connect);
    else proxySocket.once("connect", connect);
    proxySocket.on("data", (chunk) => {
      if (settled) return;
      buffered += chunk.toString("latin1");
      const end = buffered.indexOf("\r\n\r\n");
      if (end === -1) return;
      const statusLine = buffered.slice(0, buffered.indexOf("\r\n"));
      const statusCode = Number(statusLine.split(" ")[1]);
      if (statusCode !== 200) return fail(new Error(`proxy CONNECT failed: ${statusCode || "unknown"}`));
      settled = true;
      proxySocket.removeAllListeners("data");
      proxySocket.removeAllListeners("error");
      proxySocket.setTimeout(0);
      const secureSocket = tls.connect({ socket: proxySocket, servername: target.hostname }, () => callback(null, secureSocket));
      secureSocket.once("error", (error) => callback(error));
    });
  }

  private headerRecord(headers: HeadersInit | undefined) {
    const result: Record<string, string> = {};
    new Headers(headers).forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  private model(provider: Provider) {
    return this.configString("MIRA_AI_MODEL", provider === "anthropic" ? "claude-3-5-sonnet-latest" : "gpt-5.2");
  }

  private maxTokens() {
    return Number(this.config.get<string>("MIRA_AI_MAX_TOKENS", "4000")) || 4000;
  }

  private defaultBaseUrl(provider: Provider) {
    if (provider === "openrouter") return "https://openrouter.ai/api/v1";
    return "https://api.openai.com/v1";
  }

  private openRouterHeaders() {
    return {
      "HTTP-Referer": this.configString("MIRA_AI_APP_URL", "http://localhost:5173"),
      "X-Title": this.configString("MIRA_AI_APP_NAME", "Mira"),
    };
  }

  private configString(key: string, fallback: string) {
    return this.config.get<string>(key, fallback).trim() || fallback;
  }

  private providerError(body: string) {
    const value = body.trim();
    if (!value) return "";
    try {
      const parsed = JSON.parse(value) as { error?: { message?: unknown }; message?: unknown };
      const message = parsed.error?.message || parsed.message;
      if (typeof message === "string" && message.trim()) return `: ${message.trim().slice(0, 300)}`;
    } catch {
      // Fall through to a short text preview.
    }
    return `: ${value.replace(/\s+/g, " ").slice(0, 300)}`;
  }

  private extractOpenAiCompatibleText(response: unknown) {
    const choice = (response as { choices?: OpenAiCompatibleChoice[] }).choices?.[0];
    const message = choice?.message;
    const content = message?.content;
    const text = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((part) => part.text || "").join("\n")
        : "";
    if (text.trim()) return text;
    if (message?.refusal?.trim()) throw new BadGatewayException(`AI provider refused the request: ${message.refusal.trim().slice(0, 300)}`);

    const details = [
      choice?.finish_reason ? `finish_reason=${choice.finish_reason}` : "",
      message?.reasoning || message?.reasoning_details ? "response contained reasoning but no final content" : "",
    ].filter(Boolean).join("; ");
    throw new BadGatewayException(`AI provider returned empty final content${details ? `: ${details}` : ""}`);
  }

  private wikiJsonSystem() {
    return [
      "You maintain Mira's personal LLM Wiki.",
      "The wiki is a persistent, interlinked markdown knowledge base built from immutable raw sources.",
      "Return only valid JSON in the requested schema.",
      "Never include markdown fences or prose outside JSON.",
      "Do not expose hidden reasoning or chain-of-thought.",
      "Prefer concise markdown, useful [[links]], and explicit source references.",
    ].join(" ");
  }
}
