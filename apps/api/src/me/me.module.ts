import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
