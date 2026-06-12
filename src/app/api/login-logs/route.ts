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

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    const where: Record<string, unknown> = {}
    if (userId) {
      where.userId = userId
    }

    const logs = await db.loginLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { loginTime: "desc" },
      take: limit,
      skip: offset
    })

    const total = await db.loginLog.count({ where })

    return NextResponse.json({ logs, total })
  } catch (error) {
    console.error("Get login logs error:", error)
    return NextResponse.json({ error: "Failed to fetch login logs" }, { status: 500 })
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

    // Delete logs older than specified days
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const result = await db.loginLog.deleteMany({
      where: {
        loginTime: {
          lt: cutoffDate
        }
      }
    })

    return NextResponse.json({ 
      message: `Deleted ${result.count} login logs older than ${daysToKeep} days` 
    })
  } catch (error) {
    console.error("Delete login logs error:", error)
    return NextResponse.json({ error: "Failed to delete login logs" }, { status: 500 })
  }
}
