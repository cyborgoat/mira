import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

export const TEST_USER_IDS = {
  admin: "0fa48143-b9dd-4b8d-843f-0b08feee4689",
  manager: "093c046d-0133-40ef-8eda-ab3b52479161",
  alex: "bb9cfe4c-5c47-4f21-8287-ee21b1aa5bec",
  sam: "a85bcbaf-a380-4e25-8ea8-9ce1b00f11b7",
  frontend: "32bff7c0-4fa4-4187-b81d-ca89093fdf95",
};

export async function seedTestDb(dbPath: string, password: string) {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  });
  await client.$connect();
  try {
    await client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS User (
        id TEXT NOT NULL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        role TEXT,
        isSuperuser BOOLEAN NOT NULL DEFAULT false,
        teamNodeId TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL,
        CONSTRAINT User_teamNodeId_fkey FOREIGN KEY (teamNodeId) REFERENCES TeamNode (id) ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS TeamNode (
        id TEXT NOT NULL PRIMARY KEY,
        parentId TEXT,
        name TEXT NOT NULL,
        title TEXT,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL,
        CONSTRAINT TeamNode_parentId_fkey FOREIGN KEY (parentId) REFERENCES TeamNode (id) ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    const now = new Date();
    const passwordHash = await bcrypt.hash(password, 12);
    await client.teamNode.createMany({
      data: [
        { id: "node_root", name: "Mira Team", title: "Organization", parentId: null, sortOrder: 0, active: true, updatedAt: now },
        { id: "node_manager", name: "Product Engineering", title: "Engineering Manager", parentId: "node_root", sortOrder: 1, active: true, updatedAt: now },
        { id: "node_alex", name: "Alex Chen", title: "Frontend Engineer", parentId: "node_manager", sortOrder: 1, active: true, updatedAt: now },
        { id: "node_sam", name: "Sam Rivera", title: "Backend Engineer", parentId: "node_manager", sortOrder: 2, active: true, updatedAt: now },
      ],
    });
    await client.user.createMany({
      data: [
        { id: TEST_USER_IDS.admin, email: "admin@example.com", passwordHash, role: "System Owner", isSuperuser: true, teamNodeId: "node_root", updatedAt: now },
        { id: TEST_USER_IDS.manager, email: "manager@mira.local", passwordHash, role: "Engineering Lead", isSuperuser: false, teamNodeId: "node_manager", updatedAt: now },
        { id: TEST_USER_IDS.alex, email: "alex@mira.local", passwordHash, role: "Frontend Specialist", isSuperuser: false, teamNodeId: "node_alex", updatedAt: now },
        { id: TEST_USER_IDS.sam, email: "sam@mira.local", passwordHash, role: "Platform Specialist", isSuperuser: false, teamNodeId: "node_sam", updatedAt: now },
      ],
    });
  } finally {
    await client.$disconnect();
  }
}
