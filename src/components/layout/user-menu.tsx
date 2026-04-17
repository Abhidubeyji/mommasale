'use client'

import { useSession, signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Moon, Sun, LogOut, User } from "lucide-react"
import { useAppStore } from "@/store/app-store"

export function UserMenu() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const reset = useAppStore((state) => state.reset)

  if (!session) return null

  const initials = session.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U"

  const handleSignOut = async () => {
    reset() // Reset app state
    await signOut({ redirect: false })
    router.push("/")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-orange-200 dark:border-orange-800">
            <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-500 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{session.user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{session.user?.email}</p>
            <p className="text-xs leading-none text-orange-600 dark:text-orange-400 mt-1">
              {session.user?.role}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? (
            <>
              <Sun className="mr-2 h-4 w-4" />
              Light Mode
            </>
          ) : (
            <>
              <Moon className="mr-2 h-4 w-4" />
              Dark Mode
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
