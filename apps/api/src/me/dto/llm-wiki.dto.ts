import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UploadLlmWikiSourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  filename!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}

export class IngestLlmWikiSourceDto {
  @IsString()
  @MinLength(1)
  sourcePath!: string;

  @IsIn(["en", "zh"])
  language!: "en" | "zh";
}

export class QueryLlmWikiDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  question!: string;

  @IsIn(["en", "zh"])
  language!: "en" | "zh";

  @IsOptional()
  @IsBoolean()
  saveAsPage?: boolean;
}

export class LintLlmWikiDto {
  @IsIn(["en", "zh"])
  language!: "en" | "zh";
}
