import { db } from "@/lib/db"

/**
 * Ensures the `dsr_reports` table exists in the database.
 * Safe to call multiple times - uses CREATE TABLE IF NOT EXISTS.
 * This is needed because Prisma migrations don't auto-run on Vercel.
 */
export async function ensureDsrTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "dsr_reports" (
        "id" TEXT NOT NULL,
        "serialNo" INTEGER NOT NULL DEFAULT 1,
        "userId" TEXT NOT NULL,
        "counterName" TEXT NOT NULL,
        "mobileNo" TEXT NOT NULL,
        "address" TEXT,
        "remark" TEXT,
        "latitude" DOUBLE PRECISION,
        "longitude" DOUBLE PRECISION,
        "locationText" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "dsr_reports_pkey" PRIMARY KEY ("id")
      );
    `)
    // Create indexes if they don't exist
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "dsr_reports_userId_idx" ON "dsr_reports"("userId");
    `).catch(() => {})
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "dsr_reports_createdAt_idx" ON "dsr_reports"("createdAt");
    `).catch(() => {})
  } catch (error) {
    console.error("Failed to ensure dsr_reports table:", error)
  }
}

/**
 * Checks if the `dsrEnabled` column exists on the users table.
 */
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = ${tableName} 
        AND column_name = ${columnName}
      ) as exists;
    `
    return result[0]?.exists ?? false
  } catch (error) {
    console.error(`Failed to check if column ${columnName} exists:`, error)
    return false
  }
}

/**
 * Ensures the `dsrEnabled` column exists on the `users` table.
 * Safe to call multiple times. Tries multiple approaches for compatibility.
 */
export async function ensureDsrEnabledColumn() {
  try {
    // First check if column already exists
    const exists = await columnExists("users", "dsrEnabled")
    if (exists) return

    // Try ADD COLUMN IF NOT EXISTS (PostgreSQL 9.6+)
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dsrEnabled" BOOLEAN NOT NULL DEFAULT false;
      `)
      return
    } catch (err) {
      console.error("ADD COLUMN IF NOT EXISTS failed, trying without IF NOT EXISTS:", err)
    }

    // Fallback: try without IF NOT EXISTS (will error if exists, but we already checked)
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "users" ADD COLUMN "dsrEnabled" BOOLEAN NOT NULL DEFAULT false;
      `)
    } catch (err) {
      console.error("ADD COLUMN also failed (column may already exist):", err)
    }
  } catch (error) {
    console.error("Failed to ensure dsrEnabled column:", error)
  }
}

/**
 * Get the next serial number for a user's DSR reports.
 * Serial numbers are per-user, starting from 1.
 */
export async function getNextDsrSerialNo(userId: string): Promise<number> {
  try {
    const result = await db.$queryRaw<Array<{ max_serial: number }>>`
      SELECT COALESCE(MAX("serialNo"), 0) + 1 as max_serial FROM "dsr_reports" WHERE "userId" = ${userId};
    `
    return result[0]?.max_serial || 1
  } catch (error) {
    console.error("Failed to get next DSR serial number:", error)
    return 1
  }
}
