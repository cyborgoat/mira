import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SuperuserGuard } from "./superuser.guard";

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("MIRA_JWT_SECRET", "local-dev-secret-change-me"),
        signOptions: {
          expiresIn: config.get<string>("MIRA_JWT_ACCESS_EXPIRY", "1d"),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, SuperuserGuard],
  exports: [JwtModule, JwtAuthGuard, SuperuserGuard],
})
export class AuthModule {}
