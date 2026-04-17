'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { Plus, Pencil, Trash2, Users, UserCheck, UserX, Download, FileX } from "lucide-react"
import { toast } from "sonner"

interface User {
  id: string
  email: string | null
  name: string
  role: string
  isActive: boolean
  canExport: boolean
  createdAt: string
}

const initialFormState = {
  id: "",
  name: "",
  password: "",
  role: "SALES"
}

export function UserManagement() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState(initialFormState)
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        setUsers(await res.json())
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (editingUser) {
        // Update existing user
        const updateData: Record<string, unknown> = {
          id: editingUser.id,
          name: formData.name,
          role: formData.role
        }
        if (formData.password) {
          updateData.password = formData.password
        }

        const res = await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData)
        })

        if (res.ok) {
          toast.success("User updated successfully")
          fetchUsers()
          setDialogOpen(false)
        } else {
          const data = await res.json()
          toast.error(data.error || "Failed to update user")
        }
      } else {
        // Create new user
        if (!formData.id) {
          toast.error("User Name is required")
          setSaving(false)
          return
        }

        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: formData.id,
            name: formData.name,
            password: formData.password,
            role: formData.role
          })
        })

        if (res.ok) {
          toast.success("User created successfully")
          fetchUsers()
          setDialogOpen(false)
        } else {
          const data = await res.json()
          toast.error(data.error || "Failed to create user")
        }
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      id: user.id,
      name: user.name,
      password: "",
      role: user.role
    })
    setDialogOpen(true)
  }

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return
    
    setDeleting(true)
    try {
      const res = await fetch(`/api/users?id=${userToDelete.id}`, { 
        method: "DELETE" 
      })

      if (res.ok) {
        toast.success("User deleted successfully")
        fetchUsers()
        setDeleteDialogOpen(false)
        setUserToDelete(null)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete user")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          isActive: !user.isActive
        })
      })

      if (res.ok) {
        toast.success(`User ${user.isActive ? "deactivated" : "activated"} successfully`)
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update user")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  const handleToggleExport = async (user: User) => {
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          canExport: !user.canExport
        })
      })

      if (res.ok) {
        toast.success(`Export ${user.canExport ? "disabled" : "enabled"} for ${user.name}`)
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update user")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "SALES": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "VIEWER": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
      default: return ""
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            User Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage system users and their permissions</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingUser(null)
            setFormData(initialFormState)
          }
        }}>
          {isAdmin && (
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-md w-[95vw] max-w-[95vw] sm:w-auto sm:max-w-md p-0">
            <form onSubmit={handleSubmit}>
              <DialogHeader className="p-4 sm:p-6 pb-0">
                <DialogTitle>{editingUser ? "Edit User" : "Create New User"}</DialogTitle>
                <DialogDescription>
                  {editingUser ? "Update user information" : "Add a new user to the system"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 p-4 sm:p-6 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="userId">User Name (Login ID) *</Label>
                  <Input
                    id="userId"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                    placeholder="Enter username for login"
                    required
                    disabled={!!editingUser}
                  />
                  {editingUser && (
                    <p className="text-xs text-muted-foreground">User Name cannot be changed</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">
                    Password {editingUser && "(leave blank to keep current)"}
                    {!editingUser && " *"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? "Enter new password" : "Enter password"}
                    required={!editingUser}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="SALES">Sales</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                  {saving ? "Saving..." : editingUser ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-orange-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            All Users
          </CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? "s" : ""} in the system
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Full Name</TableHead>
                  <TableHead className="whitespace-nowrap">User Name</TableHead>
                  <TableHead className="whitespace-nowrap hidden sm:table-cell">Role</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap hidden md:table-cell">Export</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium whitespace-nowrap">{user.name}</TableCell>
                    <TableCell className="font-mono whitespace-nowrap">{user.id}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={user.isActive ? "default" : "secondary"} className={user.isActive ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={user.canExport ? "default" : "secondary"} className={user.canExport ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : ""}>
                        {user.canExport ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {isAdmin && (
                        <div className="flex justify-end gap-1 sm:gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(user)}
                            className="hover:bg-orange-100 dark:hover:bg-gray-800"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4 text-orange-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleExport(user)}
                            disabled={user.id === session?.user?.id || user.role === "ADMIN"}
                            className="hover:bg-blue-100 dark:hover:bg-gray-800"
                            title={user.canExport ? "Disable Export" : "Enable Export"}
                          >
                            {user.canExport ? (
                              <Download className="h-4 w-4 text-blue-500" />
                            ) : (
                              <FileX className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(user)}
                            disabled={user.id === session?.user?.id}
                            className="hover:bg-orange-100 dark:hover:bg-gray-800"
                            title={user.isActive ? "Deactivate" : "Activate"}
                          >
                            {user.isActive ? (
                              <UserX className="h-4 w-4 text-red-500" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(user)}
                            disabled={user.id === session?.user?.id}
                            className="hover:bg-red-100 dark:hover:bg-gray-800"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete user "{userToDelete?.name}" ({userToDelete?.id})? This action cannot be undone.
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
    </div>
  )
}
