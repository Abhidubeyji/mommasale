import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET - List all units
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const units = await db.unit.findMany({
      orderBy: { name: "asc" }
    })

    return NextResponse.json(units)
  } catch (error) {
    console.error("Get units error:", error)
    return NextResponse.json({ error: "Failed to fetch units" }, { status: 500 })
  }
}

// POST - Create unit (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, symbol } = body

    if (!name || !symbol) {
      return NextResponse.json({ error: "Name and symbol are required" }, { status: 400 })
    }

    const unit = await db.unit.create({
      data: { name, symbol }
    })

    return NextResponse.json(unit)
  } catch (error) {
    console.error("Create unit error:", error)
    return NextResponse.json({ error: "Failed to create unit" }, { status: 500 })
  }
}

// PUT - Update unit (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, symbol } = body

    if (!id || !name || !symbol) {
      return NextResponse.json({ error: "ID, name, and symbol are required" }, { status: 400 })
    }

    const unit = await db.unit.update({
      where: { id },
      data: { name, symbol }
    })

    return NextResponse.json(unit)
  } catch (error) {
    console.error("Update unit error:", error)
    return NextResponse.json({ error: "Failed to update unit" }, { status: 500 })
  }
}

// DELETE - Delete unit (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Unit ID required" }, { status: 400 })
    }

    await db.unit.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Unit deleted" })
  } catch (error) {
    console.error("Delete unit error:", error)
    return NextResponse.json({ error: "Failed to delete unit" }, { status: 500 })
  }
}
