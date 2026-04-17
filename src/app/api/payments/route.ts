import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"

// GET - List payments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shopkeeperId = searchParams.get("shopkeeperId")
    const orderId = searchParams.get("orderId")

    const where: Record<string, unknown> = {}

    // Sales users can only see their own payments
    if (session.user.role === "SALES") {
      where.userId = session.user.id
    }

    if (shopkeeperId) {
      where.shopkeeperId = shopkeeperId
    }

    if (orderId) {
      where.orderId = orderId
    }

    const payments = await db.payment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        shopkeeper: true,
        order: { select: { orderId: true, id: true, totalAmount: true, status: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error("Get payments error:", error)
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 })
  }
}

// POST - Create payment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, shopkeeperId, amount, method, transactionRef, notes, isAdvance } = body

    if (!amount || !method) {
      return NextResponse.json({ error: "Amount and method are required" }, { status: 400 })
    }

    // Validate: shopkeeperId is required
    if (!shopkeeperId) {
      return NextResponse.json({ error: "Shopkeeper selection is required" }, { status: 400 })
    }

    // Validate: if not advance, orderId is required
    if (!isAdvance && !orderId) {
      return NextResponse.json({ error: "Order selection is required for order payments" }, { status: 400 })
    }

    // Validate: order must belong to the selected shopkeeper
    if (!isAdvance && orderId) {
      const order = await db.order.findUnique({
        where: { id: orderId },
        select: { shopkeeperId: true, orderId: true }
      })
      
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
      }
      
      if (order.shopkeeperId !== shopkeeperId) {
        return NextResponse.json({ 
          error: `Order ${order.orderId} does not belong to the selected shopkeeper. Please select the correct shopkeeper for this order.` 
        }, { status: 400 })
      }
    }

    const payment = await db.payment.create({
      data: {
        id: randomUUID(),
        orderId: isAdvance ? null : orderId,
        shopkeeperId,
        userId: session.user.id,
        amount: parseFloat(amount),
        method,
        transactionRef,
        notes,
        isAdvance: isAdvance || false
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        shopkeeper: true,
        order: { select: { orderId: true, id: true, totalAmount: true } }
      }
    })

    // Update outstanding balance if linked to shopkeeper
    if (shopkeeperId) {
      const outstanding = await db.outstanding.findUnique({
        where: { shopkeeperId }
      })

      if (outstanding) {
        await db.outstanding.update({
          where: { shopkeeperId },
          data: {
            totalPaid: { increment: parseFloat(amount) },
            balance: { decrement: parseFloat(amount) },
            lastUpdated: new Date()
          }
        })
      } else {
        await db.outstanding.create({
          data: {
            id: randomUUID(),
            shopkeeperId,
            totalPaid: parseFloat(amount),
            balance: -parseFloat(amount)
          }
        })
      }
    }

    return NextResponse.json(payment)
  } catch (error) {
    console.error("Create payment error:", error)
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 })
  }
}

// DELETE - Delete payment (Admin, Sales only - not VIEWER)
// But if payment is linked to an approved order, only Admin can delete
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Payment ID required" }, { status: 400 })
    }

    const payment = await db.payment.findUnique({ 
      where: { id },
      include: {
        order: {
          select: { status: true, orderId: true }
        }
      }
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // If payment is linked to an approved/dispatched order, only Admin can delete
    if (payment.orderId && payment.order) {
      const orderStatus = payment.order.status
      if ((orderStatus === "APPROVED" || orderStatus === "DISPATCHED") && session.user.role !== "ADMIN") {
        return NextResponse.json({ 
          error: `Cannot delete payment for ${orderStatus.toLowerCase()} order. Only admin can delete.` 
        }, { status: 403 })
      }
    }

    // Revert outstanding balance
    if (payment.shopkeeperId) {
      const outstanding = await db.outstanding.findUnique({
        where: { shopkeeperId: payment.shopkeeperId }
      })

      if (outstanding) {
        await db.outstanding.update({
          where: { shopkeeperId: payment.shopkeeperId },
          data: {
            totalPaid: { decrement: payment.amount },
            balance: { increment: payment.amount },
            lastUpdated: new Date()
          }
        })
      }
    }

    await db.payment.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Payment deleted" })
  } catch (error) {
    console.error("Delete payment error:", error)
    return NextResponse.json({ error: "Failed to delete payment" }, { status: 500 })
  }
}
