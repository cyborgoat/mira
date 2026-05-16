import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createId } from "../common/ids";
import { PrismaService } from "../prisma/prisma.service";
import { TeamService } from "../team/team.service";
import { CreateNoteDto, UpdateNoteDto } from "./dto/note.dto";

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly team: TeamService,
  ) {}

  async list(query: { nodeId?: string; scope?: "self" | "tree"; query?: string }) {
    const where: Prisma.MeetingNoteWhereInput = {};
    if (query.nodeId) where.ownerNodeId = { in: await this.team.idsForScope(query.nodeId, query.scope || "self") };
    if (query.query) {
      where.OR = [
        { title: { contains: query.query } },
        { content: { contains: query.query } },
      ];
    }

    return this.prisma.meetingNote.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
  }

  async create(payload: CreateNoteDto) {
    await this.team.idsForScope(payload.ownerNodeId, "self");
    return this.prisma.meetingNote.create({
      data: {
        id: createId("note"),
        ownerNodeId: payload.ownerNodeId,
        title: payload.title.trim(),
        date: new Date(payload.date),
        content: payload.content,
        tags: payload.tags?.trim() || "",
      },
    });
  }

  async update(id: string, payload: UpdateNoteDto) {
    await this.ensureNote(id);
    if (!payload.title && payload.title !== undefined) throw new BadRequestException("Note title is required");

    const data: Prisma.MeetingNoteUpdateInput = {};
    if (payload.title !== undefined) data.title = payload.title.trim();
    if (payload.date !== undefined) data.date = new Date(payload.date);
    if (payload.content !== undefined) data.content = payload.content;
    if (payload.tags !== undefined) data.tags = payload.tags.trim();

    return this.prisma.meetingNote.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.ensureNote(id);
    await this.prisma.meetingNote.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureNote(id: string) {
    const note = await this.prisma.meetingNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException("Note not found");
    return note;
  }
}
