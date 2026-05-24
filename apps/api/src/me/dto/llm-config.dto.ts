import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { LLM_PROVIDERS, LlmProvider } from "../../ai/llm-config.service";

export class UpdateLlmConfigDto {
  @IsOptional()
  @IsIn(LLM_PROVIDERS)
  provider?: LlmProvider;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200000)
  maxTokens?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(600000)
  timeoutMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  proxy?: string;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;
}
