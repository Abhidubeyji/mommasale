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

// PUT - Update user (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure the dsrEnabled column exists before updating
    await ensureDsrEnabledColumn()

    const body = await request.json()
    const { id, name, role, isActive, canExport, dsrEnabled, password } = body

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (isActive !== undefined) updateData.isActive = isActive
    if (canExport !== undefined) updateData.canExport = canExport
    if (dsrEnabled !== undefined) updateData.dsrEnabled = dsrEnabled
    if (password) {
      updateData.password = await hash(password, 10)
    }

    let user
    try {
      user = await db.user.update({
        where: { id },
        data: updateData
      })
    } catch (updateError) {
      console.error("Prisma update failed, trying raw SQL for dsrEnabled:", updateError)
      // If Prisma fails (likely due to dsrEnabled column missing), 
      // try updating without dsrEnabled first, then use raw SQL for dsrEnabled
      const { dsrEnabled: _dsrVal, ...restData } = updateData
      void _dsrVal
      if (Object.keys(restData).length > 0) {
        await db.user.update({
          where: { id },
          data: restData
        })
      }
      // Now try raw SQL for dsrEnabled
      if (dsrEnabled !== undefined) {
        try {
          await ensureDsrEnabledColumn()
          await db.$executeRawUnsafe(`UPDATE "users" SET "dsrEnabled" = ${dsrEnabled ? 'TRUE' : 'FALSE'} WHERE "id" = $1;`, id)
        } catch (e) {
          console.error("Raw SQL update for dsrEnabled also failed:", e)
        }
      }
      // Re-fetch the user
      user = await db.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          role: true,
          isActive: true,
          canExport: true,
          dsrEnabled: true,
        }
      })
    }

    return NextResponse.json({
      id: user?.id,
      name: user?.name,
      role: user?.role,
      isActive: user?.isActive,
      canExport: user?.canExport,
      dsrEnabled: (user as { dsrEnabled?: boolean })?.dsrEnabled ?? false
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
