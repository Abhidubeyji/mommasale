import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { hash } from "bcrypt"
import { ensureDsrEnabledColumn } from "@/lib/dsr-db"

// GET - List all users (Admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure the dsrEnabled column exists before querying
    await ensureDsrEnabledColumn()

    // Try fetching with dsrEnabled first
    try {
      const users = await db.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          canExport: true,
          dsrEnabled: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      })

      return NextResponse.json(users)
    } catch (primaryError) {
      console.error("Primary fetch with dsrEnabled failed, trying fallback:", primaryError)
      // Try once more after ensuring column
      await ensureDsrEnabledColumn()
      
      // Fallback: try without dsrEnabled in case the column still doesn't exist
      try {
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
        const usersWithDsr = users.map(u => ({ ...u, dsrEnabled: false }))
        return NextResponse.json(usersWithDsr)
      } catch (fallbackErr) {
        console.error("Fallback get users error:", fallbackErr)
        // Last resort: use raw SQL
        const rawUsers = await db.$queryRaw<Array<{
          id: string
          email: string | null
          name: string
          role: string
          isActive: boolean
          canExport: boolean
          dsrEnabled: boolean
          createdAt: Date
        }>>`
          SELECT id, email, name, role, "isActive", "canExport", 
                 COALESCE("dsrEnabled", false) as "dsrEnabled", "createdAt" 
          FROM "users" 
          ORDER BY "createdAt" DESC;
        `
        return NextResponse.json(rawUsers)
      }
    }
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

    // Ensure the dsrEnabled column exists before creating
    await ensureDsrEnabledColumn()

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

    let user
    try {
      user = await db.user.create({
        data: {
          id,
          name,
          password: hashedPassword,
          role,
          isActive: true,
          canExport: true,
          dsrEnabled: false
        }
      })
    } catch (createError) {
      console.error("Prisma create with dsrEnabled failed, trying without:", createError)
      // Fallback: create without dsrEnabled
      user = await db.user.create({
        data: {
          id,
          name,
          password: hashedPassword,
          role,
          isActive: true,
          canExport: true
        }
      })
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      canExport: user.canExport,
      dsrEnabled: (user as { dsrEnabled?: boolean }).dsrEnabled ?? false
    })
  } catch (error) {
    console.error("Create user error:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

// PUT - Update user (Admin only) - RAW SQL for dsrEnabled
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, role, isActive, canExport, dsrEnabled, password } = body

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    await ensureDsrEnabledColumn()

    // STEP 1: Update non-dsrEnabled fields using Prisma
    const prismaUpdateData: Record<string, unknown> = {}
    if (name !== undefined) prismaUpdateData.name = name
    if (role !== undefined) prismaUpdateData.role = role
    if (isActive !== undefined) prismaUpdateData.isActive = isActive
    if (canExport !== undefined) prismaUpdateData.canExport = canExport
    if (password) {
      prismaUpdateData.password = await hash(password, 10)
    }

    if (Object.keys(prismaUpdateData).length > 0) {
      try {
        await db.user.update({
          where: { id },
          data: prismaUpdateData
        })
      } catch (prismaErr) {
        console.error("Prisma update failed:", prismaErr)
      }
    }

    // STEP 2: Update dsrEnabled using RAW SQL
    if (dsrEnabled !== undefined) {
      try {
        await ensureDsrEnabledColumn()
        const result = await db.$executeRawUnsafe(
          `UPDATE "users" SET "dsrEnabled" = $1 WHERE "id" = $2;`,
          dsrEnabled === true,
          id
        )
        console.log(`Raw SQL update for dsrEnabled=${dsrEnabled} succeeded, rows: ${result}`)
      } catch (rawErr) {
        console.error("Raw SQL update failed:", rawErr)
        return NextResponse.json({ 
          error: "Failed to update DSR status", 
          details: String(rawErr) 
        }, { status: 500 })
      }
    }

    // STEP 3: Fetch updated user using raw SQL
    const updatedUser = await db.$queryRaw<Array<{
      id: string
      name: string
      role: string
      isActive: boolean
      canExport: boolean
      dsrEnabled: boolean
    }>>`
      SELECT id, name, role, "isActive", "canExport", 
             COALESCE("dsrEnabled", false) as "dsrEnabled"
      FROM "users" WHERE "id" = ${id};
    `

    if (updatedUser.length === 0) {
      return NextResponse.json({ error: "User not found after update" }, { status: 404 })
    }

    return NextResponse.json({
      id: updatedUser[0].id,
      name: updatedUser[0].name,
      role: updatedUser[0].role,
      isActive: updatedUser[0].isActive,
      canExport: updatedUser[0].canExport,
      dsrEnabled: updatedUser[0].dsrEnabled
    })
  } catch (error) {
    console.error("Update user error:", error)
    return NextResponse.json({ 
      error: "Failed to update user", 
      details: String(error) 
    }, { status: 500 })
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
