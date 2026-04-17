'use client'

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileText, Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import * as XLSX from "xlsx"

// Admin can see all reports
const ADMIN_REPORT_TYPES = [
  { value: "orders", label: "Orders Report (User/Date/Status Wise)" },
  { value: "payments", label: "Payments Report (with Outstanding)" },
  { value: "products", label: "Products Report" },
  { value: "users", label: "Users Report" },
  { value: "outstanding", label: "Outstanding Report" },
]

// Sales users can see their own reports
const SALES_REPORT_TYPES = [
  { value: "orders", label: "My Orders Report" },
  { value: "payments", label: "My Payments Report" },
  { value: "outstanding", label: "My Outstanding Report" },
]

export function ReportsExport() {
  const { data: session, status: sessionStatus } = useSession()
  const [reportType, setReportType] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [userFilter, setUserFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<unknown[] | null>(null)
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])

  // Get report types based on role
  const reportTypes = useMemo(() => {
    return session?.user?.role === "ADMIN" ? ADMIN_REPORT_TYPES : SALES_REPORT_TYPES
  }, [session?.user?.role])

  // Fetch users for admin filter
  useEffect(() => {
    if (session?.user?.role === "ADMIN") {
      fetch("/api/users", { credentials: "include" })
        .then(res => res.json())
        .then(result => {
          if (Array.isArray(result)) {
            setUsers(result.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })))
          }
        })
        .catch(() => {})
    }
  }, [session?.user?.role])

  // Set default report type when session is loaded
  useEffect(() => {
    if (sessionStatus === "authenticated" && !reportType && reportTypes.length > 0) {
      setReportType(reportTypes[0].value)
    }
  }, [sessionStatus, reportType, reportTypes])

  const generateReport = async () => {
    if (!reportType) {
      toast.error("Please select a report type")
      return
    }
    
    setLoading(true)
    setData(null)
    try {
      const params = new URLSearchParams({
        type: reportType,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(statusFilter && { status: statusFilter }),
        ...(userFilter && { userId: userFilter })
      })

      const res = await fetch(`/api/reports?${params}`, { credentials: 'include' })
      if (res.ok) {
        const result = await res.json()
        setData(result.data)
        toast.success(`Report generated: ${result.data?.length || 0} records found`)
      } else {
        const errorData = await res.json()
        toast.error(errorData.error || "Failed to generate report")
      }
    } catch (error) {
      console.error("Report error:", error)
      toast.error("An error occurred while generating report")
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    if (!data || data.length === 0) {
      toast.error("No data to export")
      return
    }

    try {
      const worksheetData = prepareExcelData(data, reportType)
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_array(worksheetData)
      
      // Create worksheet from array of arrays
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
      
      // Set column widths
      const colWidths = worksheetData[0].map((_, i) => {
        const maxLen = Math.max(...worksheetData.map(row => String(row[i] || "").length))
        return { wch: Math.min(Math.max(maxLen + 2, 10), 50) }
      })
      worksheet['!cols'] = colWidths

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, worksheet, "Report")

      // Generate filename
      const filename = `${reportType}_report_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`

      // Download file
      XLSX.writeFile(wb, filename)
      toast.success("Excel file downloaded successfully")
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export Excel file")
    }
  }

  const prepareExcelData = (data: unknown[], type: string): unknown[][] => {
    let headers: string[] = []
    let rows: unknown[][] = []

    if (type === "orders") {
      const orders = data as Array<{
        orderId: string
        status: string
        subtotal: number
        adminDiscount: number
        extraDiscount: number
        totalAmount: number
        createdAt: string
        shopkeeper: { shopName: string; ownerName: string; mobile: string; city?: string }
        user: { name: string; email: string }
        items: Array<{ product: { name: string }; quantity: number; finalPrice: number }>
      }>
      headers = ["Order ID", "Shop Name", "Owner Name", "Mobile", "City", "Status", "Items Count", "Subtotal", "Admin Discount", "Extra Discount", "Total Amount", "Created By", "Order Date"]
      rows = orders.map(o => [
        o.orderId,
        o.shopkeeper?.shopName || "",
        o.shopkeeper?.ownerName || "",
        o.shopkeeper?.mobile || "",
        o.shopkeeper?.city || "",
        o.status,
        o.items?.length || 0,
        o.subtotal || 0,
        o.adminDiscount || 0,
        o.extraDiscount || 0,
        o.totalAmount || 0,
        o.user?.name || "",
        o.createdAt ? format(new Date(o.createdAt), "dd/MM/yyyy HH:mm") : ""
      ])
    }
    
    if (type === "payments") {
      const payments = data as Array<{
        amount: number
        method: string
        transactionRef: string | null
        notes: string | null
        createdAt: string
        user: { name: string }
        shopkeeper: { shopName: string; ownerName: string; mobile: string } | null
        order: { orderId: string } | null
        outstandingInfo?: { totalOrders: number; totalPaid: number; balance: number }
      }>
      headers = ["Date", "Shop Name", "Owner Name", "Mobile", "Order ID", "Amount", "Payment Method", "Transaction Ref", "Notes", "Recorded By", "Total Orders Value", "Total Paid", "Outstanding Balance"]
      rows = payments.map(p => [
        p.createdAt ? format(new Date(p.createdAt), "dd/MM/yyyy HH:mm") : "",
        p.shopkeeper?.shopName || "N/A",
        p.shopkeeper?.ownerName || "",
        p.shopkeeper?.mobile || "",
        p.order?.orderId || "",
        p.amount || 0,
        p.method || "",
        p.transactionRef || "",
        p.notes || "",
        p.user?.name || "",
        p.outstandingInfo?.totalOrders || 0,
        p.outstandingInfo?.totalPaid || 0,
        p.outstandingInfo?.balance || 0
      ])
    }

    if (type === "products") {
      const products = data as Array<{
        name: string
        category: { name: string }
        unitPrice: number
        packingDetail: string
        packingQty: number
        productPrice: number
        discountPercent: number
        extraDiscountPercent: number
        isActive: boolean
      }>
      headers = ["Product Name", "Category", "Unit Price", "Packing Detail", "Packing Qty", "Product Price", "Discount %", "Extra Discount %", "Status"]
      rows = products.map(p => [
        p.name,
        p.category?.name || "",
        p.unitPrice || 0,
        p.packingDetail || "",
        p.packingQty || 0,
        p.productPrice || 0,
        p.discountPercent || 0,
        p.extraDiscountPercent || 0,
        p.isActive ? "Active" : "Inactive"
      ])
    }

    if (type === "outstanding") {
      const outstanding = data as Array<{
        totalOrders: number
        totalPaid: number
        balance: number
        lastUpdated: string
        shopkeeper: { shopName: string; ownerName: string; mobile: string; city?: string }
      }>
      headers = ["Shop Name", "Owner Name", "Mobile", "City", "Total Orders Value", "Total Paid", "Outstanding Balance", "Last Updated"]
      rows = outstanding.map(o => [
        o.shopkeeper?.shopName || "",
        o.shopkeeper?.ownerName || "",
        o.shopkeeper?.mobile || "",
        o.shopkeeper?.city || "",
        o.totalOrders || 0,
        o.totalPaid || 0,
        o.balance || 0,
        o.lastUpdated ? format(new Date(o.lastUpdated), "dd/MM/yyyy") : ""
      ])
    }

    if (type === "users") {
      const users = data as Array<{
        name: string
        email: string
        role: string
        isActive: boolean
        createdAt: string
        _count?: { shopkeepers: number; orders: number }
      }>
      headers = ["Name", "Email", "Role", "Status", "Shopkeepers Count", "Orders Count", "Created Date"]
      rows = users.map(u => [
        u.name,
        u.email || "",
        u.role,
        u.isActive ? "Active" : "Inactive",
        u._count?.shopkeepers || 0,
        u._count?.orders || 0,
        u.createdAt ? format(new Date(u.createdAt), "dd/MM/yyyy") : ""
      ])
    }

    return [headers, ...rows]
  }

  // Show loading state while session is loading
  if (sessionStatus === "loading") {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 w-full bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const isAdmin = session?.user?.role === "ADMIN"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
          Reports
        </h1>
        <p className="text-muted-foreground">
          {isAdmin 
            ? "Generate and export all reports in Excel format" 
            : "Generate and export your reports in Excel format"}
        </p>
      </div>

      {/* Report Configuration */}
      <Card className="border-orange-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />
            Generate Report
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "Select filters and generate reports for all data"
              : "Select report type and generate your reports"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filters */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Status Filter for Orders */}
            {reportType === "orders" && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* User Filter for Admin Orders */}
            {reportType === "orders" && isAdmin && users.length > 0 && (
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Users</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={generateReport}
              disabled={loading || !reportType}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Report
            </Button>
            {data && data.length > 0 && (session?.user?.canExport === true || session?.user?.canExport === undefined || session?.user?.role === "ADMIN") && (
              <Button variant="outline" onClick={exportToExcel} className="gap-2">
                <Download className="h-4 w-4" />
                Export Excel (.xlsx)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Preview */}
      {data && (
        <Card className="border-orange-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-orange-500" />
              Report Preview
            </CardTitle>
            <CardDescription>
              {data.length} record{data.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto custom-scrollbar max-h-96">
              {reportType === "orders" && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left p-2">Order ID</th>
                      <th className="text-left p-2">Shop</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-right p-2">Total</th>
                      <th className="text-left p-2">Created By</th>
                      <th className="text-left p-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data as Array<{
                      orderId: string
                      status: string
                      totalAmount: number
                      createdAt: string
                      shopkeeper: { shopName: string }
                      user: { name: string }
                    }>).map((order, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2 font-mono text-sm">{order.orderId}</td>
                        <td className="p-2">{order.shopkeeper?.shopName}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            order.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                            order.status === "APPROVED" ? "bg-green-100 text-green-800" :
                            order.status === "DISPATCHED" ? "bg-blue-100 text-blue-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="p-2 text-right font-medium">₹{order.totalAmount?.toLocaleString()}</td>
                        <td className="p-2">{order.user?.name}</td>
                        <td className="p-2 text-muted-foreground">{order.createdAt ? format(new Date(order.createdAt), "dd MMM yyyy") : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === "payments" && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Shop</th>
                      <th className="text-left p-2">Order ID</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-left p-2">Method</th>
                      <th className="text-right p-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data as Array<{
                      amount: number
                      method: string
                      createdAt: string
                      shopkeeper: { shopName: string } | null
                      order: { orderId: string } | null
                      outstandingInfo?: { balance: number }
                    }>).map((payment, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2 text-muted-foreground">{payment.createdAt ? format(new Date(payment.createdAt), "dd MMM yyyy") : ""}</td>
                        <td className="p-2">{payment.shopkeeper?.shopName || "N/A"}</td>
                        <td className="p-2 font-mono text-sm">{payment.order?.orderId || "-"}</td>
                        <td className="p-2 text-right text-green-600 font-medium">₹{payment.amount?.toLocaleString()}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            payment.method === "CASH" ? "bg-green-100 text-green-800" :
                            payment.method === "UPI" ? "bg-purple-100 text-purple-800" :
                            "bg-blue-100 text-blue-800"
                          }`}>
                            {payment.method}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <span className={(payment.outstandingInfo?.balance || 0) > 0 ? "text-red-600 font-medium" : "text-green-600"}>
                            ₹{payment.outstandingInfo?.balance?.toLocaleString() || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === "products" && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left p-2">Product</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-right p-2">Unit Price</th>
                      <th className="text-right p-2">Product Price</th>
                      <th className="text-right p-2">Discount</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data as Array<{
                      name: string
                      category: { name: string }
                      unitPrice: number
                      productPrice: number
                      discountPercent: number
                      isActive: boolean
                    }>).map((product, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2 font-medium">{product.name}</td>
                        <td className="p-2">{product.category?.name}</td>
                        <td className="p-2 text-right">₹{product.unitPrice?.toFixed(2)}</td>
                        <td className="p-2 text-right">₹{product.productPrice?.toFixed(2)}</td>
                        <td className="p-2 text-right">{product.discountPercent}%</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            product.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                          }`}>
                            {product.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === "outstanding" && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left p-2">Shop</th>
                      <th className="text-left p-2">Owner</th>
                      <th className="text-right p-2">Total Orders</th>
                      <th className="text-right p-2">Total Paid</th>
                      <th className="text-right p-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data as Array<{
                      totalOrders: number
                      totalPaid: number
                      balance: number
                      shopkeeper: { shopName: string; ownerName: string }
                    }>).map((item, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2 font-medium">{item.shopkeeper?.shopName}</td>
                        <td className="p-2">{item.shopkeeper?.ownerName}</td>
                        <td className="p-2 text-right">₹{item.totalOrders?.toLocaleString()}</td>
                        <td className="p-2 text-right text-green-600">₹{item.totalPaid?.toLocaleString()}</td>
                        <td className="p-2 text-right">
                          <span className={item.balance > 0 ? "text-red-600 font-medium" : "text-green-600"}>
                            ₹{item.balance?.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === "users" && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-right p-2">Shopkeepers</th>
                      <th className="text-right p-2">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data as Array<{
                      name: string
                      email: string
                      role: string
                      isActive: boolean
                      _count?: { shopkeepers: number; orders: number }
                    }>).map((user, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2 font-medium">{user.name}</td>
                        <td className="p-2">{user.email || "-"}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.role === "ADMIN" ? "bg-red-100 text-red-800" :
                            user.role === "SALES" ? "bg-orange-100 text-orange-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                          }`}>
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="p-2 text-right">{user._count?.shopkeepers || 0}</td>
                        <td className="p-2 text-right">{user._count?.orders || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
