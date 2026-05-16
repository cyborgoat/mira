import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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
    const response = await this.fetchJson(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider === "openrouter" ? this.openRouterHeaders() : {}),
      },
      body: JSON.stringify({
        model: this.model(provider),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: this.systemPrompt() },
          { role: "user", content: prompt },
        ],
      }),
    });

    const text = (response as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content;
    if (!text) throw new BadGatewayException("AI provider returned an empty response");
    return text;
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
      const response = await fetch(url, { ...init, signal: controller.signal });
      const body = await response.text();
      if (!response.ok) throw new BadGatewayException(`AI provider request failed: ${response.status}`);
      return JSON.parse(body);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException("AI provider request failed");
    } finally {
      clearTimeout(timeout);
    }
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

  private systemPrompt() {
    return [
      "You are Mira's work summarizer.",
      "Return only valid JSON.",
      "Do not diagnose personality or mental state. Describe evidence-based work style only.",
      "Use concise, specific, professional language.",
    ].join(" ");
  }
}
