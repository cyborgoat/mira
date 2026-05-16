import { IsIn, IsOptional, IsString } from "class-validator";

export class AiSummaryDto {
  @IsIn(["personal", "team"])
  mode!: "personal" | "team";

  @IsOptional()
  @IsString()
  targetNodeId?: string;

  @IsOptional()
  @IsIn(["person", "subtree"])
  targetScope?: "person" | "subtree";

  @IsIn(["en", "zh"])
  language!: "en" | "zh";
}
