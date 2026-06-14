import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SuperuserGuard } from "../auth/superuser.guard";
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
}
