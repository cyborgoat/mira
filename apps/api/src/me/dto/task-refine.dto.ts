import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";

export class TaskRefineMessageDto {
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}

export class TaskAiRefineDto {
  @IsIn(["en", "zh"])
  language!: "en" | "zh";

  @IsOptional()
  @IsIn(["personal", "team"])
  scope?: "personal" | "team";

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => TaskRefineMessageDto)
  messages!: TaskRefineMessageDto[];
}
