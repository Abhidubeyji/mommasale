'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { History, Trash2, Search } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Input } from "@/components/ui/input"

interface LoginLog {
  id: string
  userId: string
  loginTime: string
  success: boolean
  user: {
    id: string
    name: string
    email: string | null
    role: string
  }
}

interface User {
  id: string
  name: string
}

export function LoginLogs() {
  const { data: session } = useSession()
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [userFilter, setUserFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchLogs()
    fetchUsers()
  }, [userFilter])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const url = userFilter && userFilter !== "all" 
        ? `/api/login-logs?userId=${userFilter}` 
        : "/api/login-logs"
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setTotal(data.total)
      }
    } catch (error) {
      console.error("Error fetching login logs:", error)
      toast.error("Failed to fetch login logs")
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        setUsers(await res.json())
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const handleClearOldLogs = async () => {
    if (!confirm("Are you sure you want to delete login logs older than 30 days?")) {
      return
    }

    try {
      const res = await fetch("/api/login-logs?days=30", { method: "DELETE" })
      if (res.ok) {
        const data = await res.json()
        toast.success(data.message)
        fetchLogs()
      } else {
        toast.error("Failed to clear logs")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  const handleDeleteAllLogs = async () => {
    if (!confirm("⚠️ WARNING: This will delete ALL login logs permanently!\n\nAre you absolutely sure?")) {
      return
    }
    if (!confirm("Last chance! This action cannot be undone. Delete ALL login logs?")) {
      return
    }

    try {
      const res = await fetch("/api/login-logs?days=0", { method: "DELETE" })
      if (res.ok) {
        const data = await res.json()
        toast.success(data.message)
        fetchLogs()
      } else {
        toast.error("Failed to delete all logs")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  const handleDeleteSingleLog = async (logId: string) => {
    if (!confirm("Delete this login log entry?")) {
      return
    }
    try {
      const res = await fetch(`/api/login-logs?id=${logId}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Login log deleted")
        fetchLogs()
      } else {
        toast.error("Failed to delete log")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  // Filter logs by search term
  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      log.user.name.toLowerCase().includes(search) ||
      log.user.id.toLowerCase().includes(search) ||
      (log.user.email && log.user.email.toLowerCase().includes(search))
    )
  })

  if (loading && logs.length === 0) {
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
            Login Logs
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Track user login activity</p>
        </div>

        {session?.user?.role === "ADMIN" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleClearOldLogs} className="text-red-600 border-red-200">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Old Logs (30d+)
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllLogs} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete All Logs
            </Button>
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
                placeholder="Search by user name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 sm:h-11"
              />
            </div>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full sm:w-48 h-10 sm:h-11">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 dark:border-gray-800 flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-orange-500" />
            Login History
          </CardTitle>
          <CardDescription>
            {total} login record{total !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
          {/* Mobile Card View */}
          <div className="sm:hidden flex-1 overflow-auto p-3 space-y-3">
            {filteredLogs.map((log) => (
              <div key={log.id} className="border rounded-lg p-3 bg-white dark:bg-gray-800 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{log.user.name}</p>
                    <p className="text-xs text-muted-foreground">{log.user.id}</p>
                  </div>
                  <Badge className={log.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {log.success ? "Success" : "Failed"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Login Time</p>
                    <p className="font-medium">{format(new Date(log.loginTime), "dd/MM/yyyy HH:mm:ss")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p className="font-medium">{log.user.role}</p>
                  </div>
                </div>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No login logs found
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block flex-1 overflow-auto">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">User Name</TableHead>
                    <TableHead className="whitespace-nowrap">User ID</TableHead>
                    <TableHead className="whitespace-nowrap">Role</TableHead>
                    <TableHead className="whitespace-nowrap">Login Time</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    {session?.user?.role === "ADMIN" && (
                      <TableHead className="text-right whitespace-nowrap">Action</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{log.user.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(log.loginTime), "dd/MM/yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge className={log.success ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}>
                          {log.success ? "Success" : "Failed"}
                        </Badge>
                      </TableCell>
                      {session?.user?.role === "ADMIN" && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSingleLog(log.id)}
                            className="hover:bg-red-100 dark:hover:bg-gray-800"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {filteredLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={session?.user?.role === "ADMIN" ? 6 : 5} className="text-center text-muted-foreground py-8">
                        No login logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
