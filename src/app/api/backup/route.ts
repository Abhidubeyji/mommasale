import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET - Export all data as JSON (Admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Export all data with error handling for each table
    const backup = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      data: {} as Record<string, unknown[]>
    }

    // Helper to safely fetch data
    const safeFetch = async (name: string, query: () => Promise<unknown[]>) => {
      try {
        return await query()
      } catch (e) {
        console.error(`Failed to fetch ${name}:`, e)
        return []
      }
    }

    backup.data.users = await safeFetch("users", () => db.user.findMany({
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        isActive: true,
        canExport: true,
        createdAt: true,
        updatedAt: true,
      }
    }))

    backup.data.categories = await safeFetch("categories", () => db.category.findMany())
    backup.data.products = await safeFetch("products", () => db.product.findMany())
    backup.data.shopkeepers = await safeFetch("shopkeepers", () => db.shopkeeper.findMany())
    backup.data.orders = await safeFetch("orders", () => db.order.findMany())
    backup.data.orderItems = await safeFetch("orderItems", () => db.orderItem.findMany())
    backup.data.payments = await safeFetch("payments", () => db.payment.findMany())
    backup.data.outstanding = await safeFetch("outstanding", () => db.outstanding.findMany())
    backup.data.units = await safeFetch("units", () => db.unit.findMany())

    // Try to fetch loginLogs if table exists
    try {
      backup.data.loginLogs = await db.loginLog.findMany()
    } catch (e) {
      console.log("loginLogs table not found, skipping")
      backup.data.loginLogs = []
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

    // Import users
    if (data.users && options?.users !== false) {
      for (const user of data.users) {
        try {
          const { loginLogs, ...userData } = user
          await db.user.create({ data: userData })
          results.users.imported++
        } catch (e) {
          results.users.skipped++
        }
      }
    }

    // Import categories
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

    // Import units
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

    // Import products
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

    // Import shopkeepers
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

    // Import orders
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

    // Import order items
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

    // Import payments
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

    // Import outstanding
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
