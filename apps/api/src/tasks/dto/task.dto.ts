import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateTaskDto {
  @IsOptional()
  @IsString()
  ownerNodeId?: string;

  @IsOptional()
  @IsUUID(4)
  ownerUserId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsIn(["low", "normal", "high", "urgent"])
  priority?: "low" | "normal" | "high" | "urgent";

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsIn(["open", "complete"])
  status?: "open" | "complete";

  @IsOptional()
  @IsIn(["low", "normal", "high", "urgent"])
  priority?: "low" | "normal" | "high" | "urgent";

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
