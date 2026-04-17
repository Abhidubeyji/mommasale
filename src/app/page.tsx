'use client'

import { useSession } from "next-auth/react"
import { useAppStore } from "@/store/app-store"
import { AppLayout } from "@/components/layout/app-layout"
import { LoginForm } from "@/components/auth/login-form"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { UserManagement } from "@/components/users/user-management"
import { CategoryManagement } from "@/components/products/category-management"

import { ProductManagement } from "@/components/products/product-management"
import { ShopkeeperManagement } from "@/components/shopkeepers/shopkeeper-management"
import { OrderManagement } from "@/components/orders/order-management"
import { PaymentManagement } from "@/components/payments/payment-management"

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 dark:from-gray-900 dark:to-gray-800">
      <div className="animate-pulse">Loading...</div>
    </div>
  )
}

export default function Home() {
  const { data: session, status } = useSession()
  const { currentView } = useAppStore()

  // Show loading while session is being fetched
  if (status === "loading") {
    return <LoadingScreen />
  }

  // Not authenticated - show login
  if (!session) {
    return <LoginForm />
  }

  // Authenticated - show app
  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        return <DashboardContent />
      case "users":
        return <UserManagement />
      case "categories":
        return <CategoryManagement />

      case "products":
        return <ProductManagement />
      case "shopkeepers":
        return <ShopkeeperManagement />
      case "orders":
        return <OrderManagement />
      case "payments":
        return <PaymentManagement />
      default:
        return <DashboardContent />
    }
  }

  return (
    <AppLayout>
      {renderContent()}
    </AppLayout>
  )
}
