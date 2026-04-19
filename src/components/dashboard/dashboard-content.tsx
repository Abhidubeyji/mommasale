'use client'

import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ShoppingCart, Clock, CreditCard, TrendingUp, AlertCircle, CheckCircle, XCircle, Truck } from "lucide-react"
import { useEffect, useState } from "react"

interface DashboardStats {
  totalOrders: number
  pendingApprovals: number
  totalPayments: number
  outstandingBalance: number
  grandTotal: number
  recentOrders: Array<{
    id: string
    orderId: string
    shopkeeper: { shopName: string }
    status: string
    totalAmount: number
    createdAt: string
  }>
}

export function DashboardContent() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const [ordersRes, paymentsRes, shopkeepersRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/payments"),
        fetch("/api/shopkeepers")
      ])

      const orders = await ordersRes.json()
      const payments = await paymentsRes.json()
      const shopkeepers = await shopkeepersRes.json()

      const totalOrders = orders.length
      const pendingApprovals = orders.filter((o: { status: string }) => o.status === "PENDING").length
      
      // Calculate Grand Total from all orders
      const grandTotal = orders.reduce((sum: number, o: { totalAmount: number }) => {
        return sum + Math.round(o.totalAmount)
      }, 0)
      
      // Calculate Total Payments
      const totalPayments = payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
      
      // Outstanding = Grand Total - Total Payments
      const outstandingBalance = grandTotal - totalPayments

      setStats({
        totalOrders,
        pendingApprovals,
        totalPayments,
        outstandingBalance,
        grandTotal,
        recentOrders: orders.slice(0, 5)
      })
    } catch (error) {
      console.error("Error fetching dashboard stats:", error)
    } finally {
      setLoading(false)
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name}! Here&apos;s your business overview.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-orange-200 dark:border-gray-800 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All time orders</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-gray-800 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats?.pendingApprovals || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-gray-800 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grand Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              ₹{(stats?.grandTotal || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total order value</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-gray-800 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">₹{(stats?.totalPayments || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Total received</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-gray-800 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              ₹{(stats?.outstandingBalance || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Grand Total - Payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="border-orange-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Latest order activity</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentOrders && stats.recentOrders.length > 0 ? (
            <div className="space-y-4">
              {stats.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-gray-800 hover:bg-orange-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(order.status)}
                    <div>
                      <p className="font-medium">{order.orderId}</p>
                      <p className="text-sm text-muted-foreground">{order.shopkeeper?.shopName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">₹{Math.round(order.totalAmount).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Grand Total</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No orders yet. Create your first order to see it here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
