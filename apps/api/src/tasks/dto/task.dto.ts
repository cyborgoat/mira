import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateTaskDto {
  @IsString()
  ownerNodeId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  details?: string;
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
}
