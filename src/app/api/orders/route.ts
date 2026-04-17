import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"

// Helper function to generate order ID
async function generateOrderId(): Promise<string> {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const year = String(now.getFullYear()).slice(-2)

  let counter = await db.orderCounter.findUnique({
    where: { id: "order_counter" }
  })

  if (!counter) {
    counter = await db.orderCounter.create({
      data: { id: "order_counter", currentNumber: 0, lastMonth: "", lastYear: "" }
    })
  }

  let newNumber: number

  // Reset counter if month or year changed
  if (counter.lastMonth !== month || counter.lastYear !== year) {
    newNumber = 1
    await db.orderCounter.update({
      where: { id: "order_counter" },
      data: { currentNumber: newNumber, lastMonth: month, lastYear: year }
    })
  } else {
    newNumber = counter.currentNumber + 1
    await db.orderCounter.update({
      where: { id: "order_counter" },
      data: { currentNumber: newNumber }
    })
  }

  const sequence = String(newNumber).padStart(4, "0")
  return `MMSKG${sequence}/${month}/${year}`
}

// GET - List orders
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const userId = searchParams.get("userId")
    const shopkeeperId = searchParams.get("shopkeeperId")

    const where: Record<string, unknown> = {}

    // Sales users can only see their own orders
    if (session.user.role === "SALES") {
      where.userId = session.user.id
    } else if (userId) {
      where.userId = userId
    }

    if (status) {
      where.status = status
    }

    if (shopkeeperId) {
      where.shopkeeperId = shopkeeperId
    }

    const orders = await db.order.findMany({
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

    return NextResponse.json(orders)
  } catch (error) {
    console.error("Get orders error:", error)
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
  }
}

// POST - Create order
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { shopkeeperId, items, notes } = body

    if (!shopkeeperId || !items || items.length === 0) {
      return NextResponse.json({ error: "Shopkeeper and items are required" }, { status: 400 })
    }

    // Validate extra discount (max 100%)
    for (const item of items) {
      if (item.extraDiscount > 100) {
        return NextResponse.json({ 
          error: "Extra discount cannot exceed 100%" 
        }, { status: 400 })
      }
    }

    const orderId = await generateOrderId()

    // Calculate totals
    let subtotal = 0
    let adminDiscountTotal = 0
    let extraDiscountTotal = 0
    let totalAmount = 0

    const orderItems = items.map((item: Record<string, unknown>) => {
      const productPrice = item.productPrice as number
      const quantity = item.quantity as number
      const adminDiscount = item.adminDiscount as number
      const extraDiscount = item.extraDiscount as number
      const unitPrice = item.unitPrice as number

      const itemTotal = productPrice * quantity
      const adminDiscountAmount = itemTotal * (adminDiscount / 100)
      const extraDiscountAmount = itemTotal * (extraDiscount / 100)
      const finalPrice = itemTotal - adminDiscountAmount - extraDiscountAmount

      subtotal += itemTotal
      adminDiscountTotal += adminDiscountAmount
      extraDiscountTotal += extraDiscountAmount
      totalAmount += finalPrice

      return {
        id: randomUUID(),
        productId: item.productId,
        quantity,
        unitPrice,
        productPrice,
        adminDiscount,
        extraDiscount,
        finalPrice
      }
    })

    const order = await db.order.create({
      data: {
        id: randomUUID(),
        orderId,
        shopkeeperId,
        userId: session.user.id,
        status: "PENDING",
        subtotal,
        adminDiscount: adminDiscountTotal,
        extraDiscount: extraDiscountTotal,
        totalAmount,
        notes,
        items: {
          create: orderItems
        }
      },
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
      }
    })

    return NextResponse.json(order)
  } catch (error) {
    console.error("Create order error:", error)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}

// PUT - Update order (approve/reject/dispatch or edit order details)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, status, shopkeeperId, items, notes } = body

    if (!id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
    }

    const existingOrder = await db.order.findUnique({
      where: { id },
      include: { items: true }
    })

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // If updating items (full edit)
    if (items && Array.isArray(items)) {
      // Admin can edit any order in any status
      // Sales users can only edit PENDING orders (before admin approval)
      if (session.user.role === "SALES") {
        if (existingOrder.status !== "PENDING" && existingOrder.status !== "REJECTED") {
          return NextResponse.json({ error: "Sales users can only edit pending orders before admin approval" }, { status: 401 })
        }
        // Sales can only edit their own orders
        if (existingOrder.userId !== session.user.id) {
          return NextResponse.json({ error: "You can only edit your own orders" }, { status: 401 })
        }
      }
      // Admin and Viewer can edit any order in any status
      // Sales users can only edit PENDING orders (before admin approval)

      // Store old total amount for outstanding balance update
      const oldTotalAmount = existingOrder.totalAmount

      // Calculate new totals
      let subtotal = 0
      let adminDiscountTotal = 0
      let extraDiscountTotal = 0
      let totalAmount = 0

      const newOrderItems = items.map((item: Record<string, unknown>) => {
        const productPrice = item.productPrice as number
        const quantity = item.quantity as number
        const adminDiscount = item.adminDiscount as number
        const extraDiscount = item.extraDiscount as number
        const unitPrice = item.unitPrice as number

        const itemTotal = productPrice * quantity
        const adminDiscountAmount = itemTotal * (adminDiscount / 100)
        const extraDiscountAmount = itemTotal * (extraDiscount / 100)
        const finalPrice = itemTotal - adminDiscountAmount - extraDiscountAmount

        subtotal += itemTotal
        adminDiscountTotal += adminDiscountAmount
        extraDiscountTotal += extraDiscountAmount
        totalAmount += finalPrice

        return {
          id: randomUUID(),
          productId: item.productId as string,
          quantity,
          unitPrice,
          productPrice,
          adminDiscount,
          extraDiscount,
          finalPrice
        }
      })

      // Delete old items and create new ones
      await db.orderItem.deleteMany({
        where: { orderId: id }
      })

      const order = await db.order.update({
        where: { id },
        data: {
          shopkeeperId: shopkeeperId || existingOrder.shopkeeperId,
          notes,
          subtotal,
          adminDiscount: adminDiscountTotal,
          extraDiscount: extraDiscountTotal,
          totalAmount,
          items: {
            create: newOrderItems
          }
        },
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
        }
      })

      // If order is DISPATCHED, update outstanding balance with the difference
      if (existingOrder.status === "DISPATCHED") {
        const amountDifference = totalAmount - oldTotalAmount
        const shopkeeperChanged = shopkeeperId && shopkeeperId !== existingOrder.shopkeeperId
        
        if (shopkeeperChanged) {
          // If shopkeeper changed, remove amount from old shopkeeper and add to new
          const oldOutstanding = await db.outstanding.findUnique({
            where: { shopkeeperId: existingOrder.shopkeeperId }
          })

          if (oldOutstanding) {
            await db.outstanding.update({
              where: { shopkeeperId: existingOrder.shopkeeperId },
              data: {
                totalOrders: { decrement: oldTotalAmount },
                balance: { decrement: oldTotalAmount },
                lastUpdated: new Date()
              }
            })
          }

          // Add to new shopkeeper
          const newOutstanding = await db.outstanding.findUnique({
            where: { shopkeeperId: shopkeeperId as string }
          })

          if (newOutstanding) {
            await db.outstanding.update({
              where: { shopkeeperId: shopkeeperId as string },
              data: {
                totalOrders: { increment: totalAmount },
                balance: { increment: totalAmount },
                lastUpdated: new Date()
              }
            })
          } else {
            await db.outstanding.create({
              data: {
                id: randomUUID(),
                shopkeeperId: shopkeeperId as string,
                totalOrders: totalAmount,
                balance: totalAmount
              }
            })
          }

          // Update any payments linked to this order to the new shopkeeper
          await db.payment.updateMany({
            where: { orderId: id },
            data: { shopkeeperId: shopkeeperId as string }
          })
        } else if (amountDifference !== 0) {
          // Same shopkeeper, just update the difference
          const outstanding = await db.outstanding.findUnique({
            where: { shopkeeperId: order.shopkeeperId }
          })

          if (outstanding) {
            await db.outstanding.update({
              where: { shopkeeperId: order.shopkeeperId },
              data: {
                totalOrders: { increment: amountDifference },
                balance: { increment: amountDifference },
                lastUpdated: new Date()
              }
            })
          }
        }
      }

      return NextResponse.json(order)
    }

    // Status update
    if (status) {
      // Status transition rules
      if (status === "APPROVED" || status === "REJECTED") {
        // Admin and Viewer can approve/reject
        if (session.user.role !== "ADMIN" && session.user.role !== "VIEWER") {
          return NextResponse.json({ error: "Only admin or viewer can approve/reject orders" }, { status: 401 })
        }
        if (existingOrder.status !== "PENDING") {
          return NextResponse.json({ error: "Can only approve/reject pending orders" }, { status: 400 })
        }
      }

      if (status === "DISPATCHED") {
        // Admin and Viewer can dispatch
        if (session.user.role !== "ADMIN" && session.user.role !== "VIEWER") {
          return NextResponse.json({ error: "Only admin or viewer can dispatch orders" }, { status: 401 })
        }
        if (existingOrder.status !== "APPROVED") {
          return NextResponse.json({ error: "Can only dispatch approved orders" }, { status: 400 })
        }
      }

      const updateData: Record<string, unknown> = { status }

      if (status === "APPROVED") {
        updateData.approvedAt = new Date()
      } else if (status === "DISPATCHED") {
        updateData.dispatchedAt = new Date()

        // Update outstanding balance
        const outstanding = await db.outstanding.findUnique({
          where: { shopkeeperId: existingOrder.shopkeeperId }
        })

        if (outstanding) {
          await db.outstanding.update({
            where: { shopkeeperId: existingOrder.shopkeeperId },
            data: {
              totalOrders: { increment: existingOrder.totalAmount },
              balance: { increment: existingOrder.totalAmount },
              lastUpdated: new Date()
            }
          })
        } else {
          await db.outstanding.create({
            data: {
              id: randomUUID(),
              shopkeeperId: existingOrder.shopkeeperId,
              totalOrders: existingOrder.totalAmount,
              balance: existingOrder.totalAmount
            }
          })
        }

        // Link unlinked advance payments to this order
        await db.payment.updateMany({
          where: {
            shopkeeperId: existingOrder.shopkeeperId,
            isAdvance: true,
            orderId: null
          },
          data: {
            orderId: existingOrder.id
          }
        })
      }

      const order = await db.order.update({
        where: { id },
        data: updateData,
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
        }
      })

      return NextResponse.json(order)
    }

    return NextResponse.json({ error: "No update data provided" }, { status: 400 })
  } catch (error) {
    console.error("Update order error:", error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}

// DELETE - Delete order
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Order ID required" }, { status: 400 })
    }

    const order = await db.order.findUnique({ where: { id } })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Admin and Viewer can delete ANY order in ANY status
    if (session.user.role === "ADMIN" || session.user.role === "VIEWER") {
      // If deleting a DISPATCHED order, we need to revert the outstanding balance
      if (order.status === "DISPATCHED") {
        // Get payments linked to this order
        const linkedPayments = await db.payment.findMany({
          where: { orderId: id }
        })
        const totalPaymentsAmount = linkedPayments.reduce((sum, p) => sum + p.amount, 0)

        const outstanding = await db.outstanding.findUnique({
          where: { shopkeeperId: order.shopkeeperId }
        })
        
        if (outstanding) {
          // Decrement totalOrders by order amount
          // Also decrement totalPaid by the payments already made for this order
          await db.outstanding.update({
            where: { shopkeeperId: order.shopkeeperId },
            data: {
              totalOrders: { decrement: order.totalAmount },
              totalPaid: { decrement: totalPaymentsAmount },
              balance: { decrement: order.totalAmount - totalPaymentsAmount },
              lastUpdated: new Date()
            }
          })
        }

        // Unlink payments from this order (set orderId to null, keep payments as records)
        await db.payment.updateMany({
          where: { orderId: id },
          data: { orderId: null, isAdvance: true } // Mark as advance since no longer linked to specific order
        })
      }
      
      await db.order.delete({
        where: { id }
      })
      
      return NextResponse.json({ message: "Order deleted" })
    }

    // Sales users can only delete PENDING orders (before admin approval)
    if (session.user.role === "SALES") {
      if (order.status !== "PENDING" && order.status !== "REJECTED") {
        return NextResponse.json({ error: "Cannot delete orders after admin approval" }, { status: 400 })
      }
      
      // Sales can only delete their own orders
      if (order.userId !== session.user.id) {
        return NextResponse.json({ error: "You can only delete your own orders" }, { status: 401 })
      }
      
      await db.order.delete({
        where: { id }
      })
      
      return NextResponse.json({ message: "Order deleted" })
    }

    // Other roles cannot delete
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  } catch (error) {
    console.error("Delete order error:", error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}
