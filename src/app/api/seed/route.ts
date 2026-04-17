import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hash } from "bcrypt"

export async function GET() {
  try {
    // Check if admin already exists
    const existingAdmin = await db.user.findUnique({
      where: { id: "admin" }
    })

    if (existingAdmin) {
      return NextResponse.json({ 
        message: "Admin user already exists",
        user: { id: existingAdmin.id, name: existingAdmin.name, role: existingAdmin.role }
      })
    }

    // Create admin user with fixed ID "admin"
    const hashedPassword = await hash("admin123", 10)
    
    const admin = await db.user.create({
      data: {
        id: "admin",
        password: hashedPassword,
        name: "Admin",
        role: "ADMIN",
        isActive: true
      }
    })

    // Create default categories
    const categories = await Promise.all([
      db.category.create({ data: { name: "Spices", description: "Whole and ground spices" } }),
      db.category.create({ data: { name: "Blended Spices", description: "Mixed spice blends" } }),
      db.category.create({ data: { name: "Ready Masala", description: "Ready-to-use masala" } }),
    ])

    // Create default units
    const units = await Promise.all([
      db.unit.create({ data: { name: "Kilogram", symbol: "KG" } }),
      db.unit.create({ data: { name: "Gram", symbol: "g" } }),
      db.unit.create({ data: { name: "Packet", symbol: "pkt" } }),
      db.unit.create({ data: { name: "Piece", symbol: "pc" } }),
    ])

    // Initialize order counter
    await db.orderCounter.upsert({
      where: { id: "order_counter" },
      update: {},
      create: { id: "order_counter", currentNumber: 0, lastMonth: "", lastYear: "" }
    })

    return NextResponse.json({ 
      message: "Seed completed successfully",
      admin: { id: admin.id, name: admin.name, role: admin.role },
      categories: categories.length,
      units: units.length
    })
  } catch (error) {
    console.error("Seed error:", error)
    return NextResponse.json({ error: "Seed failed" }, { status: 500 })
  }
}
