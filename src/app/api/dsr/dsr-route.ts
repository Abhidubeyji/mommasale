import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"
import { ensureDsrTable, ensureDsrEnabledColumn, getNextDsrSerialNo } from "@/lib/dsr-db"

// GET - Get current user's DSR reports
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only SALES users (with DSR enabled) or ADMIN can use this
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

    const reports = await db.dsr.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    })

    const total = await db.dsr.count({ where: { userId: targetUserId } })

    return NextResponse.json({ reports, total })
  } catch (error) {
    console.error("Get DSR error:", error)
    return NextResponse.json({ error: "Failed to fetch DSR reports" }, { status: 500 })
  }
}

// POST - Create a new DSR report (sales user)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "SALES") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure table exists
    await ensureDsrTable()
    await ensureDsrEnabledColumn()

    // Check if DSR is enabled for this user
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { dsrEnabled: true, isActive: true }
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "User not found or inactive" }, { status: 403 })
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

    // Get next serial number for this user
    const serialNo = await getNextDsrSerialNo(session.user.id)

    const report = await db.dsr.create({
      data: {
        id: randomUUID(),
        serialNo,
        userId: session.user.id,
        counterName: counterName.trim(),
        mobileNo: mobileNo.trim(),
        address: address?.trim() || null,
        remark: remark?.trim() || null,
        // Location captured silently - sales user doesn't see these
        latitude: typeof latitude === "number" ? latitude : null,
        longitude: typeof longitude === "number" ? longitude : null,
        locationText: locationText || null,
        createdAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      id: report.id,
      serialNo: report.serialNo,
      message: "DSR submitted successfully"
    })
  } catch (error) {
    console.error("Create DSR error:", error)
    return NextResponse.json({ error: "Failed to submit DSR report" }, { status: 500 })
  }
}
