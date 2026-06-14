import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";

export type ReportSourceType = "task" | "note" | "team-member";

export type ReportSourcePayload = {
  id: string;
  type: ReportSourceType;
  title: string;
  ownerId: string;
  ownerName: string;
  path?: string;
  snippet: string;
  content: string;
};

export class GenerateReportDto {
  @IsIn(["daily", "weekly", "monthly"])
  period!: "daily" | "weekly" | "monthly";

  @IsOptional()
  @IsIn(["personal", "team"])
  scope?: "personal" | "team";

  @IsIn(["en", "zh"])
  language!: "en" | "zh";

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  includedTaskIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  includedNoteIds?: string[];

  @IsOptional()
  @IsIn(["concise", "value", "effort"])
  stylePreset?: "concise" | "value" | "effort";
}

export class ReportUploadFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2_000_000)
  content!: string;
}

export class UploadReportHistoryDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ReportUploadFileDto)
  files!: ReportUploadFileDto[];
}

export class ProcessReportColdStartDto {
  @IsIn(["en", "zh"])
  language!: "en" | "zh";
}

export class RefineReportMessageDto {
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}

export class RefineReportDto {
  @IsIn(["en", "zh"])
  language!: "en" | "zh";

  @IsIn(["daily", "weekly", "monthly"])
  period!: "daily" | "weekly" | "monthly";

  @IsOptional()
  @IsIn(["personal", "team"])
  scope?: "personal" | "team";

  @IsOptional()
  @IsIn(["concise", "value", "effort"])
  stylePreset?: "concise" | "value" | "effort";

  @IsString()
  @MaxLength(200_000)
  draft!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => RefineReportMessageDto)
  messages?: RefineReportMessageDto[];
}
