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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Plus, CreditCard, Search, Trash2, IndianRupee, Phone, 
  AlertCircle, CheckCircle, TrendingUp, TrendingDown, User, Package,
  Calendar, Filter, X, Download
} from "lucide-react"
import { toast } from "sonner"
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns"
import * as XLSX from "xlsx"

interface Payment {
  id: string
  amount: number
  method: string
  transactionRef: string | null
  notes: string | null
  isAdvance: boolean
  createdAt: string
  user: {
    id: string
    name: string
    email: string
  }
  shopkeeper: {
    id: string
    shopName: string
    ownerName: string
    mobile: string
  } | null
  order: {
    id: string
    orderId: string
    totalAmount: number
  } | null
}

interface Shopkeeper {
  id: string
  shopName: string
  ownerName: string
  mobile: string
  city?: string | null
  outstanding?: {
    id: string
    totalOrders: number
    roundOff: number
    totalPaid: number
    balance: number
    lastUpdated: string
  } | null
}

interface Order {
  id: string
  orderId: string
  totalAmount: number
  createdAt: string
  shopkeeper: {
    id: string
    shopName: string
  }
}

interface OutstandingData {
  shopkeeperId: string
  shopkeeper: {
    id: string
    shopName: string
    ownerName: string
    mobile: string
  }
  totalOrders: number
  roundOff: number
  totalPaid: number
  balance: number
  lastUpdated: string
}

const initialFormState = {
  shopkeeperId: "",
  orderId: "",
  amount: "",
  method: "CASH" as "CASH" | "ONLINE" | "UPI",
  transactionRef: "",
  notes: "",
  isAdvance: false
}

type DateFilterType = "all" | "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "custom"

export function PaymentManagement() {
  const { data: session } = useSession()
  const [payments, setPayments] = useState<Payment[]>([])
  const [shopkeepers, setShopkeepers] = useState<Shopkeeper[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState(initialFormState)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [outstandingSearch, setOutstandingSearch] = useState("")
  
  // Order-wise outstanding dialog
  const [orderWiseDialogOpen, setOrderWiseDialogOpen] = useState(false)
  const [selectedShopkeeperForOrders, setSelectedShopkeeperForOrders] = useState<Shopkeeper | null>(null)
  const [quickPayOrderId, setQuickPayOrderId] = useState("")
  const [quickPayAmount, setQuickPayAmount] = useState("")
  const [quickPayDialogOpen, setQuickPayDialogOpen] = useState(false)
  const [quickPayMethod, setQuickPayMethod] = useState<"CASH" | "UPI" | "ONLINE">("CASH")
  
  // Date filter states
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all")
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [paymentsRes, shopkeepersRes, ordersRes] = await Promise.all([
        fetch("/api/payments", { credentials: 'include' }),
        fetch("/api/shopkeepers", { credentials: 'include' }),
        fetch("/api/orders?status=DISPATCHED", { credentials: 'include' })
      ])

      if (paymentsRes.ok) setPayments(await paymentsRes.json())
      if (shopkeepersRes.ok) {
        const skData = await shopkeepersRes.json()
        setShopkeepers(skData)
      }
      if (ordersRes.ok) setOrders(await ordersRes.json())
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    if (!formData.shopkeeperId) {
      toast.error("Please select a shopkeeper")
      return
    }

    if (!formData.isAdvance && !formData.orderId) {
      toast.error("Please select an order for order payment")
      return
    }

    setSaving(true)

    try {
      const body = {
        shopkeeperId: formData.shopkeeperId,
        orderId: formData.isAdvance ? null : formData.orderId,
        amount: parseFloat(formData.amount),
        method: formData.method,
        transactionRef: formData.transactionRef || null,
        notes: formData.notes || null,
        isAdvance: formData.isAdvance
      }

      const res = await fetch("/api/payments", {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        toast.success(formData.isAdvance ? "Advance payment recorded successfully" : "Payment recorded successfully")
        fetchData()
        setDialogOpen(false)
        setFormData(initialFormState)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to record payment")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) return
    
    try {
      const res = await fetch(`/api/payments?id=${id}`, { 
        method: "DELETE",
        credentials: 'include'
      })
      if (res.ok) {
        toast.success("Payment deleted successfully")
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete payment")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  // Open order-wise outstanding dialog
  const openOrderWiseDialog = (shopkeeper: Shopkeeper) => {
    setSelectedShopkeeperForOrders(shopkeeper)
    setOrderWiseDialogOpen(true)
  }

  // Get orders for selected shopkeeper with payment status
  const getShopkeeperOrders = (shopkeeperId: string) => {
    return orders
      .filter(o => o.shopkeeper.id === shopkeeperId)
      .map(order => {
        const orderPayments = payments
          .filter(p => p.order?.id === order.id)
          .reduce((sum, p) => sum + p.amount, 0)
        const grandTotal = Math.round(order.totalAmount)
        const outstanding = grandTotal - orderPayments
        return {
          ...order,
          grandTotal,
          paid: orderPayments,
          outstanding
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  // Open quick pay dialog
  const openQuickPay = (orderId: string, amount: number) => {
    setQuickPayOrderId(orderId)
    setQuickPayAmount(amount.toString())
    setQuickPayMethod("CASH")
    setQuickPayDialogOpen(true)
  }

  // Handle quick payment
  const handleQuickPay = async () => {
    if (!quickPayAmount || parseFloat(quickPayAmount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    const order = orders.find(o => o.id === quickPayOrderId)
    if (!order) return

    setSaving(true)
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopkeeperId: order.shopkeeper.id,
          orderId: quickPayOrderId,
          amount: parseFloat(quickPayAmount),
          method: quickPayMethod,
          isAdvance: false
        })
      })

      if (res.ok) {
        toast.success("Payment recorded successfully")
        fetchData()
        setQuickPayDialogOpen(false)
        setQuickPayAmount("")
        setQuickPayOrderId("")
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to record payment")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case "CASH": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "ONLINE": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "UPI": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      default: return ""
    }
  }

  // Get date range based on filter type
  const getDateRange = (filter: DateFilterType) => {
    const now = new Date()
    switch (filter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) }
      case "yesterday":
        const yesterday = subDays(now, 1)
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) }
      case "this_week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
      case "last_week":
        const lastWeek = subWeeks(now, 1)
        return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) }
      case "this_month":
        return { start: startOfMonth(now), end: endOfMonth(now) }
      case "last_month":
        const lastMonth = subMonths(now, 1)
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
      case "custom":
        if (customDateFrom && customDateTo) {
          return { 
            start: startOfDay(new Date(customDateFrom)), 
            end: endOfDay(new Date(customDateTo)) 
          }
        }
        return null
      default:
        return null
    }
  }

  // Filter payments by date and search
  const filteredPayments = payments.filter(payment => {
    // Date filter
    if (dateFilter !== "all") {
      const range = getDateRange(dateFilter)
      if (range) {
        const paymentDate = new Date(payment.createdAt)
        if (paymentDate < range.start || paymentDate > range.end) {
          return false
        }
      }
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = 
        payment.shopkeeper?.shopName.toLowerCase().includes(searchLower) ||
        payment.user.name.toLowerCase().includes(searchLower) ||
        payment.transactionRef?.toLowerCase().includes(searchLower) ||
        payment.order?.orderId.toLowerCase().includes(searchLower) ||
        payment.shopkeeper?.mobile.includes(searchTerm)
      
      if (!matchesSearch) return false
    }

    return true
  })

  // Calculate totals based on filtered payments
  const totalFilteredPayments = filteredPayments.reduce((sum, p) => sum + p.amount, 0)
  
  // Separate advance and order payments
  const advancePayments = filteredPayments.filter(p => p.isAdvance)
  const orderPayments = filteredPayments.filter(p => !p.isAdvance)
  
  const totalAdvancePayments = advancePayments.reduce((sum, p) => sum + p.amount, 0)
  const totalOrderPayments = orderPayments.reduce((sum, p) => sum + p.amount, 0)

  // Calculate outstanding data
  const outstandingData: OutstandingData[] = shopkeepers
    .filter(sk => sk.outstanding)
    .map(sk => {
      const grandTotal = Math.round((sk.outstanding?.totalOrders || 0) + (sk.outstanding?.roundOff || 0))
      const totalPaid = sk.outstanding?.totalPaid || 0
      const outstanding = grandTotal - totalPaid
      return {
        shopkeeperId: sk.id,
        shopkeeper: {
          id: sk.id,
          shopName: sk.shopName,
          ownerName: sk.ownerName,
          mobile: sk.mobile
        },
        totalOrders: sk.outstanding?.totalOrders || 0,
        roundOff: sk.outstanding?.roundOff || 0,
        totalPaid: totalPaid,
        balance: outstanding,
        lastUpdated: sk.outstanding?.lastUpdated || new Date().toISOString()
      }
    })
    .filter(o => o.balance !== 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

  const totalOutstanding = outstandingData
    .filter(o => o.balance > 0)
    .reduce((sum, o) => sum + o.balance, 0)
  
  const totalAdvance = outstandingData
    .filter(o => o.balance < 0)
    .reduce((sum, o) => sum + Math.abs(o.balance), 0)

  const filteredOutstanding = outstandingData.filter(o =>
    o.shopkeeper.shopName.toLowerCase().includes(outstandingSearch.toLowerCase()) ||
    o.shopkeeper.ownerName.toLowerCase().includes(outstandingSearch.toLowerCase()) ||
    o.shopkeeper.mobile.includes(outstandingSearch)
  )

  // Export payments to Excel
  const exportPaymentsToExcel = () => {
    if (filteredPayments.length === 0) {
      toast.error("No payments to export")
      return
    }

    const headers = [
      "Date", "Time", "Type", "Shop Name", "Owner", "Mobile", 
      "Order ID", "Advance", "Total Amount", "Grand Total", "Outstanding", "Method", "Reference", "Notes", "Recorded By"
    ]
    
    const rows = filteredPayments.map(p => {
      const grandTotal = p.order?.totalAmount ? Math.round(p.order.totalAmount) : 0
      const outstanding = p.order?.totalAmount ? grandTotal - p.amount : 0
      return [
        format(new Date(p.createdAt), "dd/MM/yyyy"),
        format(new Date(p.createdAt), "HH:mm"),
        p.isAdvance ? "Advance" : "Order Payment",
        p.shopkeeper?.shopName || "N/A",
        p.shopkeeper?.ownerName || "",
        p.shopkeeper?.mobile || "",
        p.order?.orderId || "",
        p.amount,
        p.order?.totalAmount || "",
        grandTotal,
        outstanding,
        p.method,
        p.transactionRef || "",
        p.notes || "",
        p.user?.name || ""
      ]
    })

    const worksheetData = [headers, ...rows]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    
    // Set column widths
    worksheet['!cols'] = headers.map((_, i) => ({
      wch: Math.max(...worksheetData.map(row => String(row[i] || "").length)) + 2
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, worksheet, "Payments")
    XLSX.writeFile(wb, `payments_${format(new Date(), "yyyy-MM-dd")}.xlsx`)
    toast.success("Payments exported to Excel")
  }

  // Export outstanding to Excel
  const exportOutstandingToExcel = () => {
    if (filteredOutstanding.length === 0) {
      toast.error("No outstanding data to export")
      return
    }

    const headers = [
      "Shop Name", "Owner Name", "Mobile", "Total Orders", "Grand Total", "Total Paid", "Outstanding", "Last Updated"
    ]
    
    const rows = filteredOutstanding.map(o => {
      const grandTotal = Math.round(o.totalOrders + o.roundOff)
      const outstanding = grandTotal - o.totalPaid
      return [
        o.shopkeeper.shopName,
        o.shopkeeper.ownerName,
        o.shopkeeper.mobile,
        o.totalOrders,
        grandTotal,
        o.totalPaid,
        outstanding,
        format(new Date(o.lastUpdated), "dd/MM/yyyy")
      ]
    })

    const worksheetData = [headers, ...rows]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    
    worksheet['!cols'] = headers.map((_, i) => ({
      wch: Math.max(...worksheetData.map(row => String(row[i] || "").length)) + 2
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, worksheet, "Outstanding")
    XLSX.writeFile(wb, `outstanding_${format(new Date(), "yyyy-MM-dd")}.xlsx`)
    toast.success("Outstanding exported to Excel")
  }

  // Get selected shopkeeper's outstanding
  const selectedShopkeeperData = shopkeepers.find(sk => sk.id === formData.shopkeeperId)
  const selectedOrderData = orders.find(o => o.id === formData.orderId)

  // When order is selected, auto-fill shopkeeper
  const handleOrderSelect = (orderId: string) => {
    setFormData(prev => {
      if (orderId) {
        const order = orders.find(o => o.id === orderId)
        if (order) {
          return {
            ...prev,
            orderId,
            shopkeeperId: order.shopkeeper.id
          }
        }
      }
      return { ...prev, orderId }
    })
  }

  // Clear date filter
  const clearDateFilter = () => {
    setDateFilter("all")
    setCustomDateFrom("")
    setCustomDateTo("")
  }

  // Get date filter label
  const getDateFilterLabel = (filter: DateFilterType) => {
    switch (filter) {
      case "today": return "Today"
      case "yesterday": return "Yesterday"
      case "this_week": return "This Week"
      case "last_week": return "Last Week"
      case "this_month": return "This Month"
      case "last_month": return "Last Month"
      case "custom": return "Custom Range"
      default: return "All Time"
    }
  }

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
            Payments
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Track payments and outstanding balances</p>
        </div>

        {session?.user?.role !== "VIEWER" && (
          <div className="flex flex-wrap gap-2">
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) setFormData(initialFormState)
            }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-lg w-[95vw] max-w-[95vw] sm:w-auto sm:max-w-lg max-h-[85vh] flex flex-col p-0">
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
                  <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <CreditCard className="h-5 w-5 text-orange-500" />
                    Record Payment
                  </DialogTitle>
                  <DialogDescription>
                    Add a new payment entry for orders or advance payments
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 custom-scrollbar">
                  <div className="grid gap-3 py-4">
                  {/* Payment Type Selection */}
                  <div className="grid gap-2">
                    <Label className="text-base font-semibold">Payment Type</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentType"
                          checked={!formData.isAdvance}
                          onChange={() => setFormData({ ...formData, isAdvance: false, orderId: "" })}
                          className="h-4 w-4 text-orange-500"
                        />
                        <span>Order Payment</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentType"
                          checked={formData.isAdvance}
                          onChange={() => setFormData({ ...formData, isAdvance: true, orderId: "" })}
                          className="h-4 w-4 text-orange-500"
                        />
                        <span className="text-green-600 font-medium">Advance Payment</span>
                      </label>
                    </div>
                  </div>

                  <Separator />

                  {/* Order Selection - Only for Order Payment */}
                  {!formData.isAdvance && (
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-orange-500" />
                        Link to Order *
                      </Label>
                      <Select 
                        value={formData.orderId} 
                        onValueChange={handleOrderSelect}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select Order ID to link payment" />
                        </SelectTrigger>
                        <SelectContent>
                          {orders.map((order) => (
                            <SelectItem key={order.id} value={order.id}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono font-semibold text-orange-600 border-orange-300">
                                  {order.orderId}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {order.shopkeeper.shopName}
                                </span>
                                <span className="font-bold text-orange-600">
                                  ₹{order.totalAmount.toFixed(2)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedOrderData && (
                        <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200">
                          <CardContent className="p-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono">
                                  {selectedOrderData.orderId}
                                </Badge>
                                <span className="font-bold text-orange-600">
                                  ₹{selectedOrderData.totalAmount.toFixed(2)}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {selectedOrderData.shopkeeper.shopName}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Shopkeeper Selection */}
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4 text-orange-500" />
                      Select Shopkeeper *
                      {!formData.isAdvance && formData.orderId && (
                        <Badge variant="secondary" className="text-xs ml-2">
                          Auto-filled from order
                        </Badge>
                      )}
                    </Label>
                    
                    {/* For Order Payment - Shopkeeper is locked based on order */}
                    {!formData.isAdvance && formData.orderId ? (
                      <div className="p-3 rounded-lg border bg-muted/50">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-orange-500" />
                          <span className="font-medium">{selectedShopkeeperData?.shopName}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">{selectedShopkeeperData?.ownerName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Phone className="h-3 w-3" />
                          {selectedShopkeeperData?.mobile}
                        </div>
                      </div>
                    ) : (
                      /* For Advance Payment - User selects shopkeeper */
                      <Select 
                        value={formData.shopkeeperId} 
                        onValueChange={(value) => setFormData({ ...formData, shopkeeperId: value })}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Choose shopkeeper" />
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
                    )}
                    
                    {/* Show Balance Card for selected shopkeeper */}
                    {selectedShopkeeperData && (
                      <Card className={`${selectedShopkeeperData.outstanding && selectedShopkeeperData.outstanding.balance > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : selectedShopkeeperData.outstanding && selectedShopkeeperData.outstanding.balance < 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'}`}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <IndianRupee className={`h-5 w-5 ${selectedShopkeeperData.outstanding && selectedShopkeeperData.outstanding.balance > 0 ? 'text-red-500' : selectedShopkeeperData.outstanding && selectedShopkeeperData.outstanding.balance < 0 ? 'text-green-500' : 'text-gray-500'}`} />
                              <div>
                                <p className="text-xs text-muted-foreground">Current Balance</p>
                                <p className={`text-lg font-bold ${selectedShopkeeperData.outstanding && selectedShopkeeperData.outstanding.balance > 0 ? 'text-red-600 dark:text-red-400' : selectedShopkeeperData.outstanding && selectedShopkeeperData.outstanding.balance < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                  ₹{selectedShopkeeperData.outstanding ? Math.abs(selectedShopkeeperData.outstanding.balance).toFixed(2) : '0.00'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {selectedShopkeeperData.outstanding && selectedShopkeeperData.outstanding.balance > 0 ? (
                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Amount Due
                                </Badge>
                              ) : selectedShopkeeperData.outstanding && selectedShopkeeperData.outstanding.balance < 0 ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                  Advance
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  No Balance
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Amount and Method */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Amount (₹) *</Label>
                      <Input
                        id="amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                        placeholder="Enter amount"
                        className="h-11"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Method *</Label>
                      <Select 
                        value={formData.method} 
                        onValueChange={(value: "CASH" | "ONLINE" | "UPI") => setFormData({ ...formData, method: value })}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">💵 Cash</SelectItem>
                          <SelectItem value="UPI">📱 UPI</SelectItem>
                          <SelectItem value="ONLINE">💳 Online</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Transaction Reference for UPI/Online */}
                  {(formData.method === "ONLINE" || formData.method === "UPI") && (
                    <div className="grid gap-2">
                      <Label htmlFor="transactionRef">Transaction Reference</Label>
                      <Input
                        id="transactionRef"
                        value={formData.transactionRef}
                        onChange={(e) => setFormData({ ...formData, transactionRef: e.target.value })}
                        placeholder="UTR/Transaction ID"
                        className="font-mono"
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any additional notes"
                    />
                  </div>

                  {/* Advance Payment Info */}
                  {formData.isAdvance && (
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-700 dark:text-green-400">
                        <strong>Advance Payment:</strong> This payment will be recorded as an advance and will be adjusted against future orders.
                      </p>
                    </div>
                  )}
                </div>
                </div>
                <DialogFooter className="p-6 pt-3 border-t gap-2 shrink-0">
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={saving || !formData.amount || parseFloat(formData.amount) <= 0 || (!formData.isAdvance && !formData.orderId) || !formData.shopkeeperId} 
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                  >
                    {saving ? "Recording..." : formData.isAdvance ? "Record Advance Payment" : "Record Payment"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          {(session?.user?.role === "ADMIN" || session?.user?.canExport === true) && (
            <Button variant="outline" onClick={exportPaymentsToExcel} className="gap-2">
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4 shrink-0">
        <Card className="border-orange-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Payments</CardTitle>
            <IndianRupee className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
              ₹{totalFilteredPayments.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredPayments.length} payment(s) {dateFilter !== 'all' ? 'in selected period' : 'recorded'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-gray-800 bg-green-50/50 dark:bg-green-900/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-400">Advance Payments</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
              ₹{totalAdvancePayments.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
              {advancePayments.length} advance payment(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-gray-800 bg-red-50/50 dark:bg-red-900/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-red-700 dark:text-red-400">Total Outstanding</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">
              ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
              {outstandingData.filter(o => o.balance > 0).length} shopkeeper(s) with dues
            </p>
          </CardContent>
        </Card>

        <Card className={`border-2 ${totalOutstanding - totalAdvance > 0 ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' : totalOutstanding - totalAdvance < 0 ? 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/10'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
            <CardTitle className={`text-xs sm:text-sm font-medium ${totalOutstanding - totalAdvance > 0 ? 'text-red-700 dark:text-red-400' : totalOutstanding - totalAdvance < 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-400'}`}>
              Net Balance
            </CardTitle>
            {totalOutstanding - totalAdvance > 0 ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : totalOutstanding - totalAdvance < 0 ? (
              <TrendingDown className="h-4 w-4 text-green-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-gray-500" />
            )}
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className={`text-lg sm:text-2xl font-bold ${totalOutstanding - totalAdvance > 0 ? 'text-red-600 dark:text-red-400' : totalOutstanding - totalAdvance < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
              ₹{Math.abs(totalOutstanding - totalAdvance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className={`text-xs mt-1 ${totalOutstanding - totalAdvance > 0 ? 'text-red-600/70 dark:text-red-400/70' : totalOutstanding - totalAdvance < 0 ? 'text-green-600/70 dark:text-green-400/70' : 'text-gray-600/70 dark:text-gray-400/70'}`}>
              {totalOutstanding - totalAdvance > 0 ? 'Amount to Collect' : totalOutstanding - totalAdvance < 0 ? 'Excess Advance' : 'All Settled'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Payments and Outstanding */}
      <Tabs defaultValue="payments" className="space-y-4 flex-1 min-h-0 flex flex-col">
        <TabsList className="bg-orange-100 dark:bg-gray-800 shrink-0">
          <TabsTrigger value="payments" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs sm:text-sm">
            Payment History ({filteredPayments.length})
          </TabsTrigger>
          <TabsTrigger value="outstanding" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs sm:text-sm">
            Outstanding ({outstandingData.length})
          </TabsTrigger>
        </TabsList>

        {/* Payments Tab */}
        <TabsContent value="payments" className="flex-1 min-h-0 flex flex-col space-y-4 mt-0">
          {/* Search and Date Filter */}
          <Card className="border-orange-200 dark:border-gray-800 shrink-0">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-col gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by shopkeeper, order ID, reference..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-10 sm:h-11"
                  />
                </div>

                {/* Date Filter */}
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={dateFilter} onValueChange={(value: DateFilterType) => setDateFilter(value)}>
                    <SelectTrigger className="w-full sm:w-[150px] h-10 sm:h-11">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="last_week">Last Week</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Custom Date Range */}
                  {dateFilter === "custom" && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Input
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                        className="flex-1 sm:w-[140px] h-10 sm:h-11"
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                        className="flex-1 sm:w-[140px] h-10 sm:h-11"
                      />
                    </div>
                  )}

                  {/* Clear Filter Button */}
                  {dateFilter !== "all" && (
                    <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-10 sm:h-9">
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Active Filter Badge */}
              {dateFilter !== "all" && (
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                    <Calendar className="h-3 w-3 mr-1" />
                    {getDateFilterLabel(dateFilter)}
                    {dateFilter === "custom" && customDateFrom && customDateTo && (
                      <span className="ml-1">
                        ({format(new Date(customDateFrom), "dd MMM")} - {format(new Date(customDateTo), "dd MMM")})
                      </span>
                    )}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payments List */}
          <Card className="border-orange-200 dark:border-gray-800 flex-1 min-h-0 flex flex-col">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-orange-500" />
                Payment History
              </CardTitle>
              <CardDescription>
                {filteredPayments.length} payment{filteredPayments.length !== 1 ? "s" : ""} found
                {dateFilter !== "all" && ` for ${getDateFilterLabel(dateFilter).toLowerCase()}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
              {/* Mobile scroll hint */}
              <div className="md:hidden text-xs text-muted-foreground text-center py-1 bg-orange-50 dark:bg-gray-800 border-b shrink-0">
                ← Swipe to scroll →
              </div>
              <div className="overflow-auto flex-1 -mx-3 sm:mx-0">
                  <Table className="text-sm min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Date</TableHead>
                        <TableHead className="whitespace-nowrap">Type</TableHead>
                        <TableHead className="whitespace-nowrap">Shopkeeper</TableHead>
                        <TableHead className="whitespace-nowrap">Order ID</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Advance</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Total Amount</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Grand Total</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Outstanding</TableHead>
                        <TableHead className="whitespace-nowrap">Method</TableHead>
                        <TableHead className="whitespace-nowrap">Reference</TableHead>
                        <TableHead className="whitespace-nowrap">Recorded By</TableHead>
                        {session?.user?.role === "ADMIN" && (
                          <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => {
                      // Get current outstanding for this shopkeeper
                      const shopkeeperOutstanding = shopkeepers.find(sk => sk.id === payment.shopkeeper?.id)?.outstanding
                      
                      return (
                        <TableRow key={payment.id} className={payment.isAdvance ? 'bg-green-50/30 dark:bg-green-900/10' : ''}>
                          <TableCell className="text-muted-foreground">
                            <div className="flex flex-col">
                              <span>{format(new Date(payment.createdAt), "dd MMM yyyy")}</span>
                              <span className="text-xs">{format(new Date(payment.createdAt), "hh:mm a")}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {payment.isAdvance ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Advance
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300">
                                <Package className="h-3 w-3 mr-1" />
                                Order
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {payment.shopkeeper ? (
                              <div>
                                <p className="font-medium">{payment.shopkeeper.shopName}</p>
                                <p className="text-sm text-muted-foreground">{payment.shopkeeper.ownerName}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {payment.shopkeeper.mobile}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {payment.isAdvance ? (
                              // Advance payment - check if linked to order
                              payment.order ? (
                                // Advance payment linked to an order after dispatch
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300">
                                      <TrendingDown className="h-3 w-3 mr-1" />
                                      Advance
                                    </Badge>
                                    <Badge variant="outline" className="font-mono font-semibold text-orange-600 border-orange-300">
                                      {payment.order.orderId}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Order Total: ₹{payment.order.totalAmount?.toFixed(2) || '-'}
                                  </p>
                                  <p className="text-xs text-green-600">
                                    Adjusted against order
                                  </p>
                                </div>
                              ) : (
                                // Advance payment not yet linked to any order
                                <div className="flex flex-col gap-1">
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    Advance Payment
                                  </Badge>
                                  <p className="text-xs text-muted-foreground">
                                    Against future orders
                                  </p>
                                </div>
                              )
                            ) : payment.order ? (
                              // Regular order payment
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-orange-500" />
                                  <Badge variant="outline" className="font-mono font-semibold text-orange-600 border-orange-300">
                                    {payment.order.orderId}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Order Total: ₹{payment.order.totalAmount?.toFixed(2) || '-'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="font-medium text-green-600 dark:text-green-400">
                              ₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            {payment.order ? (
                              <p className="font-medium text-orange-600 dark:text-orange-400">
                                ₹{payment.order.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}
                              </p>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {payment.order && payment.order.totalAmount ? (
                              <p className="font-medium text-blue-600 dark:text-blue-400">
                                ₹{Math.round(payment.order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {payment.order && payment.order.totalAmount ? (
                              (() => {
                                const grandTotal = Math.round(payment.order.totalAmount)
                                const outstanding = grandTotal - payment.amount
                                return (
                                  <p className={`font-medium ${outstanding > 0 ? 'text-red-600 dark:text-red-400' : outstanding < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    ₹{Math.abs(outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                )
                              })()
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={getMethodColor(payment.method)}>
                              {payment.method}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {payment.transactionRef || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {payment.user.name}
                            </div>
                          </TableCell>
                          {session?.user?.role === "ADMIN" && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(payment.id)}
                                className="hover:bg-red-100 dark:hover:bg-gray-800"
                                title="Delete Payment"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                    {filteredPayments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={session?.user?.role === "ADMIN" ? 12 : 11} className="text-center text-muted-foreground py-8">
                          <div className="flex flex-col items-center gap-2">
                            <CreditCard className="h-8 w-8 text-muted-foreground" />
                            <p>No payments found</p>
                            {dateFilter !== "all" && (
                              <p className="text-sm">Try changing the date filter</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outstanding Tab */}
        <TabsContent value="outstanding" className="flex-1 min-h-0 flex flex-col space-y-4 mt-0">
          {/* Search */}
          <Card className="border-orange-200 dark:border-gray-800 shrink-0">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search shopkeepers..."
                  value={outstandingSearch}
                  onChange={(e) => setOutstandingSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          {/* Outstanding List */}
          <Card className="border-orange-200 dark:border-gray-800 flex-1 min-h-0 flex flex-col">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Outstanding Balances
              </CardTitle>
              <CardDescription>
                {filteredOutstanding.length} shopkeeper{filteredOutstanding.length !== 1 ? "s" : ""} with outstanding balances
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              {/* Mobile scroll hint */}
              <div className="md:hidden text-xs text-muted-foreground text-center py-1 bg-orange-50 dark:bg-gray-800 border-b shrink-0">
                ← Swipe to scroll →
              </div>
              <div className="overflow-auto flex-1 p-4 sm:p-6 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shopkeeper</TableHead>
                      <TableHead className="text-right">Total Orders</TableHead>
                      <TableHead className="text-right">Grand Total</TableHead>
                      <TableHead className="text-right">Total Paid</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOutstanding.map((item) => {
                      const grandTotal = Math.round(item.totalOrders + item.roundOff)
                      const outstanding = grandTotal - item.totalPaid
                      const sk = shopkeepers.find(s => s.id === item.shopkeeperId)
                      return (
                      <TableRow key={item.shopkeeperId} className={outstanding > 0 ? 'bg-red-50/50 dark:bg-red-900/10' : outstanding < 0 ? 'bg-green-50/50 dark:bg-green-900/10' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.shopkeeper.shopName}</p>
                            <p className="text-sm text-muted-foreground">{item.shopkeeper.ownerName}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {item.shopkeeper.mobile}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{item.totalOrders.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-600">
                          ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          ₹{item.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${outstanding > 0 ? 'text-red-600 dark:text-red-400' : outstanding < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600'}`}>
                            {outstanding > 0 ? '-' : outstanding < 0 ? '+' : ''}₹{Math.abs(outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <p className={`text-xs ${outstanding > 0 ? 'text-red-500' : outstanding < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                            {outstanding > 0 ? 'Amount Due' : outstanding < 0 ? 'Advance' : 'Settled'}
                          </p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(item.lastUpdated), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sk && openOrderWiseDialog(sk)}
                            className="h-8 text-orange-600 hover:bg-orange-100"
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Orders
                          </Button>
                        </TableCell>
                      </TableRow>
                      )
                    })}
                    {filteredOutstanding.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          <div className="flex flex-col items-center gap-2">
                            <CheckCircle className="h-8 w-8 text-green-500" />
                            <p>No outstanding balances</p>
                            <p className="text-sm">All shopkeepers are up to date!</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order-wise Outstanding Dialog */}
      <Dialog open={orderWiseDialogOpen} onOpenChange={setOrderWiseDialogOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw] max-w-[95vw] sm:w-auto max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" />
              Order-wise Outstanding
            </DialogTitle>
            <DialogDescription>
              {selectedShopkeeperForOrders?.shopName} - {selectedShopkeeperForOrders?.ownerName}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-4 sm:px-6 py-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead className="text-right">Grand Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Date</TableHead>
                  {session?.user?.role !== "VIEWER" && (
                    <TableHead className="text-right">Action</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedShopkeeperForOrders && getShopkeeperOrders(selectedShopkeeperForOrders.id).map((order) => (
                  <TableRow key={order.id} className={order.outstanding > 0 ? 'bg-red-50/50 dark:bg-red-900/10' : order.outstanding < 0 ? 'bg-green-50/50 dark:bg-green-900/10' : ''}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono font-semibold text-orange-600 border-orange-300">
                        {order.orderId}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-blue-600">
                      ₹{order.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ₹{order.paid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold ${order.outstanding > 0 ? 'text-red-600' : order.outstanding < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        {order.outstanding > 0 ? '-' : order.outstanding < 0 ? '+' : ''}₹{Math.abs(order.outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(order.createdAt), "dd MMM yyyy")}
                    </TableCell>
                    {session?.user?.role !== "VIEWER" && (
                      <TableCell className="text-right">
                        {order.outstanding > 0 ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setOrderWiseDialogOpen(false)
                              openQuickPay(order.id, order.outstanding)
                            }}
                            className="bg-green-500 hover:bg-green-600 h-8"
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Pay Now
                          </Button>
                        ) : order.outstanding === 0 ? (
                          <Badge className="bg-green-100 text-green-800">Paid</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800">Advance</Badge>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {selectedShopkeeperForOrders && getShopkeeperOrders(selectedShopkeeperForOrders.id).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={session?.user?.role !== "VIEWER" ? 6 : 5} className="text-center text-muted-foreground py-8">
                      No orders found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="p-4 sm:p-6 border-t shrink-0">
            <Button variant="outline" onClick={() => setOrderWiseDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Pay Dialog */}
      <Dialog open={quickPayDialogOpen} onOpenChange={setQuickPayDialogOpen}>
        <DialogContent className="sm:max-w-md w-[95vw] max-w-[95vw] sm:w-auto p-0">
          <DialogHeader className="p-4 sm:p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-500" />
              Quick Payment
            </DialogTitle>
            <DialogDescription>
              Record payment for order
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 sm:px-6 py-4 space-y-4">
            <div className="grid gap-2">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={quickPayAmount}
                onChange={(e) => setQuickPayAmount(e.target.value)}
                placeholder="Enter amount"
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label>Payment Method *</Label>
              <Select value={quickPayMethod} onValueChange={(value: "CASH" | "UPI" | "ONLINE") => setQuickPayMethod(value)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">💵 Cash</SelectItem>
                  <SelectItem value="UPI">📱 UPI</SelectItem>
                  <SelectItem value="ONLINE">💳 Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-4 sm:p-6 border-t gap-2">
            <Button variant="outline" onClick={() => setQuickPayDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleQuickPay} 
              disabled={saving || !quickPayAmount || parseFloat(quickPayAmount) <= 0}
              className="bg-green-500 hover:bg-green-600"
            >
              {saving ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
