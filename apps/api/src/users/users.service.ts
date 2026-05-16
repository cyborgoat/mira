import { Injectable, OnModuleInit } from "@nestjs/common";
import { User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createId } from "../common/ids";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSeedSuperuser();
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async ensureSeedSuperuser() {
    const email = (process.env.MIRA_SUPERUSER_EMAIL || "admin@mira.local").toLowerCase();
    const password = process.env.MIRA_SUPERUSER_PASSWORD || "local-password";
    const existing = await this.findByEmail(email);
    if (existing) return;

    await this.prisma.user.create({
      data: {
        id: createId("usr"),
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: "superuser",
      },
    });
  }
}
