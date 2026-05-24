import { BadRequestException, Injectable } from "@nestjs/common";
import { TeamService } from "../team/team.service";
import { WorkspaceContentService } from "../workspace-content/workspace-content.service";
import { CreateNoteDto, UpdateNoteDto } from "./dto/note.dto";

@Injectable()
export class NotesService {
  constructor(
    private readonly team: TeamService,
    private readonly content: WorkspaceContentService,
  ) {}

  async list(query: { nodeId?: string; scope?: "self" | "tree"; query?: string }) {
    const nodeIds = query.nodeId ? await this.team.idsForScope(query.nodeId, query.scope || "self") : undefined;
    return this.content.listNotes({ nodeIds, query: query.query });
  }

  async create(payload: CreateNoteDto) {
    if (payload.ownerUserId) return this.content.createNoteForUser(payload.ownerUserId, payload);
    if (!payload.ownerNodeId) throw new BadRequestException("ownerNodeId or ownerUserId is required");
    await this.team.idsForScope(payload.ownerNodeId, "self");
    return this.content.createNote(payload.ownerNodeId, payload);
  }

  async update(id: string, payload: UpdateNoteDto) {
    return this.content.updateNote(id, payload);
  }

  async remove(id: string) {
    return this.content.deleteNote(id);
  }
}
