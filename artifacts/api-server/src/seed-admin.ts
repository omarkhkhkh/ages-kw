/**
 * Run once to create the initial admin account.
 * Usage: npx tsx src/seed-admin.ts
 */
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const existing = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
  if (existing.length > 0) {
    console.log("✅ Admin account already exists.");
    process.exit(0);
  }

  const hashed = await bcrypt.hash("admin123", 12);
  await db.insert(usersTable).values({
    username: "admin",
    fullName: "مدير النظام",
    password: hashed,
    role: "admin",
    canView: true,
    canDownload: true,
    canUpload: true,
    canEdit: true,
  });

  console.log("✅ Admin account created:");
  console.log("   Username: admin");
  console.log("   Password: admin123");
  console.log("   ⚠️  Change the password after first login via إدارة المستخدمين");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
