import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SuperuserGuard } from "../auth/superuser.guard";
import { Period } from "../common/period";
import { CreateTeamNodeDto, UpdateTeamNodeDto } from "./dto/team-node.dto";
import { TeamService } from "./team.service";

@Controller("team")
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @UseGuards(JwtAuthGuard)
  @Get("tree")
  tree() {
    return this.team.listTree();
  }

  @UseGuards(JwtAuthGuard, SuperuserGuard)
  @Post("nodes")
  create(@Body() payload: CreateTeamNodeDto) {
    return this.team.create(payload);
  }

  @UseGuards(JwtAuthGuard, SuperuserGuard)
  @Patch("nodes/:id")
  update(@Param("id") id: string, @Body() payload: UpdateTeamNodeDto) {
    return this.team.update(id, payload);
  }

  @UseGuards(JwtAuthGuard, SuperuserGuard)
  @Delete("nodes/:id")
  remove(@Param("id") id: string) {
    return this.team.remove(id);
  }

  @UseGuards(JwtAuthGuard, SuperuserGuard)
  @Get("view")
  view(@Query("nodeId") nodeId?: string, @Query("period") period: Period = "weekly") {
    return this.team.view(nodeId, period);
  }
}
