import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { ensureDsrTable, ensureDsrEnabledColumn } from "@/lib/dsr-db"

// GET - Get all DSR reports (Admin only) with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureDsrTable()
    await ensureDsrEnabledColumn()

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = parseInt(searchParams.get("limit") || "1000")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Build where clause
    const where: Record<string, unknown> = {}
    if (userId && userId !== "all") {
      where.userId = userId
    }
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        dateFilter.lte = end
      }
      where.createdAt = dateFilter
    }

    const reports = await db.dsr.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    })

    const total = await db.dsr.count({ where })

    return NextResponse.json({ reports, total })
  } catch (error) {
    console.error("Get admin DSR error:", error)
    return NextResponse.json({ error: "Failed to fetch DSR reports" }, { status: 500 })
  }
}

// DELETE - Delete a DSR report (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureDsrTable()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "DSR ID required" }, { status: 400 })
    }

    await db.dsr.delete({ where: { id } })

    return NextResponse.json({ message: "DSR report deleted successfully", id })
  } catch (error) {
    console.error("Delete DSR error:", error)
    return NextResponse.json({ error: "Failed to delete DSR report" }, { status: 500 })
  }
}
