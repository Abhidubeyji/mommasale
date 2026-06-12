import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"
import { hash } from "bcrypt"

// GET - Export all data as JSON (Admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Export all data
    const backup = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      data: {
        users: await db.user.findMany({
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            role: true,
            isActive: true,
            canExport: true,
            fcmToken: true,
            createdAt: true,
            updatedAt: true,
          }
        }),
        categories: await db.category.findMany(),
        products: await db.product.findMany(),
        shopkeepers: await db.shopkeeper.findMany(),
        orders: await db.order.findMany(),
        orderItems: await db.orderItem.findMany(),
        payments: await db.payment.findMany(),
        outstanding: await db.outstanding.findMany(),
        units: await db.unit.findMany(),
        orderCounter: await db.orderCounter.findMany(),
        loginLogs: await db.loginLog.findMany(),
      }
    }

    return NextResponse.json(backup)
  } catch (error) {
    console.error("Backup export error:", error)
    return NextResponse.json({ error: "Failed to export backup" }, { status: 500 })
  }
}

// POST - Import data from JSON backup (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { data, options } = body

    if (!data) {
      return NextResponse.json({ error: "No backup data provided" }, { status: 400 })
    }

    const results = {
      users: { imported: 0, skipped: 0 },
      categories: { imported: 0, skipped: 0 },
      products: { imported: 0, skipped: 0 },
      shopkeepers: { imported: 0, skipped: 0 },
      orders: { imported: 0, skipped: 0 },
      orderItems: { imported: 0, skipped: 0 },
      payments: { imported: 0, skipped: 0 },
      outstanding: { imported: 0, skipped: 0 },
      units: { imported: 0, skipped: 0 },
    }

    // Import in order of dependencies
    // 1. Users first (they're referenced by many other tables)
    if (data.users && options?.users !== false) {
      for (const user of data.users) {
        try {
          await db.user.create({ data: user })
          results.users.imported++
        } catch (e) {
          results.users.skipped++
        }
      }
    }

    // 2. Categories
    if (data.categories && options?.categories !== false) {
      for (const category of data.categories) {
        try {
          await db.category.create({ data: category })
          results.categories.imported++
        } catch (e) {
          results.categories.skipped++
        }
      }
    }

    // 3. Units
    if (data.units && options?.units !== false) {
      for (const unit of data.units) {
        try {
          await db.unit.create({ data: unit })
          results.units.imported++
        } catch (e) {
          results.units.skipped++
        }
      }
    }

    // 4. Products (depend on categories)
    if (data.products && options?.products !== false) {
      for (const product of data.products) {
        try {
          await db.product.create({ data: product })
          results.products.imported++
        } catch (e) {
          results.products.skipped++
        }
      }
    }

    // 5. Shopkeepers (depend on users)
    if (data.shopkeepers && options?.shopkeepers !== false) {
      for (const shopkeeper of data.shopkeepers) {
        try {
          await db.shopkeeper.create({ data: shopkeeper })
          results.shopkeepers.imported++
        } catch (e) {
          results.shopkeepers.skipped++
        }
      }
    }

    // 6. Orders (depend on users and shopkeepers)
    if (data.orders && options?.orders !== false) {
      for (const order of data.orders) {
        try {
          await db.order.create({ data: order })
          results.orders.imported++
        } catch (e) {
          results.orders.skipped++
        }
      }
    }

    // 7. Order Items (depend on orders and products)
    if (data.orderItems && options?.orderItems !== false) {
      for (const item of data.orderItems) {
        try {
          await db.orderItem.create({ data: item })
          results.orderItems.imported++
        } catch (e) {
          results.orderItems.skipped++
        }
      }
    }

    // 8. Payments (depend on orders, users, shopkeepers)
    if (data.payments && options?.payments !== false) {
      for (const payment of data.payments) {
        try {
          await db.payment.create({ data: payment })
          results.payments.imported++
        } catch (e) {
          results.payments.skipped++
        }
      }
    }

    // 9. Outstanding (depend on shopkeepers)
    if (data.outstanding && options?.outstanding !== false) {
      for (const outstanding of data.outstanding) {
        try {
          await db.outstanding.create({ data: outstanding })
          results.outstanding.imported++
        } catch (e) {
          results.outstanding.skipped++
        }
      }
    }

    return NextResponse.json({ 
      message: "Backup restored successfully",
      results 
    })
  } catch (error) {
    console.error("Backup import error:", error)
    return NextResponse.json({ error: "Failed to import backup" }, { status: 500 })
  }
}
