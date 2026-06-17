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

    // Use raw SQL - ordered by serialNo ASCENDING (1, 2, 3...)
    let query = `
      SELECT 
        d.id, 
        d."serialNo", 
        d."userId", 
        d."counterName", 
        d."mobileNo", 
        d.address, 
        d.remark, 
        d.latitude, 
        d.longitude, 
        d."locationText", 
        d."createdAt",
        json_build_object(
          'id', u.id,
          'name', u.name,
          'role', u.role
        ) as user
      FROM dsr_reports d
      LEFT JOIN users u ON d."userId" = u.id
      WHERE 1=1
    `
    const params: unknown[] = []
    let paramIdx = 1

    if (userId && userId !== "all") {
      query += ` AND d."userId" = $${paramIdx++}`
      params.push(userId)
    }
    // Convert UTC timestamp to IST by adding 5 hours 30 minutes, then extract date
    // This ensures records created in India show on the correct date when filtered
    if (startDate) {
      query += ` AND (d."createdAt" + INTERVAL '5 hours 30 minutes')::date >= $${paramIdx++}::date`
      params.push(startDate)
    }
    if (endDate) {
      query += ` AND (d."createdAt" + INTERVAL '5 hours 30 minutes')::date <= $${paramIdx++}::date`
      params.push(endDate)
    }

    query += ` ORDER BY d."serialNo" ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`
    params.push(limit, offset)

    const reports = await db.$queryRawUnsafe(query, ...params)

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM dsr_reports WHERE 1=1`
    const countParams: unknown[] = []
    let countIdx = 1
    if (userId && userId !== "all") {
      countQuery += ` AND "userId" = $${countIdx++}`
      countParams.push(userId)
    }
    if (startDate) {
      countQuery += ` AND ("createdAt" + INTERVAL '5 hours 30 minutes')::date >= $${countIdx++}::date`
      countParams.push(startDate)
    }
    if (endDate) {
      countQuery += ` AND ("createdAt" + INTERVAL '5 hours 30 minutes')::date <= $${countIdx++}::date`
      countParams.push(endDate)
    }

    const totalResult = await db.$queryRawUnsafe(countQuery, ...countParams)
    const total = Number((totalResult as Array<{ count: bigint }>)[0]?.count || 0)

    // Serialize dates
    const serializedReports = (reports as Array<{ createdAt: Date }>).map(r => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt
    }))

    return NextResponse.json({ reports: serializedReports, total })
  } catch (error) {
    console.error("Get admin DSR error:", error)
    return NextResponse.json({ error: "Failed to fetch DSR reports", details: String(error) }, { status: 500 })
  }
}

// DELETE - Delete DSR report(s) (Admin only)
// Supports: single delete (?id=xxx) OR bulk delete by date range (?startDate=xxx&endDate=xxx)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureDsrTable()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const userId = searchParams.get("userId")

    // Single report delete
    if (id) {
      await db.$executeRawUnsafe(`DELETE FROM dsr_reports WHERE id = $1;`, id)
      return NextResponse.json({ message: "DSR report deleted successfully", id })
    }

    // Bulk delete by date range (and optional userId filter)
    if (!startDate && !endDate) {
      return NextResponse.json({ 
        error: "Either 'id' parameter OR 'startDate'/'endDate' parameters required" 
      }, { status: 400 })
    }

    // Convert UTC timestamp to IST by adding 5 hours 30 minutes, then extract date
    let query = `DELETE FROM dsr_reports WHERE 1=1`
    const params: unknown[] = []
    let paramIdx = 1

    if (startDate) {
      query += ` AND ("createdAt" + INTERVAL '5 hours 30 minutes')::date >= $${paramIdx++}::date`
      params.push(startDate)
    }
    if (endDate) {
      query += ` AND ("createdAt" + INTERVAL '5 hours 30 minutes')::date <= $${paramIdx++}::date`
      params.push(endDate)
    }
    if (userId && userId !== "all") {
      query += ` AND "userId" = $${paramIdx++}`
      params.push(userId)
    }

    const deletedCount = await db.$executeRawUnsafe(query, ...params)

    return NextResponse.json({ 
      message: `Deleted ${deletedCount} DSR report(s) successfully`,
      deletedCount,
      filters: { startDate, endDate, userId }
    })
  } catch (error) {
    console.error("Delete DSR error:", error)
    return NextResponse.json({ 
      error: "Failed to delete DSR report(s)", 
      details: String(error) 
    }, { status: 500 })
  }
}
