import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { ensureLoginLogsTable } from "@/lib/dsr-db"

// GET - List login logs (Admin only) - using raw SQL for reliability
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "VIEWER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure table exists
    await ensureLoginLogsTable()

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Use raw SQL to fetch login logs with user info
    let logs: Array<{
      id: string
      userId: string
      loginTime: Date
      ipAddress: string | null
      userAgent: string | null
      success: boolean
      user: {
        id: string
        name: string
        email: string | null
        role: string
      } | null
    }>

    if (userId) {
      logs = await db.$queryRaw`
        SELECT 
          l.id, 
          l."userId", 
          l."loginTime", 
          l."ipAddress", 
          l."userAgent", 
          l.success,
          json_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'role', u.role
          ) as user
        FROM login_logs l
        LEFT JOIN users u ON l."userId" = u.id
        WHERE l."userId" = ${userId}
        ORDER BY l."loginTime" DESC
        LIMIT ${limit} OFFSET ${offset};
      `
    } else {
      logs = await db.$queryRaw`
        SELECT 
          l.id, 
          l."userId", 
          l."loginTime", 
          l."ipAddress", 
          l."userAgent", 
          l.success,
          json_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'role', u.role
          ) as user
        FROM login_logs l
        LEFT JOIN users u ON l."userId" = u.id
        ORDER BY l."loginTime" DESC
        LIMIT ${limit} OFFSET ${offset};
      `
    }

    // Get total count
    const totalResult = userId
      ? await db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM login_logs WHERE "userId" = ${userId};`
      : await db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM login_logs;`
    const total = Number(totalResult[0]?.count || 0)

    // Serialize dates
    const serializedLogs = logs.map(l => ({
      ...l,
      loginTime: l.loginTime instanceof Date ? l.loginTime.toISOString() : l.loginTime
    }))

    return NextResponse.json({ logs: serializedLogs, total })
  } catch (error) {
    console.error("Get login logs error:", error)
    return NextResponse.json({ error: "Failed to fetch login logs", details: String(error) }, { status: 500 })
  }
}

// DELETE - Clear login logs (Admin only) - using raw SQL
// ?id=xxx → delete single log, ?days=0 → delete ALL logs, ?days=30 → delete older than 30 days
// ?userId=xxx → delete only for specific user
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureLoginLogsTable()

    const { searchParams } = new URL(request.url)
    const logId = searchParams.get("id")
    const daysParam = searchParams.get("days")
    const userId = searchParams.get("userId")

    // Single log delete (?id=xxx)
    if (logId) {
      await db.$executeRawUnsafe(
        `DELETE FROM "login_logs" WHERE "id" = $1;`,
        logId
      )
      return NextResponse.json({ message: "Login log deleted" })
    }

    // If days=0, delete ALL logs (with optional userId filter)
    if (daysParam === "0") {
      let result
      if (userId) {
        result = await db.$executeRawUnsafe(
          `DELETE FROM "login_logs" WHERE "userId" = $1;`,
          userId
        )
      } else {
        result = await db.$executeRawUnsafe(`DELETE FROM "login_logs";`)
      }
      return NextResponse.json({ 
        message: `Deleted all ${result} login logs`
      })
    }

    // Otherwise delete logs older than X days
    const daysToKeep = parseInt(daysParam || "30")
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    let result
    if (userId) {
      result = await db.$executeRawUnsafe(
        `DELETE FROM "login_logs" WHERE "loginTime" < $1 AND "userId" = $2;`,
        cutoffDate,
        userId
      )
    } else {
      result = await db.$executeRawUnsafe(
        `DELETE FROM "login_logs" WHERE "loginTime" < $1;`,
        cutoffDate
      )
    }

    return NextResponse.json({ 
      message: `Deleted ${result} login logs older than ${daysToKeep} days` 
    })
  } catch (error) {
    console.error("Delete login logs error:", error)
    return NextResponse.json({ error: "Failed to delete login logs", details: String(error) }, { status: 500 })
  }
}
