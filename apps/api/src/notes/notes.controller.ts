import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateNoteDto, UpdateNoteDto } from "./dto/note.dto";
import { NotesService } from "./notes.service";

@Controller("notes")
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@Query("nodeId") nodeId?: string, @Query("scope") scope: "self" | "tree" = "self", @Query("query") query?: string) {
    return this.notes.list({ nodeId, scope, query });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() payload: CreateNoteDto) {
    return this.notes.create(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  update(@Param("id") id: string, @Body() payload: UpdateNoteDto) {
    return this.notes.update(id, payload);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.notes.remove(id);
  }
}
