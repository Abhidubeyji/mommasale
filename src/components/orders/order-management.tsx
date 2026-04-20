'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus, ShoppingCart, Clock, CheckCircle, XCircle, Truck, 
  Search, Trash2, Eye, Package, Calculator, User, Edit, Save, Loader2, Download
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import * as XLSX from "xlsx"

interface Product {
  id: string
  name: string
  unitPrice: number
  packingDetail: string
  packingQty: number
  productPrice: number
  discountPercent: number
  extraDiscountPercent: number
  category: { id: string; name: string } | null
}

interface Shopkeeper {
  id: string
  shopName: string
  ownerName: string
  mobile: string
  city: string | null
}

interface Order {
  id: string
  orderId: string
  status: string
  subtotal: number
  adminDiscount: number
  extraDiscount: number
  totalAmount: number
  notes: string | null
  createdAt: string
  approvedAt: string | null
  dispatchedAt: string | null
  shopkeeper: {
    id: string
    shopName: string
    ownerName: string
    mobile: string
  }
  user: {
    id: string
    name: string
    email: string
  }
  items: Array<{
    id: string
    productId: string
    quantity: number
    unitPrice: number
    productPrice: number
    adminDiscount: number
    extraDiscount: number
    finalPrice: number
    product: {
      id: string
      name: string
      packingDetail: string
      packingQty: number
      category: {
        id: string
        name: string
      } | null
    }
  }>
}

interface OrderItemInput {
  productId: string
  productName: string
  categoryName: string
  packingDetail: string
  productPrice: number
  quantity: number
  unitPrice: number
  adminDiscount: number
  extraDiscount: number
}

export function OrderManagement() {
  const { data: session, status } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shopkeepers, setShopkeepers] = useState<Shopkeeper[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all") // New: category filter for orders
  const [productSearchTerm, setProductSearchTerm] = useState("") // New: product search in dialogs

  // Order creation state
  const [selectedShopkeeper, setSelectedShopkeeper] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [orderItems, setOrderItems] = useState<OrderItemInput[]>([])
  const [orderNotes, setOrderNotes] = useState("")

  // Edit state
  const [editShopkeeper, setEditShopkeeper] = useState("")
  const [editItems, setEditItems] = useState<OrderItemInput[]>([])
  const [editNotes, setEditNotes] = useState("")
  const [editCategory, setEditCategory] = useState("") // New: category filter for edit dialog
  const [editProductSearch, setEditProductSearch] = useState("") // New: product search for edit dialog

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [session])

  const fetchData = async () => {
    try {
      const fetchOptions = {
        credentials: 'include' as const,
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const [ordersRes, productsRes, shopkeepersRes, categoriesRes] = await Promise.all([
        fetch("/api/orders", fetchOptions),
        fetch("/api/products", fetchOptions),
        fetch("/api/shopkeepers", fetchOptions),
        fetch("/api/categories", fetchOptions)
      ])

      if (ordersRes.ok) {
        setOrders(await ordersRes.json())
      } else {
        const errorData = await ordersRes.json().catch(() => ({}))
        console.error("Failed to fetch orders:", ordersRes.status, errorData)
        if (ordersRes.status === 401) {
          toast.error("Session expired. Please login again.")
          return
        }
      }
      
      if (productsRes.ok) {
        const productsData = await productsRes.json()
        setProducts(productsData)
      } else {
        console.error("Failed to fetch products:", productsRes.status)
      }
      
      if (shopkeepersRes.ok) {
        const shopkeepersData = await shopkeepersRes.json()
        setShopkeepers(shopkeepersData)
      } else {
        console.error("Failed to fetch shopkeepers:", shopkeepersRes.status)
      }
      
      if (categoriesRes.ok) {
        setCategories(await categoriesRes.json())
      } else {
        console.error("Failed to fetch categories:", categoriesRes.status)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load data. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }

  // Filter products by category AND search term
  const filteredProducts = products.filter(p => {
    const matchesCategory = !selectedCategory || p.category?.id === selectedCategory
    const matchesSearch = !productSearchTerm || 
      p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      p.category?.name.toLowerCase().includes(productSearchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Filter products for edit dialog
  const filteredProductsForEdit = products.filter(p => {
    const matchesCategory = !editCategory || p.category?.id === editCategory
    const matchesSearch = !editProductSearch || 
      p.name.toLowerCase().includes(editProductSearch.toLowerCase()) ||
      p.category?.name.toLowerCase().includes(editProductSearch.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const calculateItemPrice = (item: Partial<OrderItemInput>) => {
    const basePrice = (item.productPrice || 0) * (item.quantity || 0)
    const adminDiscountAmount = basePrice * ((item.adminDiscount || 0) / 100)
    const extraDiscountAmount = basePrice * ((item.extraDiscount || 0) / 100)
    return {
      basePrice,
      adminDiscountAmount,
      extraDiscountAmount,
      finalPrice: basePrice - adminDiscountAmount - extraDiscountAmount
    }
  }

  const orderTotals = orderItems.reduce((acc, item) => {
    const prices = calculateItemPrice(item)
    acc.subtotal += prices.basePrice
    acc.adminDiscount += prices.adminDiscountAmount
    acc.extraDiscount += prices.extraDiscountAmount
    acc.total += prices.finalPrice
    return acc
  }, { subtotal: 0, adminDiscount: 0, extraDiscount: 0, total: 0 })

  const addOrderItem = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    if (orderItems.find(item => item.productId === productId)) {
      toast.error("Product already added to order")
      return
    }

    setOrderItems([...orderItems, {
      productId: product.id,
      productName: product.name,
      categoryName: product.category?.name || "No Category",
      packingDetail: product.packingDetail,
      productPrice: product.productPrice,
      quantity: 1,
      unitPrice: product.unitPrice,
      adminDiscount: product.discountPercent,
      extraDiscount: 0
    }])
  }

  const updateOrderItem = (index: number, field: string, value: number) => {
    const product = products.find(p => p.id === orderItems[index]?.productId)
    const updated = [...orderItems]
    
    if (field === "adminDiscount" && product && value > product.discountPercent) {
      toast.error(`Admin discount cannot exceed ${product.discountPercent}%`)
      return
    }
    if (field === "extraDiscount" && product && value > product.extraDiscountPercent) {
      toast.error(`Extra discount cannot exceed ${product.extraDiscountPercent}%`)
      return
    }
    if ((field === "adminDiscount" || field === "extraDiscount") && value > 100) {
      toast.error("Discount cannot exceed 100%")
      return
    }
    
    updated[index] = { ...updated[index], [field]: value }
    setOrderItems(updated)
  }

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const handleCreateOrder = async () => {
    if (!selectedShopkeeper) {
      toast.error("Please select a shopkeeper")
      return
    }
    if (orderItems.length === 0) {
      toast.error("Please add at least one product")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopkeeperId: selectedShopkeeper,
          items: orderItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productPrice: item.productPrice,
            adminDiscount: item.adminDiscount,
            extraDiscount: item.extraDiscount
          })),
          notes: orderNotes
        })
      })

      if (res.ok) {
        toast.success("Order created successfully")
        setCreateDialogOpen(false)
        resetOrderForm()
        fetchData()
      } else {
        const data = await res.json().catch(() => ({ error: "Failed to create order" }))
        if (res.status === 401) {
          toast.error("Session expired. Please login again.")
        } else {
          toast.error(data.error || "Failed to create order")
        }
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  const resetOrderForm = () => {
    setSelectedShopkeeper("")
    setSelectedCategory("")
    setOrderItems([])
    setOrderNotes("")
    setProductSearchTerm("") // Reset product search
  }

  // Open edit dialog
  const openEditDialog = (order: Order) => {
    setSelectedOrder(order)
    setEditShopkeeper(order.shopkeeper.id)
    setEditCategory("") // Reset category filter
    setEditProductSearch("") // Reset product search
    setEditItems(order.items.map(item => ({
      productId: item.productId,
      productName: item.product.name,
      categoryName: item.product.category?.name || "No Category",
      packingDetail: item.product.packingDetail,
      productPrice: item.productPrice,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      adminDiscount: item.adminDiscount,
      extraDiscount: item.extraDiscount
    })))
    setEditNotes(order.notes || "")
    setEditDialogOpen(true)
  }

  // Handle edit order
  const handleEditOrder = async () => {
    if (!selectedOrder) return
    if (!editShopkeeper) {
      toast.error("Please select a shopkeeper")
      return
    }
    if (editItems.length === 0) {
      toast.error("Please add at least one product")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedOrder.id,
          shopkeeperId: editShopkeeper,
          items: editItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productPrice: item.productPrice,
            adminDiscount: item.adminDiscount,
            extraDiscount: item.extraDiscount
          })),
          notes: editNotes
        })
      })

      if (res.ok) {
        toast.success("Order updated successfully")
        setEditDialogOpen(false)
        fetchData()
      } else {
        const data = await res.json().catch(() => ({ error: "Failed to update order" }))
        toast.error(data.error || "Failed to update order")
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  // Add item to edit order
  const addEditItem = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    if (editItems.find(item => item.productId === productId)) {
      toast.error("Product already added to order")
      return
    }

    setEditItems([...editItems, {
      productId: product.id,
      productName: product.name,
      categoryName: product.category?.name || "No Category",
      packingDetail: product.packingDetail,
      productPrice: product.productPrice,
      quantity: 1,
      unitPrice: product.unitPrice,
      adminDiscount: product.discountPercent,
      extraDiscount: 0
    }])
  }

  // Update edit item
  const updateEditItem = (index: number, field: string, value: number) => {
    const product = products.find(p => p.id === editItems[index]?.productId)
    const updated = [...editItems]
    
    if (field === "adminDiscount" && product && value > product.discountPercent) {
      toast.error(`Admin discount cannot exceed ${product.discountPercent}%`)
      return
    }
    if (field === "extraDiscount" && product && value > product.extraDiscountPercent) {
      toast.error(`Extra discount cannot exceed ${product.extraDiscountPercent}%`)
      return
    }
    
    updated[index] = { ...updated[index], [field]: value }
    setEditItems(updated)
  }

  // Remove edit item
  const removeEditItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index))
  }

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: newStatus })
      })

      if (res.ok) {
        toast.success(`Order ${newStatus.toLowerCase()} successfully`)
        fetchData()
        setDetailsDialogOpen(false)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update order")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to delete this order?")) return
    
    try {
      const res = await fetch(`/api/orders?id=${orderId}`, { 
        method: "DELETE",
        credentials: 'include'
      })
      if (res.ok) {
        toast.success("Order deleted successfully")
        fetchData()
        setDetailsDialogOpen(false)
        setEditDialogOpen(false)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete order")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING": return <Clock className="h-4 w-4 text-yellow-500" />
      case "APPROVED": return <CheckCircle className="h-4 w-4 text-green-500" />
      case "REJECTED": return <XCircle className="h-4 w-4 text-red-500" />
      case "DISPATCHED": return <Truck className="h-4 w-4 text-orange-500" />
      default: return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "APPROVED": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "REJECTED": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "DISPATCHED": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      default: return ""
    }
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shopkeeper.shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shopkeeper.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    // Filter by category - check if any item in the order has the selected category
    const matchesCategory = categoryFilter === "all" || 
      order.items.some(item => item.product?.category?.id === categoryFilter)
    return matchesSearch && matchesStatus && matchesCategory
  })

  // Calculate totals for filtered orders
  const filteredOrdersTotals = filteredOrders.reduce((acc, order) => {
    acc.totalAmount += order.totalAmount
    acc.subtotal += order.subtotal
    acc.totalDiscount += order.adminDiscount + order.extraDiscount
    acc.orderCount += 1
    return acc
  }, { totalAmount: 0, subtotal: 0, totalDiscount: 0, orderCount: 0 })

  // Export orders to Excel
  const exportOrdersToExcel = () => {
    const ordersToExport = statusFilter === "all" ? filteredOrders : 
      filteredOrders.filter(o => o.status === statusFilter)
    
    if (ordersToExport.length === 0) {
      toast.error("No orders to export")
      return
    }

    // Flatten orders with items
    const rows: unknown[][] = []
    ordersToExport.forEach(order => {
      if (order.items.length === 0) {
        rows.push([
          order.orderId,
          order.shopkeeper.shopName,
          order.shopkeeper.ownerName,
          order.shopkeeper.mobile,
          order.user?.name || "",
          "", "", "", "", "", "", "", "", 0, 0, 0, 0,
          order.status,
          format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")
        ])
      } else {
        order.items.forEach(item => {
          rows.push([
            order.orderId,
            order.shopkeeper.shopName,
            order.shopkeeper.ownerName,
            order.shopkeeper.mobile,
            order.user?.name || "",
            item.product.name,
            item.product.category?.name || "No Category",
            item.product.packingDetail,
            item.quantity,
            item.unitPrice,
            item.productPrice,
            item.adminDiscount,
            item.extraDiscount,
            item.finalPrice,
            order.subtotal,
            order.adminDiscount + order.extraDiscount,
            order.totalAmount,
            order.status,
            format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")
          ])
        })
      }
    })

    const headers = [
      "Order ID", "Shop Name", "Owner", "Mobile", "Created By",
      "Product", "Category", "Packing", "Qty", "Unit Price", "Product Price",
      "Admin Disc %", "Extra Disc %", "Item Amount", "Subtotal", "Total Discount", "Order Total",
      "Status", "Date"
    ]

    const worksheetData = [headers, ...rows]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    worksheet['!cols'] = headers.map((_, i) => ({
      wch: Math.max(...worksheetData.map(row => String(row[i] || "").length)) + 2
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, worksheet, "Orders")
    XLSX.writeFile(wb, `orders_${statusFilter === "all" ? "all" : statusFilter.toLowerCase()}_${format(new Date(), "yyyy-MM-dd")}.xlsx`)
    toast.success("Orders exported to Excel")
  }

  // Group orders by status for tabs
  const pendingOrders = filteredOrders.filter(o => o.status === "PENDING")
  const approvedOrders = filteredOrders.filter(o => o.status === "APPROVED")
  const dispatchedOrders = filteredOrders.filter(o => o.status === "DISPATCHED")
  const rejectedOrders = filteredOrders.filter(o => o.status === "REJECTED")

  // Flatten orders for detailed view (one row per item)
  const flattenOrders = (orderList: Order[]) => {
    const rows: Array<{
      order: Order
      item: Order['items'][0] | null
      isFirstRow: boolean
      rowSpan: number
    }> = []
    
    orderList.forEach(order => {
      if (order.items.length === 0) {
        rows.push({ order, item: null, isFirstRow: true, rowSpan: 1 })
      } else {
        order.items.forEach((item, index) => {
          rows.push({
            order,
            item,
            isFirstRow: index === 0,
            rowSpan: order.items.length
          })
        })
      }
    })
    return rows
  }

  if (loading || status === "loading") {
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
            Orders
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage orders and approvals</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {session?.user?.role !== "VIEWER" && (
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Button>
          )}
          {(session?.user?.role === "ADMIN" || session?.user?.canExport === true) && (
            <Button variant="outline" onClick={exportOrdersToExcel} className="gap-2">
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="border-orange-200 dark:border-gray-800 shrink-0">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Order ID, Shop name, Owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 sm:h-11"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48 h-10 sm:h-11">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtered Orders Summary */}
      <Card className="border-orange-200 dark:border-gray-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 shrink-0">
        <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-4">
            <div className="text-center">
              <p className="text-xs sm:text-sm text-muted-foreground">Total Orders</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{filteredOrdersTotals.orderCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm text-muted-foreground">Subtotal</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300">₹{filteredOrdersTotals.subtotal.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm text-muted-foreground">Total Discount</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">₹{filteredOrdersTotals.totalDiscount.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm text-muted-foreground">Total Amount</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300">₹{filteredOrdersTotals.totalAmount.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm text-muted-foreground">Round Off</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                {(() => {
                  const roundOff = Math.round(filteredOrdersTotals.totalAmount) - filteredOrdersTotals.totalAmount
                  return `${roundOff >= 0 ? '+' : ''}₹${roundOff.toFixed(2)}`
                })()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm text-muted-foreground">Grand Total</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">₹{Math.round(filteredOrdersTotals.totalAmount).toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Tabs */}
      <Tabs defaultValue="all" className="space-y-4 flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 shrink-0">
          <TabsList className="bg-orange-100 dark:bg-gray-800 w-max sm:w-auto">
            <TabsTrigger value="all" className="text-xs sm:text-sm">All ({filteredOrders.length})</TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white text-xs sm:text-sm">
              Pending ({pendingOrders.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:bg-green-500 data-[state=active]:text-white text-xs sm:text-sm">
              Approved ({approvedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="dispatched" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs sm:text-sm">
              Dispatched ({dispatchedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-red-500 data-[state=active]:text-white text-xs sm:text-sm">
              Rejected ({rejectedOrders.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {["all", "pending", "approved", "dispatched", "rejected"].map((tab) => {
          const tabOrders = tab === "all" ? filteredOrders :
            tab === "pending" ? pendingOrders :
            tab === "approved" ? approvedOrders :
            tab === "dispatched" ? dispatchedOrders :
            rejectedOrders

          const flatRows = flattenOrders(tabOrders)

          return (
            <TabsContent key={tab} value={tab} className="flex-1 min-h-0 mt-0">
              <Card className="border-orange-200 dark:border-gray-800 h-full flex flex-col">
                <CardContent className="p-0 flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Mobile scroll hint */}
                  <div className="md:hidden text-xs text-muted-foreground text-center py-1 bg-orange-50 dark:bg-gray-800 border-b shrink-0">
                    ← Swipe to scroll →
                  </div>
                  <div className="overflow-auto flex-1 -mx-3 sm:mx-0">
                    <Table className="min-w-[1200px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Order ID</TableHead>
                          <TableHead className="whitespace-nowrap">Shopkeeper</TableHead>
                          {session?.user?.role === "ADMIN" && (
                            <TableHead className="whitespace-nowrap">Order By</TableHead>
                          )}
                          <TableHead className="whitespace-nowrap">Product</TableHead>
                          <TableHead className="whitespace-nowrap">Category</TableHead>
                          <TableHead className="whitespace-nowrap">Packing</TableHead>
                          <TableHead className="text-center whitespace-nowrap">Qty</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Product Price</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Selling Price</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Discount %</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Extra Discount %</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Round Off</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Grand Total</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                          <TableHead className="whitespace-nowrap">Date</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {flatRows.map((row, rowIndex) => (
                          <TableRow key={`${row.order.id}-${rowIndex}`}>
                            {row.isFirstRow && (
                              <>
                                <TableCell rowSpan={row.rowSpan} className="font-mono font-medium whitespace-nowrap">
                                  {row.order.orderId}
                                </TableCell>
                                <TableCell rowSpan={row.rowSpan} className="whitespace-nowrap">
                                  <div>
                                    <p className="font-medium text-sm sm:text-base">{row.order.shopkeeper.shopName}</p>
                                    <p className="text-xs sm:text-sm text-muted-foreground">{row.order.shopkeeper.ownerName}</p>
                                    <p className="text-xs text-muted-foreground hidden sm:block">{row.order.shopkeeper.mobile}</p>
                                  </div>
                                </TableCell>
                                {session?.user?.role === "ADMIN" && (
                                  <TableCell rowSpan={row.rowSpan} className="whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-sm">{row.order.user?.name || "Unknown"}</span>
                                    </div>
                                  </TableCell>
                                )}
                              </>
                            )}
                            {row.item ? (
                              <>
                                <TableCell className="whitespace-nowrap">{row.item.product.name}</TableCell>
                                <TableCell className="whitespace-nowrap">{row.item.product.category?.name || "No Category"}</TableCell>
                                <TableCell className="whitespace-nowrap">{row.item.product.packingDetail}</TableCell>
                                <TableCell className="text-center font-medium whitespace-nowrap">{row.item.quantity}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">₹{row.item.productPrice.toFixed(2)}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">₹{(row.item.finalPrice / row.item.quantity).toFixed(2)}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">{row.item.adminDiscount}%</TableCell>
                                <TableCell className="text-right whitespace-nowrap">{row.item.extraDiscount}%</TableCell>
                                <TableCell className="text-right font-medium whitespace-nowrap">₹{row.item.finalPrice.toFixed(2)}</TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell colSpan={9} className="text-center text-muted-foreground">No items</TableCell>
                              </>
                            )}
                            {row.isFirstRow && (
                              <>
                                <TableCell rowSpan={row.rowSpan} className="text-right whitespace-nowrap">
                                  <p className="text-blue-600 font-medium">
                                    {(() => {
                                      const roundOff = Math.round(row.order.totalAmount) - row.order.totalAmount
                                      return `${roundOff >= 0 ? '+' : ''}₹${roundOff.toFixed(2)}`
                                    })()}
                                  </p>
                                </TableCell>
                                <TableCell rowSpan={row.rowSpan} className="text-right whitespace-nowrap">
                                  <p className="font-bold text-orange-600">₹{Math.round(row.order.totalAmount).toFixed(2)}</p>
                                </TableCell>
                                <TableCell rowSpan={row.rowSpan} className="whitespace-nowrap">
                                  <Badge className={getStatusColor(row.order.status)}>
                                    <span className="flex items-center gap-1">
                                      {getStatusIcon(row.order.status)}
                                      <span>{row.order.status}</span>
                                    </span>
                                  </Badge>
                                </TableCell>
                                <TableCell rowSpan={row.rowSpan} className="text-muted-foreground whitespace-nowrap">
                                  {format(new Date(row.order.createdAt), "dd MMM yyyy")}
                                </TableCell>
                                <TableCell rowSpan={row.rowSpan} className="text-right whitespace-nowrap">
                                  <div className="flex justify-end gap-1 sm:gap-2">
                                    {/* Admin can edit ANY order EXCEPT DISPATCHED, can delete ANY order */}
                                    {session?.user?.role === "ADMIN" && (
                                      <>
                                        {row.order.status !== "DISPATCHED" && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditDialog(row.order)}
                                            className="hover:bg-blue-100 dark:hover:bg-gray-800"
                                            title="Edit Order"
                                          >
                                            <Edit className="h-4 w-4 text-blue-500" />
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDeleteOrder(row.order.id)}
                                          className="hover:bg-red-100 dark:hover:bg-gray-800"
                                          title="Delete Order"
                                        >
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </>
                                    )}
                                    {/* Sales user can edit/delete only PENDING orders (before admin approval) */}
                                    {session?.user?.role === "SALES" && row.order.status === "PENDING" && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => openEditDialog(row.order)}
                                          className="hover:bg-blue-100 dark:hover:bg-gray-800"
                                          title="Edit Order"
                                        >
                                          <Edit className="h-4 w-4 text-blue-500" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDeleteOrder(row.order.id)}
                                          className="hover:bg-red-100 dark:hover:bg-gray-800"
                                          title="Delete Order"
                                        >
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setSelectedOrder(row.order)
                                        setDetailsDialogOpen(true)
                                      }}
                                      className="hover:bg-orange-100 dark:hover:bg-gray-800"
                                      title="View Details"
                                    >
                                      <Eye className="h-4 w-4 text-orange-500" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                        {tabOrders.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={session?.user?.role === "ADMIN" ? 17 : 16} className="text-center text-muted-foreground py-8">
                              No orders found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Create Order Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open)
        if (!open) resetOrderForm()
      }}>
        <DialogContent className="sm:max-w-6xl w-[95vw] max-w-[95vw] sm:w-auto sm:max-w-6xl h-[90vh] sm:h-[85vh] max-h-[95vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
            <DialogTitle className="text-lg sm:text-xl">Create New Order</DialogTitle>
            <DialogDescription>
              Select shopkeeper and add products to create an order
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-2">{/* Shopkeeper Selection */}
              <div className="grid gap-3">
                <Label className="text-base font-semibold">Select Shopkeeper *</Label>
                {shopkeepers.length === 0 ? (
                  <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      No shopkeepers available. Please add shopkeepers first.
                    </p>
                  </div>
                ) : (
                  <Select value={selectedShopkeeper} onValueChange={setSelectedShopkeeper}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Choose a shopkeeper" />
                    </SelectTrigger>
                    <SelectContent>
                      {shopkeepers.map((sk) => (
                        <SelectItem key={sk.id} value={sk.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{sk.shopName}</span>
                            <span className="text-xs text-muted-foreground">{sk.ownerName} • {sk.mobile} {sk.city && `• ${sk.city}`}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              {/* Product Selection */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Search & Add Products</Label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label>Search Product</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by product or category name..."
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <Label>Filter by Category</Label>
                    <Select value={selectedCategory || "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}>
                      <SelectTrigger>
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
                </div>
                
                {/* Product List */}
                <div className="border rounded-lg p-2 sm:p-3 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-800">
                  {products.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No products available.</p>
                  ) : filteredProducts.filter(p => !orderItems.find(oi => oi.productId === p.id)).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">All matching products already added.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {filteredProducts
                        .filter(p => !orderItems.find(oi => oi.productId === p.id))
                        .map((product) => (
                          <div
                            key={product.id}
                            onClick={() => addOrderItem(product.id)}
                            className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-orange-50 dark:hover:bg-gray-600 cursor-pointer border border-gray-200 dark:border-gray-600 hover:border-orange-300 transition-colors"
                          >
                            <div className="flex-1 min-w-0 mr-2">
                              <p className="font-medium text-sm truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{product.category?.name} • {product.packingDetail}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-semibold text-orange-600 dark:text-orange-400 text-sm">₹{product.productPrice.toFixed(2)}</p>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                                <Plus className="h-3 w-3 mr-1" /> Add
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items Table */}
              {orderItems.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Order Items ({orderItems.length})</Label>
                  
                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-2">
                    {orderItems.map((item, index) => {
                      const product = products.find(p => p.id === item.productId)
                      const prices = calculateItemPrice(item)
                      
                      return (
                        <div key={item.productId} className="border rounded-lg p-3 bg-white dark:bg-gray-800 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.productName}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.packingDetail}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOrderItem(index)}
                              className="h-8 w-8 shrink-0"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Price</p>
                              <p className="font-medium">₹{item.productPrice.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Qty</p>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateOrderItem(index, "quantity", parseInt(e.target.value) || 1)}
                                className="w-full h-8 text-center"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Disc %</p>
                              <Input
                                type="number"
                                min="0"
                                max={product?.discountPercent || 100}
                                value={item.adminDiscount}
                                onChange={(e) => updateOrderItem(index, "adminDiscount", parseFloat(e.target.value) || 0)}
                                className="w-full h-8 text-center"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Extra %</p>
                              <Input
                                type="number"
                                min="0"
                                max={product?.extraDiscountPercent || 100}
                                value={item.extraDiscount}
                                onChange={(e) => updateOrderItem(index, "extraDiscount", parseFloat(e.target.value) || 0)}
                                className="w-full h-8 text-center"
                              />
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-sm text-muted-foreground">Amount</span>
                            <span className="font-bold text-orange-600">₹{prices.finalPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden sm:block border rounded-lg overflow-x-auto">
                    <Table className="text-sm">
                      <TableHeader>
                        <TableRow className="bg-orange-50 dark:bg-gray-800">
                          <TableHead className="font-semibold whitespace-nowrap">Product</TableHead>
                          <TableHead className="font-semibold whitespace-nowrap hidden md:table-cell">Category</TableHead>
                          <TableHead className="font-semibold whitespace-nowrap hidden lg:table-cell">Packing</TableHead>
                          <TableHead className="text-right font-semibold whitespace-nowrap">Price</TableHead>
                          <TableHead className="text-center font-semibold whitespace-nowrap">Qty</TableHead>
                          <TableHead className="text-right font-semibold whitespace-nowrap">Disc %</TableHead>
                          <TableHead className="text-right font-semibold whitespace-nowrap hidden md:table-cell">Extra %</TableHead>
                          <TableHead className="text-right font-semibold whitespace-nowrap hidden lg:table-cell">Sell Price</TableHead>
                          <TableHead className="text-right font-semibold whitespace-nowrap">Amount</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item, index) => {
                          const product = products.find(p => p.id === item.productId)
                          const prices = calculateItemPrice(item)
                          const sellingPrice = item.quantity > 0 ? prices.finalPrice / item.quantity : 0
                          
                          return (
                            <TableRow key={item.productId}>
                              <TableCell className="font-medium max-w-[150px] truncate">{item.productName}</TableCell>
                              <TableCell className="hidden md:table-cell">{item.categoryName}</TableCell>
                              <TableCell className="hidden lg:table-cell">{item.packingDetail}</TableCell>
                              <TableCell className="text-right">₹{item.productPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateOrderItem(index, "quantity", parseInt(e.target.value) || 1)}
                                  className="w-16 h-8 text-center mx-auto"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={product?.discountPercent || 100}
                                    value={item.adminDiscount}
                                    onChange={(e) => updateOrderItem(index, "adminDiscount", parseFloat(e.target.value) || 0)}
                                    className="w-14 h-8 text-right"
                                  />
                                  <span className="text-xs text-muted-foreground hidden lg:inline">/ {product?.discountPercent || 0}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right hidden md:table-cell">
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={product?.extraDiscountPercent || 100}
                                    value={item.extraDiscount}
                                    onChange={(e) => updateOrderItem(index, "extraDiscount", parseFloat(e.target.value) || 0)}
                                    className="w-14 h-8 text-right"
                                  />
                                  <span className="text-xs text-muted-foreground hidden lg:inline">/ {product?.extraDiscountPercent || 0}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium hidden lg:table-cell">₹{sellingPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-bold text-orange-600">₹{prices.finalPrice.toFixed(2)}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeOrderItem(index)}
                                  className="hover:bg-red-100 dark:hover:bg-gray-800 h-8 w-8"
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Order Summary */}
              {orderItems.length > 0 && (
                <Card className="border-orange-200 dark:border-gray-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-800">
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm text-muted-foreground">Subtotal</p>
                        <p className="text-base sm:text-lg font-semibold">₹{orderTotals.subtotal.toFixed(2)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm text-muted-foreground">Admin Discount</p>
                        <p className="text-base sm:text-lg font-semibold text-green-600">-₹{orderTotals.adminDiscount.toFixed(2)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm text-muted-foreground">Extra Discount</p>
                        <p className="text-base sm:text-lg font-semibold text-green-600">-₹{orderTotals.extraDiscount.toFixed(2)}</p>
                      </div>
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <p className="text-xs sm:text-sm text-muted-foreground">Total Amount</p>
                        <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">₹{orderTotals.total.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              <div className="grid gap-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Any special instructions..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-6 pt-3 border-t gap-2 shrink-0 flex-wrap">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrder}
              disabled={creating || !selectedShopkeeper || orderItems.length === 0}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 flex-1 sm:flex-none min-w-32"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Create Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-6xl w-[95vw] max-w-[95vw] sm:w-auto sm:max-w-6xl h-[90vh] sm:h-[85vh] max-h-[95vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
            <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Edit className="h-5 w-5 text-orange-500" />
              Edit Order
            </DialogTitle>
            <DialogDescription>
              Update order details - Edit quantities, discounts, add or remove items
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-2">
              {/* Shopkeeper Selection */}
              <div className="grid gap-3">
                <Label className="text-base font-semibold">Select Shopkeeper *</Label>
                <Select value={editShopkeeper} onValueChange={setEditShopkeeper}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Choose a shopkeeper" />
                  </SelectTrigger>
                  <SelectContent>
                    {shopkeepers.map((sk) => (
                      <SelectItem key={sk.id} value={sk.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{sk.shopName}</span>
                          <span className="text-xs text-muted-foreground">{sk.ownerName} • {sk.mobile}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Add Product */}
              <div className="space-y-4">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4 text-green-500" />
                  Search & Add Products
                </Label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label>Search Product</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by product or category name..."
                        value={editProductSearch}
                        onChange={(e) => setEditProductSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <Label>Filter by Category</Label>
                    <Select value={editCategory || "all"} onValueChange={(value) => setEditCategory(value === "all" ? "" : value)}>
                      <SelectTrigger>
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
                </div>
                
                {/* Product List */}
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-800">
                  {products.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No products available.</p>
                  ) : filteredProductsForEdit.filter(p => !editItems.find(ei => ei.productId === p.id)).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">All matching products already added.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredProductsForEdit
                        .filter(p => !editItems.find(ei => ei.productId === p.id))
                        .map((product) => (
                          <div
                            key={product.id}
                            onClick={() => addEditItem(product.id)}
                            className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-green-50 dark:hover:bg-gray-600 cursor-pointer border border-green-200 dark:border-gray-600 hover:border-green-400 transition-colors"
                          >
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.category?.name} • {product.packingDetail}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600 dark:text-green-400">₹{product.productPrice.toFixed(2)}</p>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-green-600">
                                <Plus className="h-3 w-3 mr-1" /> Add
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Edit Items Table */}
              {editItems.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Order Items ({editItems.length})</Label>
                  
                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-2">
                    {editItems.map((item, index) => {
                      const product = products.find(p => p.id === item.productId)
                      const prices = calculateItemPrice(item)
                      
                      return (
                        <div key={item.productId} className="border rounded-lg p-3 bg-white dark:bg-gray-800 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.productName}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.packingDetail}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEditItem(index)}
                              className="h-8 w-8 shrink-0"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Price</p>
                              <p className="font-medium">₹{item.productPrice.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Qty</p>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateEditItem(index, "quantity", parseInt(e.target.value) || 1)}
                                className="w-full h-8 text-center"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Disc %</p>
                              <Input
                                type="number"
                                min="0"
                                max={product?.discountPercent || 100}
                                value={item.adminDiscount}
                                onChange={(e) => updateEditItem(index, "adminDiscount", parseFloat(e.target.value) || 0)}
                                className="w-full h-8 text-center"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Extra %</p>
                              <Input
                                type="number"
                                min="0"
                                max={product?.extraDiscountPercent || 100}
                                value={item.extraDiscount}
                                onChange={(e) => updateEditItem(index, "extraDiscount", parseFloat(e.target.value) || 0)}
                                className="w-full h-8 text-center"
                              />
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-sm text-muted-foreground">Amount</span>
                            <span className="font-bold text-orange-600">₹{prices.finalPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden sm:block border rounded-lg overflow-x-auto">
                    <Table className="text-sm">
                      <TableHeader>
                        <TableRow className="bg-orange-50 dark:bg-gray-800">
                          <TableHead className="font-semibold whitespace-nowrap">Product</TableHead>
                          <TableHead className="font-semibold whitespace-nowrap">Category</TableHead>
                          <TableHead className="font-semibold whitespace-nowrap">Packing</TableHead>
                          <TableHead className="text-right font-semibold whitespace-nowrap">Price</TableHead>
                          <TableHead className="text-center font-semibold whitespace-nowrap">Qty</TableHead>
                          <TableHead className="text-right font-semibold whitespace-nowrap">Disc %</TableHead>
                          <TableHead className="text-right font-semibold whitespace-nowrap">Extra %</TableHead>
                          <TableHead className="text-right font-semibold whitespace-nowrap">Amount</TableHead>
                          <TableHead className="text-center font-semibold text-red-500 whitespace-nowrap">Remove</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editItems.map((item, index) => {
                          const product = products.find(p => p.id === item.productId)
                          const prices = calculateItemPrice(item)
                          const sellingPrice = item.quantity > 0 ? prices.finalPrice / item.quantity : 0
                          
                          return (
                            <TableRow key={item.productId} className="hover:bg-orange-50/50 dark:hover:bg-gray-800/50">
                              <TableCell className="font-medium">{item.productName}</TableCell>
                              <TableCell>{item.categoryName}</TableCell>
                              <TableCell>{item.packingDetail}</TableCell>
                              <TableCell className="text-right">₹{item.productPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateEditItem(index, "quantity", parseInt(e.target.value) || 1)}
                                  className="w-16 h-8 text-center mx-auto border-orange-200 focus:border-orange-400"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={product?.discountPercent || 100}
                                    value={item.adminDiscount}
                                    onChange={(e) => updateEditItem(index, "adminDiscount", parseFloat(e.target.value) || 0)}
                                    className="w-16 h-8 text-right border-orange-200 focus:border-orange-400"
                                  />
                                  <span className="text-xs text-muted-foreground">/ {product?.discountPercent || 0}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={product?.extraDiscountPercent || 100}
                                    value={item.extraDiscount}
                                    onChange={(e) => updateEditItem(index, "extraDiscount", parseFloat(e.target.value) || 0)}
                                    className="w-16 h-8 text-right border-orange-200 focus:border-orange-400"
                                  />
                                  <span className="text-xs text-muted-foreground">/ {product?.extraDiscountPercent || 0}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-bold text-orange-600">₹{prices.finalPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeEditItem(index)}
                                  className="hover:bg-red-100 dark:hover:bg-red-900/30 h-8 w-8 border border-red-200"
                                  title="Remove this item from order"
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Edit Summary */}
              {editItems.length > 0 && (
                <Card className="border-orange-200 dark:border-gray-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-800">
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                      {(() => {
                        const editTotals = editItems.reduce((acc, item) => {
                          const prices = calculateItemPrice(item)
                          acc.subtotal += prices.basePrice
                          acc.adminDiscount += prices.adminDiscountAmount
                          acc.extraDiscount += prices.extraDiscountAmount
                          acc.total += prices.finalPrice
                          return acc
                        }, { subtotal: 0, adminDiscount: 0, extraDiscount: 0, total: 0 })
                        
                        return (
                          <>
                            <div className="space-y-1">
                              <p className="text-xs sm:text-sm text-muted-foreground">Subtotal</p>
                              <p className="text-base sm:text-lg font-semibold">₹{editTotals.subtotal.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs sm:text-sm text-muted-foreground">Admin Discount</p>
                              <p className="text-base sm:text-lg font-semibold text-green-600">-₹{editTotals.adminDiscount.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs sm:text-sm text-muted-foreground">Extra Discount</p>
                              <p className="text-base sm:text-lg font-semibold text-green-600">-₹{editTotals.extraDiscount.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1 col-span-2 sm:col-span-1">
                              <p className="text-xs sm:text-sm text-muted-foreground">Total Amount</p>
                              <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">₹{editTotals.total.toFixed(2)}</p>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Any special instructions..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-6 pt-3 border-t gap-2 shrink-0 flex-wrap">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setEditDialogOpen(false)
                if (selectedOrder) {
                  handleDeleteOrder(selectedOrder.id)
                }
              }}
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button
              onClick={handleEditOrder}
              disabled={creating || !editShopkeeper || editItems.length === 0}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 flex-1 sm:flex-none min-w-32"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Update Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-3xl w-[95vw] max-w-[95vw] sm:w-auto sm:max-w-3xl h-[90vh] sm:h-[85vh] max-h-[95vh] p-0 flex flex-col overflow-hidden">
          {selectedOrder && (
            <>
              <DialogHeader className="p-4 sm:p-6 pb-0 sm:pb-0 border-b sm:border-b-0 shrink-0">
                <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  Order {selectedOrder.orderId}
                  <Badge className={getStatusColor(selectedOrder.status)}>
                    {selectedOrder.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Created on {format(new Date(selectedOrder.createdAt), "dd MMMM yyyy 'at' hh:mm a")}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="space-y-4 p-4 sm:p-6 pt-4">
                  {/* Shopkeeper Info */}
                  <Card className="border-orange-100 dark:border-gray-800">
                    <CardContent className="p-4">
                      <p className="font-medium">{selectedOrder.shopkeeper.shopName}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedOrder.shopkeeper.ownerName} • {selectedOrder.shopkeeper.mobile}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Order By Info - Admin Only */}
                  {session?.user?.role === "ADMIN" && selectedOrder.user && (
                    <Card className="border-orange-100 dark:border-gray-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-orange-500" />
                          <div>
                            <p className="text-sm text-muted-foreground">Order Created By</p>
                            <p className="font-medium">{selectedOrder.user.name}</p>
                            {selectedOrder.user.email && (
                              <p className="text-sm text-muted-foreground">{selectedOrder.user.email}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Order Items - Editable for Admin and Sales (if pending) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Order Items</Label>
                      {/* Can edit if: Admin on any order, or Sales on pending order */}
                      {((session?.user?.role === "ADMIN") || 
                        (session?.user?.role === "SALES" && selectedOrder.status === "PENDING")) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            openEditDialog(selectedOrder)
                            setDetailsDialogOpen(false)
                          }}
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Items
                        </Button>
                      )}
                    </div>
                    
                    {/* Items Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-orange-50 dark:bg-gray-800">
                            <TableHead className="font-semibold">Product</TableHead>
                            <TableHead className="font-semibold text-center">Qty</TableHead>
                            <TableHead className="font-semibold text-right">Price</TableHead>
                            <TableHead className="font-semibold text-right">Disc%</TableHead>
                            <TableHead className="font-semibold text-right">Extra%</TableHead>
                            <TableHead className="font-semibold text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOrder.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{item.product.name}</p>
                                  <p className="text-xs text-muted-foreground">{item.product.packingDetail}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-medium">{item.quantity}</TableCell>
                              <TableCell className="text-right">₹{item.productPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{item.adminDiscount}%</TableCell>
                              <TableCell className="text-right">{item.extraDiscount}%</TableCell>
                              <TableCell className="text-right font-bold text-orange-600">₹{item.finalPrice.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Summary */}
                  <Card className="border-orange-200 dark:border-gray-800 bg-orange-50 dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span>₹{selectedOrder.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Admin Discount:</span>
                          <span>-₹{selectedOrder.adminDiscount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Extra Discount:</span>
                          <span>-₹{selectedOrder.extraDiscount.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total:</span>
                          <span className="text-orange-600 dark:text-orange-400">₹{selectedOrder.totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedOrder.notes && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Notes:</strong> {selectedOrder.notes}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2 shrink-0 p-4 sm:p-6 border-t">
                {/* Admin actions - can edit/delete ANY order EXCEPT DISPATCHED (only delete), approve/reject/dispatch */}
                {session?.user?.role === "ADMIN" && (
                  <>
                    {selectedOrder.status !== "DISPATCHED" && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          openEditDialog(selectedOrder)
                          setDetailsDialogOpen(false)
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Order
                      </Button>
                    )}
                    {selectedOrder.status === "PENDING" && (
                      <>
                        <Button
                          variant="outline"
                          className="border-red-500 text-red-500 hover:bg-red-50"
                          onClick={() => handleUpdateStatus(selectedOrder.id, "REJECTED")}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          className="bg-green-500 hover:bg-green-600"
                          onClick={() => handleUpdateStatus(selectedOrder.id, "APPROVED")}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                      </>
                    )}
                    {selectedOrder.status === "APPROVED" && (
                      <Button
                        className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                        onClick={() => handleUpdateStatus(selectedOrder.id, "DISPATCHED")}
                      >
                        <Truck className="mr-2 h-4 w-4" />
                        Mark Dispatched
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteOrder(selectedOrder.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </>
                )}
                {/* Sales user actions - can only edit/delete PENDING orders */}
                {session?.user?.role === "SALES" && selectedOrder.status === "PENDING" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        openEditDialog(selectedOrder)
                        setDetailsDialogOpen(false)
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Order
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteOrder(selectedOrder.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Order
                    </Button>
                  </>
                )}
                {/* Viewer actions - can only change order status (approve/reject/dispatch) */}
                {session?.user?.role === "VIEWER" && (
                  <>
                    {selectedOrder.status === "PENDING" && (
                      <>
                        <Button
                          variant="outline"
                          className="border-red-500 text-red-500 hover:bg-red-50"
                          onClick={() => handleUpdateStatus(selectedOrder.id, "REJECTED")}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          className="bg-green-500 hover:bg-green-600"
                          onClick={() => handleUpdateStatus(selectedOrder.id, "APPROVED")}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                      </>
                    )}
                    {selectedOrder.status === "APPROVED" && (
                      <Button
                        className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                        onClick={() => handleUpdateStatus(selectedOrder.id, "DISPATCHED")}
                      >
                        <Truck className="mr-2 h-4 w-4" />
                        Mark Dispatched
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
