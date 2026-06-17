import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { ensureDsrEnabledColumn } from "@/lib/dsr-db"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureDsrEnabledColumn()

    const columnCheck = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'dsrEnabled'
      ) as exists;
    `

    const users = await db.$queryRaw<Array<{
      id: string
      name: string
      role: string
      isActive: boolean
      dsrEnabled: boolean | null
    }>>`
      SELECT id, name, role, "isActive", "dsrEnabled" 
      FROM "users" 
      ORDER BY "createdAt" DESC;
    `

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      columnExists: columnCheck[0]?.exists ?? false,
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        dsrEnabled: u.dsrEnabled
      }))
    })
  } catch (error) {
    console.error("Debug error:", error)
    return NextResponse.json({ 
      error: "Debug failed", 
      details: String(error)
    }, { status: 500 })
  }
}