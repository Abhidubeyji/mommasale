'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
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
import { Plus, Pencil, Trash2, Tags } from "lucide-react"
import { toast } from "sonner"

interface Category {
  id: string
  name: string
  description: string | null
  _count?: {
    products: number
  }
}

export function CategoryManagement() {
  const { data: session } = useSession()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "" })
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories")
      if (res.ok) {
        setCategories(await res.json())
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = "/api/categories"
      const method = editingCategory ? "PUT" : "POST"
      const body = editingCategory
        ? { id: editingCategory.id, ...formData }
        : formData

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        toast.success(`Category ${editingCategory ? "updated" : "created"} successfully`)
        fetchCategories()
        setDialogOpen(false)
        setFormData({ name: "", description: "" })
        setEditingCategory(null)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to save category")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || ""
    })
    setDialogOpen(true)
  }

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return
    
    setDeleting(true)
    try {
      const res = await fetch(`/api/categories?id=${categoryToDelete.id}`, { 
        method: "DELETE" 
      })

      if (res.ok) {
        toast.success("Category deleted successfully")
        fetchCategories()
        setDeleteDialogOpen(false)
        setCategoryToDelete(null)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete category")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setDeleting(false)
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
            Categories
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage product categories</p>
        </div>

        {session?.user?.role === "ADMIN" && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) {
              setEditingCategory(null)
              setFormData({ name: "", description: "" })
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md w-[95vw] max-w-[95vw] sm:w-auto sm:max-w-md p-0">
              <form onSubmit={handleSubmit}>
                <DialogHeader className="p-4 sm:p-6 pb-0">
                  <DialogTitle>{editingCategory ? "Edit Category" : "Create Category"}</DialogTitle>
                  <DialogDescription>
                    {editingCategory ? "Update category information" : "Add a new product category"}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 p-4 sm:p-6 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter category name"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter description (optional)"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                    {saving ? "Saving..." : editingCategory ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-orange-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-orange-500" />
            All Categories
          </CardTitle>
          <CardDescription>
            {categories.length} categor{categories.length !== 1 ? "ies" : "y"} in the system
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <Table className="min-w-[400px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap hidden sm:table-cell">Description</TableHead>
                  <TableHead className="whitespace-nowrap">Products</TableHead>
                  {session?.user?.role === "ADMIN" && (
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium whitespace-nowrap">{category.name}</TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">{category.description || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="secondary">{category._count?.products || 0}</Badge>
                    </TableCell>
                    {session?.user?.role === "ADMIN" && (
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1 sm:gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(category)}
                            className="hover:bg-orange-100 dark:hover:bg-gray-800"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4 text-orange-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(category)}
                            className="hover:bg-red-100 dark:hover:bg-gray-800"
                            title="Delete category"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={session?.user?.role === "ADMIN" ? 4 : 3} className="text-center text-muted-foreground py-8">
                      No categories found. {session?.user?.role === "ADMIN" && "Create your first category."}
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
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Category
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to delete <strong>"{categoryToDelete?.name}"</strong>?
                </p>
                {(categoryToDelete?._count?.products || 0) > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">
                      ⚠️ Warning: This category has {categoryToDelete?._count?.products} product(s).
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                      These products will become uncategorized after deletion.
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
              </div>
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
