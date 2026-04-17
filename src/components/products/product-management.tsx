'use client'

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Pencil, Trash2, Package, Search, Upload, Download, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

interface Product {
  id: string
  name: string
  unitPrice: number
  packingDetail: string
  packingQty: number
  productPrice: number
  description: string | null
  discountPercent: number
  extraDiscountPercent: number
  isActive: boolean
  category: { id: string; name: string } | null
}

interface Category {
  id: string
  name: string
}

interface ImportResult {
  message: string
  success: number
  failed: number
  errors: string[]
}

const initialFormState = {
  name: "",
  categoryId: "",
  unitPrice: "",
  packingDetail: "",
  packingQty: "",
  description: "",
  discountPercent: "0",
  extraDiscountPercent: "0"
}

export function ProductManagement() {
  const { data: session } = useSession()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState(initialFormState)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Import states
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importResultDialogOpen, setImportResultDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-calculated selling price
  const calculatedPrice = formData.unitPrice && formData.packingQty
    ? (parseFloat(formData.unitPrice) * parseFloat(formData.packingQty)).toFixed(2)
    : "0"

  // Auto-calculate packing quantity from packing detail (e.g., "20*10" = 200)
  const parsePackingDetail = (detail: string): number => {
    if (!detail) return 0
    // Replace 'x' with '*' for multiplication
    const normalized = detail.toLowerCase().replace(/x/g, '*')
    // Check if it contains a calculation like "20*10" or "20*10=200"
    const calcMatch = normalized.match(/(\d+)\s*\*\s*(\d+)/)
    if (calcMatch) {
      return parseInt(calcMatch[1]) * parseInt(calcMatch[2])
    }
    // If it's just a number, return it
    const num = parseFloat(normalized)
    return isNaN(num) ? 0 : num
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products")
      if (res.ok) {
        setProducts(await res.json())
      }
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      if (res.ok) {
        setCategories(await res.json())
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  const handlePackingDetailChange = (value: string) => {
    const packingQty = parsePackingDetail(value)
    setFormData({ 
      ...formData, 
      packingDetail: value,
      packingQty: packingQty.toString()
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = "/api/products"
      const method = editingProduct ? "PUT" : "POST"
      const body = {
        id: editingProduct ? editingProduct.id : undefined,
        name: formData.name,
        categoryId: formData.categoryId,
        unitPrice: parseFloat(formData.unitPrice),
        packingDetail: formData.packingDetail,
        packingQty: parseFloat(formData.packingQty),
        productPrice: parseFloat(calculatedPrice),
        description: formData.description || null,
        discountPercent: parseFloat(formData.discountPercent) || 0,
        extraDiscountPercent: parseFloat(formData.extraDiscountPercent) || 0
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        toast.success(`Product ${editingProduct ? "updated" : "created"} successfully`)
        fetchProducts()
        setDialogOpen(false)
        setFormData(initialFormState)
        setEditingProduct(null)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to save product")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      categoryId: product.category?.id || "",
      unitPrice: product.unitPrice.toString(),
      packingDetail: product.packingDetail,
      packingQty: product.packingQty.toString(),
      description: product.description || "",
      discountPercent: product.discountPercent.toString(),
      extraDiscountPercent: product.extraDiscountPercent.toString()
    })
    setDialogOpen(true)
  }

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return
    
    setDeleting(true)
    try {
      const res = await fetch(`/api/products?id=${productToDelete.id}`, { 
        method: "DELETE" 
      })

      if (res.ok) {
        toast.success("Product deleted successfully")
        fetchProducts()
        setDeleteDialogOpen(false)
        setProductToDelete(null)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete product")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (product: Product) => {
    try {
      const res = await fetch("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          isActive: !product.isActive
        })
      })

      if (res.ok) {
        toast.success(`Product ${product.isActive ? "deactivated" : "activated"} successfully`)
        fetchProducts()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update product")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  // Import handlers
  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch("/api/products/import")
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "product_import_template.xlsx"
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
        toast.success("Template downloaded successfully")
      } else {
        toast.error("Failed to download template")
      }
    } catch (error) {
      toast.error("Failed to download template")
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ]
    if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Please upload an Excel file (.xlsx or .xls)")
      return
    }

    setImporting(true)
    setImportDialogOpen(false)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/products/import", {
        method: "POST",
        body: formData
      })

      const data = await res.json()

      if (res.ok) {
        setImportResult(data)
        setImportResultDialogOpen(true)
        fetchProducts()
      } else {
        toast.error(data.error || "Failed to import products")
      }
    } catch (error) {
      toast.error("Failed to import products")
    } finally {
      setImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.category?.name?.toLowerCase() || "uncategorized").includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || product.category?.id === categoryFilter
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            Products
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage product catalog</p>
        </div>

        {session?.user?.role === "ADMIN" && (
          <div className="flex flex-wrap gap-2">
            {/* Import Button */}
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-50">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md w-[95vw]">
                <DialogHeader>
                  <DialogTitle>Import Products from Excel</DialogTitle>
                  <DialogDescription>
                    Upload an Excel file with product data. Products with the same name and category will be updated.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex flex-col gap-4">
                    <Button
                      variant="outline"
                      onClick={handleDownloadTemplate}
                      className="w-full"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Template
                    </Button>
                    
                    <div className="relative">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".xlsx,.xls"
                        onChange={handleFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Select Excel File
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-medium">Required columns:</p>
                    <ul className="list-disc list-inside text-xs space-y-0.5">
                      <li>Product Name</li>
                      <li>Product Price</li>
                      <li>Packing (e.g., 20*10)</li>
                    </ul>
                    <p className="font-medium mt-2">Optional columns:</p>
                    <ul className="list-disc list-inside text-xs space-y-0.5">
                      <li>Category (if not found, product will be uncategorized)</li>
                      <li>Description</li>
                      <li>Discount</li>
                      <li>Extra Discount</li>
                    </ul>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Add Product Button */}
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) {
                setEditingProduct(null)
                setFormData(initialFormState)
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? "Edit Product" : "Create Product"}</DialogTitle>
                    <DialogDescription>
                      {editingProduct ? "Update product information" : "Add a new product to the catalog"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 sm:gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Product Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter product name"
                        required
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="category">Product Category *</Label>
                      <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="unitPrice">Product Price (₹) *</Label>
                        <Input
                          id="unitPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.unitPrice}
                          onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                          placeholder="e.g., 10"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="packingDetail">Packing (e.g., 20*10) *</Label>
                        <Input
                          id="packingDetail"
                          value={formData.packingDetail}
                          onChange={(e) => handlePackingDetailChange(e.target.value)}
                          placeholder="e.g., 20*10"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="packingQty">Packing Qty (Auto)</Label>
                        <Input
                          id="packingQty"
                          type="number"
                          value={formData.packingQty}
                          readOnly
                          className="bg-gray-50 dark:bg-gray-800"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Selling Price (Auto)</Label>
                        <div className="flex items-center h-9 px-3 rounded-md border bg-orange-50 dark:bg-gray-800 text-orange-600 dark:text-orange-400 font-medium">
                          ₹{calculatedPrice}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="description">Product Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Enter product description (optional)"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="discountPercent">Discount (%)</Label>
                        <Input
                          id="discountPercent"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={formData.discountPercent}
                          onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="extraDiscountPercent">Extra Discount (%)</Label>
                        <Input
                          id="extraDiscountPercent"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={formData.extraDiscountPercent}
                          onChange={(e) => setFormData({ ...formData, extraDiscountPercent: e.target.value })}
                          placeholder="0"
                        />
                        <p className="text-xs text-muted-foreground">Max limit for users</p>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                      {saving ? "Saving..." : editingProduct ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="border-orange-200 dark:border-gray-800 shrink-0">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 sm:h-11"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48 h-10 sm:h-11">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 dark:border-gray-800 flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-500" />
            All Products
          </CardTitle>
          <CardDescription>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
          {/* Mobile Card View */}
          <div className="sm:hidden flex-1 overflow-auto p-3 space-y-3">
            {filteredProducts.map((product) => (
              <div key={product.id} className={`border rounded-lg p-3 bg-white dark:bg-gray-800 space-y-2 ${!product.isActive ? "opacity-50" : ""}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <Badge variant="outline" className={!product.category ? "text-gray-400" : "mt-1"}>
                      {product.category?.name || "No Category"}
                    </Badge>
                  </div>
                  <Badge className={product.isActive ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"}>
                    {product.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                
                {product.description && (
                  <p className="text-xs text-muted-foreground truncate">{product.description}</p>
                )}
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Packing</p>
                    <p className="font-medium">{product.packingDetail}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Selling Price</p>
                    <p className="font-bold text-orange-600">₹{product.productPrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Discount</p>
                    <p className="font-medium">{product.discountPercent}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Extra Disc.</p>
                    <p className="font-medium">{product.extraDiscountPercent}%</p>
                  </div>
                </div>
                
                {session?.user?.role === "ADMIN" && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(product)}
                      className="flex-1 h-8"
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(product)}
                      className={`flex-1 h-8 ${product.isActive ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}`}
                    >
                      <Package className="h-3 w-3 mr-1" /> {product.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(product)}
                      className="flex-1 h-8 text-red-600 border-red-200"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No products found. {session?.user?.role === "ADMIN" && "Create your first product or import from Excel."}
              </div>
            )}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden sm:block flex-1 overflow-auto">
            {/* Mobile scroll hint */}
            <div className="md:hidden text-xs text-muted-foreground text-center py-1 bg-orange-50 dark:bg-gray-800 border-b shrink-0">
              ← Swipe to scroll →
            </div>
            <div className="overflow-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Product</TableHead>
                    <TableHead className="whitespace-nowrap">Category</TableHead>
                    <TableHead className="whitespace-nowrap hidden md:table-cell">Packing</TableHead>
                    <TableHead className="text-right whitespace-nowrap hidden md:table-cell">Product Price</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Selling Price</TableHead>
                    <TableHead className="text-right whitespace-nowrap hidden md:table-cell">Discount</TableHead>
                    <TableHead className="text-right whitespace-nowrap hidden lg:table-cell">Extra Discount</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    {session?.user?.role === "ADMIN" && (
                      <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className={!product.isActive ? "opacity-50" : ""}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-muted-foreground">{product.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={!product.category ? "text-gray-400" : ""}>
                          {product.category?.name || "No Category"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.packingDetail}
                      </TableCell>
                      <TableCell className="text-right">₹{product.unitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">₹{product.productPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{product.discountPercent}%</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          {product.extraDiscountPercent}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={product.isActive ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      {session?.user?.role === "ADMIN" && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(product)}
                              className="hover:bg-orange-100 dark:hover:bg-gray-800"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4 text-orange-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(product)}
                              className="hover:bg-orange-100 dark:hover:bg-gray-800"
                              title={product.isActive ? "Deactivate" : "Activate"}
                            >
                              <Package className={`h-4 w-4 ${product.isActive ? "text-red-500" : "text-green-500"}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(product)}
                              className="hover:bg-red-100 dark:hover:bg-gray-800"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {filteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No products found. {session?.user?.role === "ADMIN" && "Create your first product or import from Excel."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Result Dialog */}
      <Dialog open={importResultDialogOpen} onOpenChange={setImportResultDialogOpen}>
        <DialogContent className="sm:max-w-md w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
            <DialogDescription>
              {importResult?.message}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-4">
              <div className="flex-1 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{importResult?.success}</p>
                <p className="text-sm text-green-600 dark:text-green-400">Imported</p>
              </div>
              <div className="flex-1 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{importResult?.failed}</p>
                <p className="text-sm text-red-600 dark:text-red-400">Failed</p>
              </div>
            </div>
            
            {importResult?.errors && importResult.errors.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-sm">Errors:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.errors.map((error, index) => (
                    <p key={index} className="text-xs text-red-600 dark:text-red-400">{error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setImportResultDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading overlay for import */}
      {importing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-64">
            <CardContent className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-sm">Importing products...</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
