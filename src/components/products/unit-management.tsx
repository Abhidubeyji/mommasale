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
import { Plus, Pencil, Trash2, Scale } from "lucide-react"
import { toast } from "sonner"

interface Unit {
  id: string
  name: string
  symbol: string
  _count?: {
    products: number
  }
}

export function UnitManagement() {
  const { data: session } = useSession()
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [formData, setFormData] = useState({ name: "", symbol: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUnits()
  }, [])

  const fetchUnits = async () => {
    try {
      const res = await fetch("/api/units")
      if (res.ok) {
        setUnits(await res.json())
      }
    } catch (error) {
      console.error("Error fetching units:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = "/api/units"
      const method = editingUnit ? "PUT" : "POST"
      const body = editingUnit
        ? { id: editingUnit.id, ...formData }
        : formData

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        toast.success(`Unit ${editingUnit ? "updated" : "created"} successfully`)
        fetchUnits()
        setDialogOpen(false)
        setFormData({ name: "", symbol: "" })
        setEditingUnit(null)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to save unit")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit)
    setFormData({
      name: unit.name,
      symbol: unit.symbol
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/units?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Unit deleted successfully")
        fetchUnits()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete unit")
      }
    } catch (error) {
      toast.error("An error occurred")
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            Units
          </h1>
          <p className="text-muted-foreground">Manage measurement units</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingUnit(null)
            setFormData({ name: "", symbol: "" })
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
              <Plus className="mr-2 h-4 w-4" />
              Add Unit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingUnit ? "Edit Unit" : "Create Unit"}</DialogTitle>
                <DialogDescription>
                  {editingUnit ? "Update unit information" : "Add a new measurement unit"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Kilogram"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    placeholder="e.g., KG"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                  {saving ? "Saving..." : editingUnit ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-orange-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-orange-500" />
            All Units
          </CardTitle>
          <CardDescription>
            {units.length} unit{units.length !== 1 ? "s" : ""} in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{unit.symbol}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{unit._count?.products || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(unit)}
                          className="hover:bg-orange-100 dark:hover:bg-gray-800"
                        >
                          <Pencil className="h-4 w-4 text-orange-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(unit.id)}
                          disabled={(unit._count?.products || 0) > 0}
                          className="hover:bg-red-100 dark:hover:bg-gray-800"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {units.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No units found. Create your first unit.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
