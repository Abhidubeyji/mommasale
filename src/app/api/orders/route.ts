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
    const { shopkeeperId, items, notes, latitude, longitude } = body

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
        latitude: latitude || null,
        longitude: longitude || null,
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

    // Send push notification to admin about new order
    try {
      const notificationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: '🛒 नया Order मिला!',
          body: `Order #${orderId} - ${order.shopkeeper.shopName} - ₹${Math.round(totalAmount)}`,
          orderId: orderId,
          amount: Math.round(totalAmount),
          shopkeeperName: order.shopkeeper.shopName
        })
      })

      if (!notificationResponse.ok) {
        console.error('Failed to send notification:', await notificationResponse.text())
      } else {
        console.log('Notification sent successfully for order:', orderId)
      }
    } catch (notifyError) {
      // Don't fail the order creation if notification fails
      console.error('Error sending notification:', notifyError)
    }

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
    
    console.log("PUT /api/orders - Session:", session ? { id: session.user.id, role: session.user.role } : null)
    
    if (!session) {
      console.log("PUT /api/orders - Unauthorized: No session")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    console.log("PUT /api/orders - Request body:", body)
    
    const { id, status, shopkeeperId, items, notes, roundOff } = body

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
      // Cannot edit DISPATCHED orders - only delete is allowed
      if (existingOrder.status === "DISPATCHED") {
        return NextResponse.json({ error: "Cannot edit dispatched orders. Only delete is allowed." }, { status: 400 })
      }
      
      // Admin can edit PENDING, APPROVED, REJECTED orders
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

      return NextResponse.json(order)
    }

    // Status update
    if (status) {
      console.log("Status update request:", { id, status, currentStatus: existingOrder.status, userRole: session.user.role })
      
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
          return NextResponse.json({ error: `Can only dispatch approved orders. Current status: ${existingOrder.status}` }, { status: 400 })
        }
      }

      const updateData: Record<string, unknown> = { status }

      if (status === "APPROVED") {
        updateData.approvedAt = new Date()
      } else if (status === "DISPATCHED") {
        updateData.dispatchedAt = new Date()

        // Calculate round off for this order (rounded total - actual total)
        const orderRoundOff = Math.round(existingOrder.totalAmount) - existingOrder.totalAmount
        const grandTotal = Math.round(existingOrder.totalAmount)

        // Update outstanding balance with proper error handling
        try {
          const outstanding = await db.outstanding.findUnique({
            where: { shopkeeperId: existingOrder.shopkeeperId }
          })

          if (outstanding) {
            await db.outstanding.update({
              where: { shopkeeperId: existingOrder.shopkeeperId },
              data: {
                totalOrders: { increment: existingOrder.totalAmount },
                roundOff: { increment: orderRoundOff },
                balance: { increment: grandTotal },
                lastUpdated: new Date()
              }
            })
          } else {
            await db.outstanding.create({
              data: {
                id: randomUUID(),
                shopkeeperId: existingOrder.shopkeeperId,
                totalOrders: existingOrder.totalAmount,
                roundOff: orderRoundOff,
                balance: grandTotal
              }
            })
          }
        } catch (outstandingError) {
          console.error("Error updating outstanding balance:", outstandingError)
          // Continue with order status update even if outstanding update fails
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

    // Round off update - Admin and Viewer can update
    if (roundOff !== undefined) {
      console.log("PUT /api/orders - RoundOff update:", { id, roundOff, userRole: session.user.role })
      
      if (session.user.role !== "ADMIN" && session.user.role !== "VIEWER") {
        return NextResponse.json({ error: "Only admin or viewer can update round off" }, { status: 401 })
      }

      const order = await db.order.update({
        where: { id },
        data: { roundOff: parseFloat(String(roundOff)) },
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

    console.log("PUT /api/orders - No update data provided")
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
    
    console.log("DELETE /api/orders - Session:", session ? { id: session.user.id, role: session.user.role } : null)
    
    if (!session) {
      console.log("DELETE /api/orders - Unauthorized: No session")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    
    console.log("DELETE /api/orders - Order ID:", id)

    if (!id) {
      return NextResponse.json({ error: "Order ID required" }, { status: 400 })
    }

    const order = await db.order.findUnique({ where: { id } })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Admin can delete ANY order in ANY status
    if (session.user.role === "ADMIN") {
      // If deleting a DISPATCHED order, we need to revert the outstanding balance
      if (order.status === "DISPATCHED") {
        const orderRoundOff = Math.round(order.totalAmount) - order.totalAmount
        const grandTotal = Math.round(order.totalAmount)
        
        const outstanding = await db.outstanding.findUnique({
          where: { shopkeeperId: order.shopkeeperId }
        })
        
        if (outstanding) {
          await db.outstanding.update({
            where: { shopkeeperId: order.shopkeeperId },
            data: {
              totalOrders: { decrement: order.totalAmount },
              roundOff: { decrement: orderRoundOff },
              balance: { decrement: grandTotal },
              lastUpdated: new Date()
            }
          })
        }
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

    // Viewers have full access - same as admin for deletion
    if (session.user.role === "VIEWER") {
      // If deleting a DISPATCHED order, revert the outstanding balance
      if (order.status === "DISPATCHED") {
        const orderRoundOff = Math.round(order.totalAmount) - order.totalAmount
        const grandTotal = Math.round(order.totalAmount)
        
        const outstanding = await db.outstanding.findUnique({
          where: { shopkeeperId: order.shopkeeperId }
        })
        
        if (outstanding) {
          await db.outstanding.update({
            where: { shopkeeperId: order.shopkeeperId },
            data: {
              totalOrders: { decrement: order.totalAmount },
              roundOff: { decrement: orderRoundOff },
              balance: { decrement: grandTotal },
              lastUpdated: new Date()
            }
          })
        }
      }
      
      await db.order.delete({
        where: { id }
      })
      
      return NextResponse.json({ message: "Order deleted" })
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  } catch (error) {
    console.error("Delete order error:", error)
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
  }
}
