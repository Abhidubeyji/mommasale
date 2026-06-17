import { db } from "@/lib/db"

/**
 * Ensures the `login_logs` table exists in the database.
 * Safe to call multiple times - uses CREATE TABLE IF NOT EXISTS.
 */
export async function ensureLoginLogsTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "login_logs" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "success" BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT "login_logs_pkey" PRIMARY KEY ("id")
      );
    `)
    // Create indexes if they don't exist
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "login_logs_userId_idx" ON "login_logs"("userId");
    `).catch(() => {})
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "login_logs_loginTime_idx" ON "login_logs"("loginTime");
    `).catch(() => {})
  } catch (error) {
    console.error("Failed to ensure login_logs table:", error)
  }
}

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
    if (exists) {
      console.log("dsrEnabled column already exists")
      return
    }

    console.log("dsrEnabled column does NOT exist, creating it...")

    // Try ADD COLUMN IF NOT EXISTS (PostgreSQL 9.6+)
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dsrEnabled" BOOLEAN NOT NULL DEFAULT false;
      `)
      console.log("dsrEnabled column created via ADD COLUMN IF NOT EXISTS")
      return
    } catch (err) {
      console.error("ADD COLUMN IF NOT EXISTS failed:", err)
    }

    // Fallback: try without IF NOT EXISTS (will error if exists, but we already checked)
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "users" ADD COLUMN "dsrEnabled" BOOLEAN NOT NULL DEFAULT false;
      `)
      console.log("dsrEnabled column created via ADD COLUMN")
    } catch (err) {
      console.error("ADD COLUMN also failed:", err)
    }

    // Verify it was created
    const existsAfter = await columnExists("users", "dsrEnabled")
    console.log("After attempt, column exists:", existsAfter)
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
