import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const LLM_PROVIDERS = ["openai", "openrouter", "anthropic", "custom-openai-compatible"] as const;
export type LlmProvider = typeof LLM_PROVIDERS[number];

export type LlmConfigFile = {
  provider?: LlmProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  proxy?: string;
};

export type UpdateLlmConfig = Partial<Omit<LlmConfigFile, "apiKey">> & {
  apiKey?: string;
  clearApiKey?: boolean;
};

export type ResolvedLlmConfig = Required<LlmConfigFile> & {
  source: "file" | "env" | "defaults";
};

export type RedactedLlmConfig = Omit<ResolvedLlmConfig, "apiKey"> & {
  hasApiKey: boolean;
};

@Injectable()
export class LlmConfigService {
  constructor(private readonly config: ConfigService) {}

  async view(userId: string): Promise<RedactedLlmConfig> {
    const { apiKey, ...config } = await this.resolve(userId);
    return { ...config, hasApiKey: Boolean(apiKey) };
  }

  async update(userId: string, payload: UpdateLlmConfig): Promise<RedactedLlmConfig> {
    const current = await this.readFileConfig(userId);
    const next: LlmConfigFile = { ...current };

    if (payload.provider !== undefined) next.provider = payload.provider;
    if (payload.baseUrl !== undefined) next.baseUrl = payload.baseUrl.trim();
    if (payload.model !== undefined) next.model = payload.model.trim();
    if (payload.maxTokens !== undefined) next.maxTokens = this.positiveNumber(payload.maxTokens, "maxTokens");
    if (payload.timeoutMs !== undefined) next.timeoutMs = this.positiveNumber(payload.timeoutMs, "timeoutMs");
    if (payload.proxy !== undefined) next.proxy = payload.proxy.trim();
    if (payload.clearApiKey) next.apiKey = "";
    else if (payload.apiKey !== undefined && payload.apiKey.trim()) next.apiKey = payload.apiKey.trim();

    await this.writeFileConfig(userId, next);
    return this.view(userId);
  }

  async resolve(userId: string): Promise<ResolvedLlmConfig> {
    const file = await this.readFileConfig(userId);
    const fileExists = existsSync(this.configPath(userId));
    const provider = this.provider(file.provider ?? this.envString("MIRA_AI_PROVIDER", "openai"));
    const source = fileExists ? "file" : this.hasEnvConfig() ? "env" : "defaults";
    return {
      provider,
      apiKey: this.stringValue(file.apiKey, this.envString("MIRA_AI_API_KEY", "")),
      baseUrl: this.stringValue(file.baseUrl, this.envString("MIRA_AI_BASE_URL", this.defaultBaseUrl(provider))).replace(/\/+$/, ""),
      model: this.stringValue(file.model, this.envString("MIRA_AI_MODEL", this.defaultModel(provider))),
      maxTokens: this.numberValue(file.maxTokens, this.envNumber("MIRA_AI_MAX_TOKENS", 4000)),
      timeoutMs: this.numberValue(file.timeoutMs, this.envNumber("MIRA_AI_TIMEOUT_MS", 45000)),
      proxy: this.stringValue(file.proxy, this.envString("MIRA_AI_PROXY", "")),
      source,
    };
  }

  defaultBaseUrl(provider: LlmProvider) {
    if (provider === "openrouter") return "https://openrouter.ai/api/v1";
    if (provider === "anthropic") return "https://api.anthropic.com";
    return "https://api.openai.com/v1";
  }

  defaultModel(provider: LlmProvider) {
    return provider === "anthropic" ? "claude-3-5-sonnet-latest" : "gpt-5.2";
  }

  private provider(value: string): LlmProvider {
    if ((LLM_PROVIDERS as readonly string[]).includes(value)) return value as LlmProvider;
    throw new BadRequestException(`Unsupported AI provider: ${value}`);
  }

  private async readFileConfig(userId: string): Promise<LlmConfigFile> {
    const path = this.configPath(userId);
    if (!existsSync(path)) return {};
    try {
      const parsed = JSON.parse(await readFile(path, "utf8")) as LlmConfigFile;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      throw new BadRequestException("LLM configuration file is invalid JSON");
    }
  }

  private async writeFileConfig(userId: string, config: LlmConfigFile) {
    const path = this.configPath(userId);
    await mkdir(dirname(path), { recursive: true });
    const tempPath = `${path}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await rename(tempPath, path);
  }

  private configPath(userId: string) {
    return join(this.configRoot(), `${this.safeUserId(userId)}.json`);
  }

  private configRoot() {
    return resolve(this.config.get<string>("MIRA_LLM_CONFIG_ROOT", "") || join(this.dataDir(), "config", "llm"));
  }

  private safeUserId(userId: string) {
    const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return safe || "unknown";
  }

  private dataDir() {
    const candidates = [
      resolve(process.cwd(), "../../mira-workspace"),
      resolve(process.cwd(), "mira-workspace"),
      resolve(__dirname, "../../../../mira-workspace"),
    ];
    return candidates.find((path) => existsSync(path)) || candidates[0];
  }

  private hasEnvConfig() {
    return ["MIRA_AI_PROVIDER", "MIRA_AI_API_KEY", "MIRA_AI_BASE_URL", "MIRA_AI_MODEL", "MIRA_AI_MAX_TOKENS", "MIRA_AI_TIMEOUT_MS", "MIRA_AI_PROXY"]
      .some((key) => Boolean(this.config.get<string>(key, "").trim()));
  }

  private envString(key: string, fallback: string) {
    return this.config.get<string>(key, fallback).trim() || fallback;
  }

  private envNumber(key: string, fallback: number) {
    return Number(this.config.get<string>(key, String(fallback))) || fallback;
  }

  private stringValue(value: string | undefined, fallback: string) {
    return value === undefined ? fallback : value.trim();
  }

  private numberValue(value: number | undefined, fallback: number) {
    return value === undefined ? fallback : this.positiveNumber(value, "number");
  }

  private positiveNumber(value: number, label: string) {
    if (!Number.isFinite(value) || value <= 0) throw new BadRequestException(`${label} must be greater than 0`);
    return Math.round(value);
  }
}
