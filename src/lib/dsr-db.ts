import { db } from "@/lib/db"

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
  } catch (error) {
    console.error("Failed to ensure dsr_reports table:", error)
  }
}

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
    return false
  }
}

export async function ensureDsrEnabledColumn() {
  try {
    const exists = await columnExists("users", "dsrEnabled")
    if (exists) return

    try {
      await db.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dsrEnabled" BOOLEAN NOT NULL DEFAULT false;`)
      return
    } catch (err) {
      console.error("ADD COLUMN IF NOT EXISTS failed:", err)
    }

    try {
      await db.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN "dsrEnabled" BOOLEAN NOT NULL DEFAULT false;`)
    } catch (err) {
      console.error("ADD COLUMN also failed:", err)
    }
  } catch (error) {
    console.error("Failed to ensure dsrEnabled column:", error)
  }
}

export async function getNextDsrSerialNo(userId: string): Promise<number> {
  try {
    const result = await db.$queryRaw<Array<{ max_serial: number }>>`
      SELECT COALESCE(MAX("serialNo"), 0) + 1 as max_serial FROM "dsr_reports" WHERE "userId" = ${userId};
    `
    return result[0]?.max_serial || 1
  } catch (error) {
    return 1
  }
}