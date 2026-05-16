import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateNoteDto {
  @IsString()
  ownerNodeId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsDateString()
  date!: string;

  @IsString()
  content!: string;
}

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
