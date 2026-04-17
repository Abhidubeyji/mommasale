import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"

// GET - List shopkeepers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")

    const where: Record<string, unknown> = {}

    // Sales users can only see their own shopkeepers
    if (session.user.role === "SALES") {
      where.createdById = session.user.id
    }

    if (search) {
      where.OR = [
        { shopName: { contains: search } },
        { ownerName: { contains: search } },
        { mobile: { contains: search } },
        { city: { contains: search } }
      ]
    }

    const shopkeepers = await db.shopkeeper.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        outstanding: true,
        _count: { select: { orders: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(shopkeepers)
  } catch (error) {
    console.error("Get shopkeepers error:", error)
    return NextResponse.json({ error: "Failed to fetch shopkeepers" }, { status: 500 })
  }
}

// POST - Create shopkeeper
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { shopName, ownerName, address, mobile, city } = body

    if (!shopName || !ownerName || !mobile) {
      return NextResponse.json({ error: "Shop name, owner name, and mobile are required" }, { status: 400 })
    }

    // Validate mobile number (10 digits)
    const mobileRegex = /^[0-9]{10}$/
    if (!mobileRegex.test(mobile)) {
      return NextResponse.json({ error: "Mobile number must be exactly 10 digits" }, { status: 400 })
    }

    const shopkeeper = await db.shopkeeper.create({
      data: {
        id: randomUUID(),
        shopName,
        ownerName,
        address,
        mobile,
        city,
        createdById: session.user.id
      },
      include: {
        createdBy: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json(shopkeeper)
  } catch (error) {
    console.error("Create shopkeeper error:", error)
    return NextResponse.json({ error: "Failed to create shopkeeper" }, { status: 500 })
  }
}

// PUT - Update shopkeeper
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, shopName, ownerName, address, mobile, city } = body

    if (!id) {
      return NextResponse.json({ error: "Shopkeeper ID required" }, { status: 400 })
    }

    // Validate mobile number (10 digits)
    const mobileRegex = /^[0-9]{10}$/
    if (mobile && !mobileRegex.test(mobile)) {
      return NextResponse.json({ error: "Mobile number must be exactly 10 digits" }, { status: 400 })
    }

    // Check ownership for sales users
    if (session.user.role === "SALES") {
      const existing = await db.shopkeeper.findUnique({ where: { id } })
      if (!existing || existing.createdById !== session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const shopkeeper = await db.shopkeeper.update({
      where: { id },
      data: { shopName, ownerName, address, mobile, city },
      include: {
        createdBy: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json(shopkeeper)
  } catch (error) {
    console.error("Update shopkeeper error:", error)
    return NextResponse.json({ error: "Failed to update shopkeeper" }, { status: 500 })
  }
}

// DELETE - Delete shopkeeper (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Shopkeeper ID required" }, { status: 400 })
    }

    await db.shopkeeper.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Shopkeeper deleted" })
  } catch (error) {
    console.error("Delete shopkeeper error:", error)
    return NextResponse.json({ error: "Failed to delete shopkeeper" }, { status: 500 })
  }
}
