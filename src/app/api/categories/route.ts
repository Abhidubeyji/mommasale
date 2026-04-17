import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"

// GET - List all categories
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const categories = await db.category.findMany({
      include: {
        _count: { select: { products: true } }
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Get categories error:", error)
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
}

// POST - Create category (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const category = await db.category.create({
      data: { 
        id: randomUUID(),
        name, 
        description 
      }
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error("Create category error:", error)
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}

// PUT - Update category (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, description } = body

    if (!id || !name) {
      return NextResponse.json({ error: "ID and name are required" }, { status: 400 })
    }

    const category = await db.category.update({
      where: { id },
      data: { name, description }
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error("Update category error:", error)
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
  }
}

// DELETE - Delete category (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Category ID required" }, { status: 400 })
    }

    await db.category.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Category deleted" })
  } catch (error) {
    console.error("Delete category error:", error)
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
