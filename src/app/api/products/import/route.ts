import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { randomUUID } from "crypto"
import * as XLSX from "xlsx"

// POST - Import products from Excel
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Read the file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[]

    if (data.length === 0) {
      return NextResponse.json({ error: "Excel file is empty" }, { status: 400 })
    }

    // Get all categories for mapping
    const categories = await db.category.findMany()
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2 // Excel row number (1-based + header)

      try {
        // Required fields mapping
        const productName = String(row["Product Name"] || row["product_name"] || row["name"] || "").trim()
        const categoryName = String(row["Category"] || row["category"] || row["category_name"] || "").trim()
        const unitPrice = parseFloat(String(row["Product Price"] || row["unit_price"] || row["price"] || 0))
        const packingDetail = String(row["Packing"] || row["packing"] || row["packing_detail"] || "").trim()
        
        // Optional fields
        const description = String(row["Description"] || row["description"] || "").trim() || null
        const discountPercent = parseFloat(String(row["Discount"] || row["discount"] || row["discount_percent"] || 0))
        const extraDiscountPercent = parseFloat(String(row["Extra Discount"] || row["extra_discount"] || 0))

        // Validate required fields
        if (!productName) {
          results.errors.push(`Row ${rowNum}: Product Name is required`)
          results.failed++
          continue
        }
        if (!unitPrice || unitPrice <= 0) {
          results.errors.push(`Row ${rowNum}: Valid Product Price is required`)
          results.failed++
          continue
        }
        if (!packingDetail) {
          results.errors.push(`Row ${rowNum}: Packing is required`)
          results.failed++
          continue
        }

        // Find category (optional - if not found, product will be uncategorized)
        const categoryId = categoryName ? categoryMap.get(categoryName.toLowerCase()) : null

        // Calculate packing quantity from packing detail (e.g., "20*10" = 200)
        let packingQty = 0
        const packingMatch = packingDetail.match(/(\d+)\s*[\*xX]\s*(\d+)/)
        if (packingMatch) {
          packingQty = parseInt(packingMatch[1]) * parseInt(packingMatch[2])
        } else {
          packingQty = parseFloat(packingDetail) || 0
        }

        const productPrice = unitPrice * packingQty

        // Check if product already exists (by name only, since category is optional)
        const existing = await db.product.findFirst({
          where: { 
            name: productName
          }
        })

        if (existing) {
          // Update existing product
          await db.product.update({
            where: { id: existing.id },
            data: {
              categoryId: categoryId || null,
              unitPrice,
              packingDetail,
              packingQty,
              productPrice,
              description,
              discountPercent,
              extraDiscountPercent
            }
          })
        } else {
          // Create new product
          await db.product.create({
            data: {
              id: randomUUID(),
              name: productName,
              categoryId: categoryId || null,
              unitPrice,
              packingDetail,
              packingQty,
              productPrice,
              description,
              discountPercent,
              extraDiscountPercent
            }
          })
        }

        results.success++
      } catch (error) {
        results.errors.push(`Row ${rowNum}: Failed to process - ${error instanceof Error ? error.message : "Unknown error"}`)
        results.failed++
      }
    }

    return NextResponse.json({
      message: `Import completed: ${results.success} products imported, ${results.failed} failed`,
      ...results
    })
  } catch (error) {
    console.error("Import products error:", error)
    return NextResponse.json({ error: "Failed to import products" }, { status: 500 })
  }
}

// GET - Download sample Excel template
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Create sample data
    const sampleData = [
      {
        "Product Name": "Red Chilli Powder",
        "Category": "Spices",
        "Product Price": 10,
        "Packing": "20*10",
        "Description": "Premium quality red chilli powder",
        "Discount": 5,
        "Extra Discount": 2
      },
      {
        "Product Name": "Turmeric Powder",
        "Category": "Spices",
        "Product Price": 15,
        "Packing": "10*10",
        "Description": "Pure turmeric powder",
        "Discount": 3,
        "Extra Discount": 1
      },
      {
        "Product Name": "Garam Masala",
        "Category": "Blended Spices",
        "Product Price": 20,
        "Packing": "25*5",
        "Description": "Traditional garam masala blend",
        "Discount": 0,
        "Extra Discount": 0
      }
    ]

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(sampleData)

    // Set column widths
    worksheet["!cols"] = [
      { wch: 20 }, // Product Name
      { wch: 15 }, // Category
      { wch: 15 }, // Product Price
      { wch: 12 }, // Packing
      { wch: 35 }, // Description
      { wch: 10 }, // Discount
      { wch: 15 }  // Extra Discount
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, "Products")

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=product_import_template.xlsx"
      }
    })
  } catch (error) {
    console.error("Generate template error:", error)
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 })
  }
}
