import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET - Generate reports
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "orders"
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")
    const userId = searchParams.get("userId")

    const dateFilter: Record<string, unknown> = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      // Add 1 day to include the end date fully
      const endDateObj = new Date(endDate)
      endDateObj.setHours(23, 59, 59, 999)
      dateFilter.lte = endDateObj
    }

    let data: unknown[] = []
    const isAdmin = session.user.role === "ADMIN"

    switch (type) {
      case "orders": {
        const where: Record<string, unknown> = {}
        
        if (Object.keys(dateFilter).length > 0) {
          where.createdAt = dateFilter
        }
        if (status) {
          where.status = status
        }
        if (userId) {
          where.userId = userId
        } else if (!isAdmin) {
          // SALES users can only see their own orders
          where.userId = session.user.id
        }

        data = await db.order.findMany({
          where,
          include: {
            shopkeeper: true,
            user: { select: { id: true, name: true, email: true } },
            items: {
              include: {
                product: {
                  include: { category: true }
                }
              }
            }
          },
          orderBy: { createdAt: "desc" }
        })
        break
      }

      case "payments": {
        const where: Record<string, unknown> = {}
        
        if (Object.keys(dateFilter).length > 0) {
          where.createdAt = dateFilter
        }
        if (!isAdmin) {
          where.userId = session.user.id
        }

        const payments = await db.payment.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true } },
            shopkeeper: true,
            order: { select: { orderId: true, id: true } }
          },
          orderBy: { createdAt: "desc" }
        })

        // Get outstanding info for shopkeepers
        const shopkeeperIds = [...new Set(payments.filter(p => p.shopkeeperId).map(p => p.shopkeeperId))]
        
        const outstandings = shopkeeperIds.length > 0 ? await db.outstanding.findMany({
          where: { shopkeeperId: { in: shopkeeperIds } },
          include: { shopkeeper: true }
        }) : []

        const outstandingMap = new Map(outstandings.map(o => [o.shopkeeperId, o]))

        // Combine payment data with outstanding info
        data = payments.map(p => ({
          ...p,
          outstandingInfo: p.shopkeeperId ? {
            totalOrders: outstandingMap.get(p.shopkeeperId)?.totalOrders || 0,
            totalPaid: outstandingMap.get(p.shopkeeperId)?.totalPaid || 0,
            balance: outstandingMap.get(p.shopkeeperId)?.balance || 0
          } : { totalOrders: 0, totalPaid: 0, balance: 0 }
        }))
        break
      }

      case "products": {
        data = await db.product.findMany({
          include: {
            category: true
          },
          orderBy: { name: "asc" }
        })
        break
      }

      case "users": {
        if (!isAdmin) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        data = await db.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: { shopkeepers: true, orders: true }
            }
          },
          orderBy: { createdAt: "desc" }
        })
        break
      }

      case "outstanding": {
        if (!isAdmin) {
          // SALES users can only see their shopkeepers' outstanding
          const shopkeepers = await db.shopkeeper.findMany({
            where: { createdById: session.user.id },
            select: { id: true }
          })
          const shopkeeperIds = shopkeepers.map(s => s.id)
          
          data = await db.outstanding.findMany({
            where: { shopkeeperId: { in: shopkeeperIds } },
            include: {
              shopkeeper: true
            },
            orderBy: { balance: "desc" }
          })
        } else {
          data = await db.outstanding.findMany({
            include: {
              shopkeeper: true
            },
            orderBy: { balance: "desc" }
          })
        }
        break
      }

      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 })
    }

    return NextResponse.json({ type, data })
  } catch (error) {
    console.error("Report error:", error)
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 })
  }
}
