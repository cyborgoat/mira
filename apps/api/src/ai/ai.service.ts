import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as https from "node:https";
import * as net from "node:net";
import * as tls from "node:tls";

export type AiLanguage = "en" | "zh";

export type AiSummarySection = {
  title: string;
  items: string[];
};

export type AiSummary = {
  accomplishments: AiSummarySection;
  workStyle: AiSummarySection;
  recommendations: AiSummarySection;
  risks: AiSummarySection;
  evidence: AiSummarySection;
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

@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  async summarize(payload: { language: AiLanguage; prompt: string }): Promise<AiSummary> {
    const provider = this.provider();
    const apiKey = this.config.get<string>("MIRA_AI_API_KEY", "").trim();
    if (!apiKey) throw new ServiceUnavailableException("AI provider is not configured");

    const text = provider === "anthropic"
      ? await this.callAnthropic(apiKey, payload.prompt)
      : await this.callOpenAiCompatible(provider, apiKey, payload.prompt);

    return this.parseSummary(text);
  }

  private provider(): Provider {
    const value = this.configString("MIRA_AI_PROVIDER", "openai");
    if (["openai", "openrouter", "anthropic", "custom-openai-compatible"].includes(value)) return value as Provider;
    throw new ServiceUnavailableException(`Unsupported AI provider: ${value}`);
  }

  private async callOpenAiCompatible(provider: Provider, apiKey: string, prompt: string) {
    const baseUrl = this.configString("MIRA_AI_BASE_URL", this.defaultBaseUrl(provider)).replace(/\/+$/, "");
    const responseFormat = provider === "openrouter" ? {} : { response_format: { type: "json_object" } };
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
          { role: "system", content: this.systemPrompt() },
          { role: "user", content: prompt },
        ],
      }),
    });

    return this.extractOpenAiCompatibleText(response);
  }

  private async callAnthropic(apiKey: string, prompt: string) {
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
        max_tokens: 1600,
        temperature: 0.2,
        system: this.systemPrompt(),
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

    return new Promise<{ ok: boolean; status: number; body: string }>((resolve, reject) => {
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
          const status = response.statusCode || 0;
          resolve({ ok: status >= 200 && status < 300, status, body: Buffer.concat(chunks).toString("utf8") });
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
      const status = Number(statusLine.split(" ")[1]);
      if (status !== 200) return fail(new Error(`proxy CONNECT failed: ${status || "unknown"}`));
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

  private parseSummary(text: string): AiSummary {
    const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    try {
      const parsed = JSON.parse(trimmed) as Partial<AiSummary>;
      return {
        accomplishments: this.section(parsed.accomplishments, "Accomplishments"),
        workStyle: this.section(parsed.workStyle, "Work style"),
        recommendations: this.section(parsed.recommendations, "Recommendations"),
        risks: this.section(parsed.risks, "Risks"),
        evidence: this.section(parsed.evidence, "Evidence"),
      };
    } catch {
      throw new BadGatewayException("AI provider returned invalid JSON");
    }
  }

  private section(value: unknown, fallbackTitle: string): AiSummarySection {
    const section = value as Partial<AiSummarySection> | undefined;
    const items = Array.isArray(section?.items) ? section.items.filter((item): item is string => typeof item === "string").slice(0, 6) : [];
    return { title: typeof section?.title === "string" ? section.title : fallbackTitle, items };
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

  private systemPrompt() {
    return [
      "You are Mira's work summarizer.",
      "Return only valid JSON.",
      "Do not include hidden reasoning, chain-of-thought, markdown fences, or prose outside the JSON object.",
      "Do not diagnose personality or mental state. Describe evidence-based work style only.",
      "Use concise, specific, professional language.",
    ].join(" ");
  }
}
