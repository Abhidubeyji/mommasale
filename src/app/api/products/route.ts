import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"

// GET - List all products
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get("categoryId")
    const includeInactive = searchParams.get("includeInactive") === "true"

    const where: Record<string, unknown> = {}
    
    // Only filter by isActive if not explicitly including inactive products
    if (!includeInactive) {
      where.isActive = true
    }
    
    if (categoryId) {
      where.categoryId = categoryId
    }

    const products = await db.product.findMany({
      where,
      include: {
        category: true
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error("Get products error:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

// POST - Create product (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, categoryId, unitPrice, packingDetail, packingQty, productPrice, description, discountPercent, extraDiscountPercent } = body

    if (!name || unitPrice === undefined || !packingDetail || packingQty === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const finalProductPrice = productPrice || (packingQty * unitPrice)

    const product = await db.product.create({
      data: {
        id: randomUUID(),
        name,
        categoryId: categoryId || null,
        unitPrice: parseFloat(unitPrice),
        packingDetail,
        packingQty: parseFloat(packingQty),
        productPrice: parseFloat(finalProductPrice),
        description: description || null,
        discountPercent: parseFloat(discountPercent) || 0,
        extraDiscountPercent: parseFloat(extraDiscountPercent) || 0
      },
      include: {
        category: true
      }
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error("Create product error:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}

// PUT - Update product (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, categoryId, unitPrice, packingDetail, packingQty, productPrice, description, discountPercent, extraDiscountPercent, isActive } = body

    if (!id) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (unitPrice !== undefined) updateData.unitPrice = parseFloat(unitPrice)
    if (packingDetail !== undefined) updateData.packingDetail = packingDetail
    if (packingQty !== undefined) updateData.packingQty = parseFloat(packingQty)
    if (productPrice !== undefined) updateData.productPrice = parseFloat(productPrice)
    if (description !== undefined) updateData.description = description || null
    if (discountPercent !== undefined) updateData.discountPercent = parseFloat(discountPercent)
    if (extraDiscountPercent !== undefined) updateData.extraDiscountPercent = parseFloat(extraDiscountPercent)
    if (isActive !== undefined) updateData.isActive = isActive

    // Recalculate product price if needed
    if (unitPrice !== undefined || packingQty !== undefined) {
      const existing = await db.product.findUnique({ where: { id } })
      if (existing) {
        const newUnitPrice = unitPrice !== undefined ? parseFloat(unitPrice) : existing.unitPrice
        const newPackingQty = packingQty !== undefined ? parseFloat(packingQty) : existing.packingQty
        updateData.productPrice = newUnitPrice * newPackingQty
      }
    }

    const product = await db.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true
      }
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error("Update product error:", error)
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
  }
}

// DELETE - Delete product (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 })
    }

    // Check if product is used in any orders
    const orderItems = await db.orderItem.findFirst({
      where: { productId: id }
    })

    if (orderItems) {
      // If used in orders, just deactivate instead of deleting
      await db.product.update({
        where: { id },
        data: { isActive: false }
      })
      return NextResponse.json({ message: "Product deactivated (used in orders)" })
    }

    await db.product.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Product deleted" })
  } catch (error) {
    console.error("Delete product error:", error)
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
  }
}
