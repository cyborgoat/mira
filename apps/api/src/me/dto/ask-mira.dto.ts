import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export type AskMiraSourceType = "wiki" | "wiki-index" | "wiki-page" | "task" | "note" | "team-member";

export class AskMiraDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  question!: string;

  @IsIn(["en", "zh"])
  language!: "en" | "zh";

  @IsOptional()
  @IsIn(["personal", "team"])
  scope?: "personal" | "team";

  @IsOptional()
  @IsString()
  ownerId?: string;
}

export type AskMiraSourcePayload = {
  id: string;
  type: AskMiraSourceType;
  title: string;
  ownerId: string;
  ownerName: string;
  path?: string;
  snippet: string;
  content: string;
};

export type AskMiraResult = {
  answer: string;
  sources: AskMiraSourcePayload[];
};
