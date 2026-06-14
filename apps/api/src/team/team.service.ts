import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createId } from "../common/ids";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspaceContentService } from "../workspace-content/workspace-content.service";
import { CreateTeamNodeDto, UpdateTeamNodeDto } from "./dto/team-node.dto";

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: WorkspaceContentService,
  ) {}

  listTree() {
    return this.prisma.teamNode.findMany({
      where: { active: true },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async create(payload: CreateTeamNodeDto) {
    if (payload.parentId) await this.ensureNode(payload.parentId);

    return this.prisma.teamNode.create({
      data: {
        id: createId("node"),
        parentId: payload.parentId,
        name: payload.name.trim(),
        title: payload.title?.trim() || null,
        sortOrder: payload.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, payload: UpdateTeamNodeDto) {
    await this.ensureNode(id);
    if (payload.parentId) {
      await this.ensureNode(payload.parentId);
      const descendants = await this.descendantIds(id);
      if (payload.parentId === id || descendants.includes(payload.parentId)) {
        throw new BadRequestException("A team node cannot be moved under itself or its descendants");
      }
    }

    const data: {
      parent?: { connect: { id: string } } | { disconnect: true };
      name?: string;
      title?: string | null;
      sortOrder?: number;
      active?: boolean;
    } = {};
    if (payload.parentId !== undefined) data.parent = payload.parentId ? { connect: { id: payload.parentId } } : { disconnect: true };
    if (payload.name !== undefined) data.name = payload.name.trim();
    if (payload.title !== undefined) data.title = payload.title?.trim() || null;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;
    if (payload.active !== undefined) data.active = payload.active;

    const updated = await this.prisma.teamNode.update({ where: { id }, data });
    await this.content.syncTeamNodeUsers(id);
    return updated;
  }

  async remove(id: string) {
    await this.ensureNode(id);
    const activeChild = await this.prisma.teamNode.findFirst({
      where: { parentId: id, active: true },
    });
    if (activeChild) throw new ConflictException("Cannot delete a node with active children");

    return this.prisma.teamNode.update({
      where: { id },
      data: { active: false },
    });
  }

  async idsForScope(nodeId: string, scope: "self" | "tree") {
    await this.ensureNode(nodeId);
    if (scope === "self") return [nodeId];
    return [nodeId, ...(await this.descendantIds(nodeId))];
  }

  private async ensureNode(id: string) {
    const node = await this.prisma.teamNode.findFirst({
      where: { id, active: true },
    });
    if (!node) throw new NotFoundException("Team node not found");
    return node;
  }

  private async descendantIds(rootId: string) {
    const nodes = await this.prisma.teamNode.findMany({
      where: { active: true },
      select: { id: true, parentId: true },
    });
    const byParent = new Map<string, string[]>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      byParent.set(node.parentId, [...(byParent.get(node.parentId) || []), node.id]);
    }

    const result: string[] = [];
    const queue = [...(byParent.get(rootId) || [])];
    while (queue.length) {
      const id = queue.shift()!;
      result.push(id);
      queue.push(...(byParent.get(id) || []));
    }
    return result;
  }
}
