import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { hash } from "bcrypt"

// GET - List all users (Admin and Viewer)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "VIEWER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        canExport: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

// POST - Create new user (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, password, role } = body

    if (!id || !password || !name || !role) {
      return NextResponse.json({ error: "User Name, Full Name, Password and Role are required" }, { status: 400 })
    }

    // Check if user ID already exists
    const existingUser = await db.user.findUnique({
      where: { id }
    })

    if (existingUser) {
      return NextResponse.json({ error: "User Name already exists" }, { status: 400 })
    }

    const hashedPassword = await hash(password, 10)

    const user = await db.user.create({
      data: {
        id,
        name,
        password: hashedPassword,
        role,
        isActive: true,
        canExport: true
      }
    })

    return NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      canExport: user.canExport
    })
  } catch (error) {
    console.error("Create user error:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

// PUT - Update user (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, role, isActive, canExport, password } = body

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (isActive !== undefined) updateData.isActive = isActive
    if (canExport !== undefined) updateData.canExport = canExport
    if (password) {
      updateData.password = await hash(password, 10)
    }

    const user = await db.user.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      canExport: user.canExport
    })
  } catch (error) {
    console.error("Update user error:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

// DELETE - Delete user (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Prevent deleting self
    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    // Check if user exists
    const user = await db.user.findUnique({
      where: { id }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Delete user (this will cascade delete related data based on schema)
    await db.user.delete({
      where: { id }
    })

    return NextResponse.json({ message: "User deleted successfully", id })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
