import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET - List login logs (Admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Try to create table if not exists
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS login_logs (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "ipAddress" TEXT,
          "userAgent" TEXT,
          success BOOLEAN NOT NULL DEFAULT true
        )
      `)
      
      // Create index
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS login_logs_userId_idx ON login_logs("userId")
      `)
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS login_logs_loginTime_idx ON login_logs("loginTime")
      `)
    } catch (createError) {
      console.log("Table might already exist:", createError)
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const limit = parseInt(searchParams.get("limit") || "500")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Try to fetch login logs using raw query
    let logs: Array<{
      id: string
      userId: string
      loginTime: Date
      success: boolean
      user: { id: string; name: string; email: string | null; role: string }
    }> = []
    let total = 0

    try {
      const whereClause = userId ? `WHERE ll."userId" = $1` : ''
      
      const logsResult = await db.$queryRawUnsafe(`
        SELECT 
          ll.id, 
          ll."userId", 
          ll."loginTime", 
          ll.success,
          u.id as "userId_2",
          u.name as "userName",
          u.email as "userEmail",
          u.role as "userRole"
        FROM login_logs ll
        JOIN users u ON ll."userId" = u.id
        ${whereClause}
        ORDER BY ll."loginTime" DESC
        LIMIT ${limit} OFFSET ${offset}
      `, ...(userId ? [userId] : [])) as Array<{
        id: string
        userId: string
        loginTime: Date
        success: boolean
        userId_2: string
        userName: string
        userEmail: string | null
        userRole: string
      }>

      logs = logsResult.map(row => ({
        id: row.id,
        userId: row.userId,
        loginTime: row.loginTime,
        success: row.success,
        user: {
          id: row.userId_2,
          name: row.userName,
          email: row.userEmail,
          role: row.userRole
        }
      }))

      // Get total count
      const countResult = await db.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM login_logs ${whereClause}
      `, ...(userId ? [userId] : [])) as Array<{ count: bigint }>
      
      total = Number(countResult[0]?.count || 0)

    } catch (fetchError) {
      console.error("Error fetching logs:", fetchError)
      return NextResponse.json({ logs: [], total: 0, message: "No logs found" })
    }

    return NextResponse.json({ logs, total })
  } catch (error) {
    console.error("Get login logs error:", error)
    return NextResponse.json({ logs: [], total: 0 }, { status: 500 })
  }
}

// DELETE - Clear old login logs (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const daysToKeep = parseInt(searchParams.get("days") || "30")

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    try {
      await db.$executeRawUnsafe(`
        DELETE FROM login_logs WHERE "loginTime" < '${cutoffDate.toISOString()}'
      `)
      return NextResponse.json({ 
        message: `Deleted login logs older than ${daysToKeep} days` 
      })
    } catch (e) {
      return NextResponse.json({ message: "No logs deleted" })
    }
  } catch (error) {
    console.error("Delete login logs error:", error)
    return NextResponse.json({ error: "Failed to delete login logs" }, { status: 500 })
  }
}
