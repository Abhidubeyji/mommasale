import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"
import { ensureDsrTable, ensureDsrEnabledColumn, getNextDsrSerialNo } from "@/lib/dsr-db"

// GET - Get current user's DSR reports (using raw SQL for reliability)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "SALES" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure table & column exist
    await ensureDsrTable()
    await ensureDsrEnabledColumn()

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    // For SALES users, fetch only their own reports
    // For ADMIN, allow filtering by userId
    const targetUserId = session.user.role === "ADMIN"
      ? (searchParams.get("userId") || session.user.id)
      : session.user.id

    // Use raw SQL to fetch reports
    const reports = await db.$queryRaw<Array<{
      id: string
      serialNo: number
      userId: string
      counterName: string
      mobileNo: string
      address: string | null
      remark: string | null
      latitude: number | null
      longitude: number | null
      locationText: string | null
      createdAt: Date
    }>>`
      SELECT id, "serialNo", "userId", "counterName", "mobileNo", address, remark, 
             latitude, longitude, "locationText", "createdAt"
      FROM dsr_reports 
      WHERE "userId" = ${targetUserId}
      ORDER BY "createdAt" DESC
      LIMIT ${limit} OFFSET ${offset};
    `

    // Get total count
    const totalResult = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM dsr_reports WHERE "userId" = ${targetUserId};
    `
    const total = Number(totalResult[0]?.count || 0)

    // Serialize dates
    const serializedReports = reports.map(r => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt
    }))

    return NextResponse.json({ reports: serializedReports, total })
  } catch (error) {
    console.error("Get DSR error:", error)
    return NextResponse.json({ error: "Failed to fetch DSR reports", details: String(error) }, { status: 500 })
  }
}

// POST - Create a new DSR report (sales user) - using raw SQL
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "SALES") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure table & column exist
    await ensureDsrTable()
    await ensureDsrEnabledColumn()

    // Check if DSR is enabled for this user (using raw SQL)
    const userResult = await db.$queryRaw<Array<{
      dsrEnabled: boolean
      isActive: boolean
    }>>`
      SELECT COALESCE("dsrEnabled", false) as "dsrEnabled", "isActive" 
      FROM users 
      WHERE id = ${session.user.id};
    `

    if (userResult.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 403 })
    }

    const user = userResult[0]
    if (!user.isActive) {
      return NextResponse.json({ error: "User is inactive" }, { status: 403 })
    }

    if (!user.dsrEnabled) {
      return NextResponse.json({ error: "DSR is not enabled for your account. Please contact admin." }, { status: 403 })
    }

    const body = await request.json()
    const { counterName, mobileNo, address, remark, latitude, longitude, locationText } = body

    // Validate required fields
    if (!counterName || !counterName.trim()) {
      return NextResponse.json({ error: "Counter Name is required" }, { status: 400 })
    }
    if (!mobileNo || !mobileNo.trim()) {
      return NextResponse.json({ error: "Mobile No is required" }, { status: 400 })
    }

    // Validate mobile number - exactly 10 digits
    const mobileDigits = mobileNo.replace(/\D/g, "")
    if (mobileDigits.length !== 10) {
      return NextResponse.json({ 
        error: "Mobile No must be exactly 10 digits" 
      }, { status: 400 })
    }

    // Get next serial number for this user
    const serialNo = await getNextDsrSerialNo(session.user.id)
    const reportId = randomUUID()

    // Insert using raw SQL
    await db.$executeRawUnsafe(
      `INSERT INTO dsr_reports (id, "serialNo", "userId", "counterName", "mobileNo", address, remark, latitude, longitude, "locationText", "createdAt") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
      reportId,
      serialNo,
      session.user.id,
      counterName.trim(),
      mobileDigits, // Store only digits
      address?.trim() || null,
      remark?.trim() || null,
      typeof latitude === "number" ? latitude : null,
      typeof longitude === "number" ? longitude : null,
      locationText || null,
      new Date()
    )

    console.log(`DSR created: id=${reportId}, serialNo=${serialNo}, user=${session.user.id}`)

    return NextResponse.json({
      success: true,
      id: reportId,
      serialNo,
      message: "DSR submitted successfully"
    })
  } catch (error) {
    console.error("Create DSR error:", error)
    return NextResponse.json({ 
      error: "Failed to submit DSR report", 
      details: String(error) 
    }, { status: 500 })
  }
}
