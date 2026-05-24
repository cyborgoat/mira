import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export type LlmWikiViewMode = "personal" | "team";
export type LlmWikiScope = "personal" | "team";

export class UploadLlmWikiSourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  filename!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsIn(["personal", "team"])
  view?: LlmWikiViewMode;
}

export class IngestLlmWikiSourceDto {
  @IsString()
  @MinLength(1)
  sourcePath!: string;

  @IsIn(["en", "zh"])
  language!: "en" | "zh";

  @IsOptional()
  @IsIn(["personal", "team"])
  view?: LlmWikiViewMode;
}

export class GenerateLlmWikiDto {
  @IsIn(["daily", "weekly", "monthly", "historical"])
  period!: "daily" | "weekly" | "monthly" | "historical";

  @IsOptional()
  @IsIn(["personal", "team"])
  scope?: LlmWikiScope;

  @IsIn(["en", "zh"])
  language!: "en" | "zh";
}

export class LintLlmWikiDto {
  @IsIn(["en", "zh"])
  language!: "en" | "zh";

  @IsOptional()
  @IsIn(["personal", "team"])
  view?: LlmWikiViewMode;
}

export class UpdateLlmWikiPageDto {
  @IsString()
  @MinLength(1)
  path!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsIn(["personal", "team"])
  view?: LlmWikiViewMode;
}
