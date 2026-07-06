/**
 * Seeds the initial admin account using raw pg + bcryptjs.
 * Run: node src/seed-admin.mjs
 */
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows } = await pool.query("SELECT id FROM users WHERE username = $1", ["admin"]);
  if (rows.length > 0) {
    console.log("✅ Admin account already exists — skipping seed.");
    await pool.end();
    process.exit(0);
  }

  const hashed = await bcrypt.hash("admin123", 12);
  await pool.query(
    `INSERT INTO users (username, full_name, password, role, can_view, can_download, can_upload, can_edit, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    ["admin", "مدير النظام", hashed, "admin", true, true, true, true, true]
  );

  console.log("✅ Admin account created:");
  console.log("   Username : admin");
  console.log("   Password : admin123");
  console.log("   ⚠️  Change the password after first login.");
  await pool.end();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
