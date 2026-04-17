'use client'

import { useSession, signOut } from "next-auth/react"
import { useAppStore, ViewType } from "@/store/app-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { UserMenu } from "@/components/layout/user-menu"
import { Separator } from "@/components/ui/separator"
import Image from "next/image"
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  Store, 
  CreditCard, 
  Tags,
  Menu,
  LogOut
} from "lucide-react"

interface NavItem {
  id: ViewType
  label: string
  icon: React.ReactNode
  roles: string[]
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" />, roles: ["ADMIN", "SALES", "VIEWER"] },
  { id: "users", label: "Users", icon: <Users className="h-5 w-5" />, roles: ["ADMIN", "VIEWER"] },
  { id: "categories", label: "Categories", icon: <Tags className="h-5 w-5" />, roles: ["ADMIN", "VIEWER"] },
  { id: "products", label: "Products", icon: <Package className="h-5 w-5" />, roles: ["ADMIN", "SALES", "VIEWER"] },
  { id: "shopkeepers", label: "Shopkeepers", icon: <Store className="h-5 w-5" />, roles: ["ADMIN", "SALES", "VIEWER"] },
  { id: "orders", label: "Orders", icon: <ShoppingCart className="h-5 w-5" />, roles: ["ADMIN", "SALES", "VIEWER"] },
  { id: "payments", label: "Payments", icon: <CreditCard className="h-5 w-5" />, roles: ["ADMIN", "SALES", "VIEWER"] },
]

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { currentView, setCurrentView } = useAppStore()
  const { data: session } = useSession()

  const userRole = session?.user?.role || "VIEWER"
  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole))

  const handleLogout = async () => {
    try {
      onNavigate?.()
      // Use redirect: false and manually navigate for more reliable logout
      await signOut({ redirect: false })
      // Clear any local state
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
      // Fallback: force page reload to home
      window.location.href = '/'
    }
  }

  return (
    <div className="flex flex-col h-full">
      <nav className="space-y-1 flex-1">
        {filteredNavItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 px-3 py-2.5 h-auto text-left font-normal transition-all",
              currentView === item.id
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-md"
                : "hover:bg-orange-100 dark:hover:bg-gray-800"
            )}
            onClick={() => {
              setCurrentView(item.id)
              onNavigate?.()
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </Button>
        ))}
      </nav>
      
      {/* Logout Button at Bottom */}
      <div className="mt-auto pt-4">
        <Separator className="mb-4 bg-orange-200 dark:bg-gray-700" />
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 py-2.5 h-auto text-left font-normal transition-all text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-orange-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 sm:w-64">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex h-full flex-col">
                  <div className="flex items-center gap-2 p-4 border-b border-orange-200 dark:border-gray-800">
                    <Image 
                      src="/logo.png" 
                      alt="Mom Masale" 
                      width={40} 
                      height={40}
                      className="rounded-lg"
                    />
                    <span className="font-bold text-lg bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                      Mom Masale
                    </span>
                  </div>
                  <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
                    <SidebarNav onNavigate={() => setSidebarOpen(false)} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <div className="flex items-center gap-2">
              <Image 
                src="/logo.png" 
                alt="Mom Masale" 
                width={36} 
                height={36}
                className="rounded-lg hidden sm:block"
              />
              <span className="font-bold text-lg bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent hidden sm:inline">
                Mom Masale
              </span>
            </div>
          </div>

          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-orange-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <SidebarNav />
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-auto">
            {children}
          </div>
          {/* Footer */}
          <footer className="shrink-0 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-orange-200 dark:border-gray-800 text-center">
            <p className="text-xs text-muted-foreground">
              Developed by <span className="font-semibold text-orange-600">Intech IT Solution</span>
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}
