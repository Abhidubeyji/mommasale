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
import { Plus, Pencil, Trash2, Store, Search, Phone, MapPin, User, Download } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import * as XLSX from "xlsx"

interface Shopkeeper {
  id: string
  shopName: string
  ownerName: string
  address: string | null
  mobile: string
  city: string | null
  createdAt: string
  createdBy: { id: string; name: string }
  outstanding?: {
    totalOrders: number
    totalPaid: number
    balance: number
  }
  _count?: {
    orders: number
  }
}

const initialFormState = {
  shopName: "",
  ownerName: "",
  address: "",
  mobile: "",
  city: ""
}

export function ShopkeeperManagement() {
  const { data: session } = useSession()
  const isViewer = session?.user?.role === "VIEWER"
  const [shopkeepers, setShopkeepers] = useState<Shopkeeper[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingShopkeeper, setEditingShopkeeper] = useState<Shopkeeper | null>(null)
  const [formData, setFormData] = useState(initialFormState)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchShopkeepers()
  }, [])

  const fetchShopkeepers = async () => {
    try {
      const res = await fetch("/api/shopkeepers", { credentials: 'include' })
      if (res.ok) {
        setShopkeepers(await res.json())
      }
    } catch (error) {
      console.error("Error fetching shopkeepers:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate mobile number (10 digits)
    const mobileRegex = /^[0-9]{10}$/
    if (!mobileRegex.test(formData.mobile)) {
      toast.error("Mobile number must be exactly 10 digits")
      return
    }
    
    setSaving(true)

    try {
      const url = "/api/shopkeepers"
      const method = editingShopkeeper ? "PUT" : "POST"
      const body = editingShopkeeper
        ? { id: editingShopkeeper.id, ...formData }
        : formData

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: 'include'
      })

      if (res.ok) {
        toast.success(`Shopkeeper ${editingShopkeeper ? "updated" : "created"} successfully`)
        fetchShopkeepers()
        setDialogOpen(false)
        setFormData(initialFormState)
        setEditingShopkeeper(null)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to save shopkeeper")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (shopkeeper: Shopkeeper) => {
    setEditingShopkeeper(shopkeeper)
    setFormData({
      shopName: shopkeeper.shopName,
      ownerName: shopkeeper.ownerName,
      address: shopkeeper.address || "",
      mobile: shopkeeper.mobile,
      city: shopkeeper.city || ""
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/shopkeepers?id=${id}`, { 
        method: "DELETE",
        credentials: 'include'
      })
      if (res.ok) {
        toast.success("Shopkeeper deleted successfully")
        fetchShopkeepers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete shopkeeper")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  // Filter shopkeepers
  const filteredShopkeepers = shopkeepers.filter(shopkeeper =>
    shopkeeper.shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shopkeeper.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shopkeeper.mobile.includes(searchTerm) ||
    (shopkeeper.city && shopkeeper.city.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Export to Excel
  const exportToExcel = () => {
    if (filteredShopkeepers.length === 0) {
      toast.error("No data to export")
      return
    }

    const headers = ["Shop Name", "Owner Name", "Mobile", "Address", "City", "Orders Count", "Outstanding Balance", "Created By", "Created Date"]
    
    const rows = filteredShopkeepers.map(sk => [
      sk.shopName,
      sk.ownerName,
      sk.mobile,
      sk.address || "",
      sk.city || "",
      sk._count?.orders || 0,
      sk.outstanding?.balance || 0,
      sk.createdBy?.name || "",
      sk.createdAt ? format(new Date(sk.createdAt), "dd/MM/yyyy") : ""
    ])

    const worksheetData = [headers, ...rows]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    
    // Set column widths
    worksheet['!cols'] = headers.map((_, i) => ({
      wch: Math.max(...worksheetData.map(row => String(row[i] || "").length)) + 2
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, worksheet, "Shopkeepers")
    XLSX.writeFile(wb, `shopkeepers_${format(new Date(), "yyyy-MM-dd")}.xlsx`)
    toast.success("Shopkeepers exported to Excel")
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
            Shopkeepers
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage customer/shopkeeper records</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isViewer && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) {
                setEditingShopkeeper(null)
                setFormData(initialFormState)
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Shopkeeper
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-lg w-[95vw] max-w-[95vw] sm:w-auto sm:max-w-lg p-0">
              <form onSubmit={handleSubmit}>
                <DialogHeader className="p-4 sm:p-6 pb-0">
                  <DialogTitle>{editingShopkeeper ? "Edit Shopkeeper" : "Create Shopkeeper"}</DialogTitle>
                  <DialogDescription>
                    {editingShopkeeper ? "Update shopkeeper information" : "Add a new shopkeeper/customer"}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 p-4 sm:p-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="shopName">Shop Name *</Label>
                      <Input
                        id="shopName"
                        value={formData.shopName}
                        onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ownerName">Owner Name *</Label>
                      <Input
                        id="ownerName"
                        value={formData.ownerName}
                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="mobile">Mobile * (10 digits)</Label>
                      <Input
                        id="mobile"
                        type="tel"
                        value={formData.mobile}
                        onChange={(e) => {
                          // Only allow digits and limit to 10 characters
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10)
                          setFormData({ ...formData, mobile: value })
                        }}
                        placeholder="Enter 10 digit mobile"
                        maxLength={10}
                        pattern="[0-9]{10}"
                        required
                      />
                      {formData.mobile && formData.mobile.length !== 10 && (
                        <p className="text-xs text-red-500">Mobile must be 10 digits ({formData.mobile.length}/10)</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                    {saving ? "Saving..." : editingShopkeeper ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          )}
          {(session?.user?.role === "ADMIN" || session?.user?.canExport === true) && (
            <Button variant="outline" onClick={exportToExcel} className="gap-2">
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Card className="border-orange-200 dark:border-gray-800 shrink-0">
        <CardContent className="pt-4 sm:pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by shop name, owner, mobile, or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 sm:h-11"
            />
          </div>
        </CardContent>
      </Card>

      {/* Shopkeepers Grid/Table */}
      <Card className="border-orange-200 dark:border-gray-800 flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-orange-500" />
            All Shopkeepers
          </CardTitle>
          <CardDescription>
            {filteredShopkeepers.length} shopkeeper{filteredShopkeepers.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col p-0">
          {/* Mobile Cards View */}
          <div className="sm:hidden flex-1 overflow-auto p-4 space-y-3">
            {filteredShopkeepers.map((shopkeeper) => (
              <Card key={shopkeeper.id} className="border-orange-100 dark:border-gray-800">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{shopkeeper.shopName}</p>
                      <p className="text-sm text-muted-foreground">{shopkeeper.ownerName}</p>
                    </div>
                    {!isViewer && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(shopkeeper)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4 text-orange-500" />
                        </Button>
                        {session?.user?.role === "ADMIN" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(shopkeeper.id)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {shopkeeper.mobile}
                  </div>
                  {shopkeeper.city && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      {shopkeeper.city}
                    </div>
                  )}
                  {session?.user?.role === "ADMIN" && shopkeeper.createdBy && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <User className="h-3 w-3" />
                      Created by: {shopkeeper.createdBy.name}
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-orange-100 dark:border-gray-800">
                    <Badge variant="secondary">{shopkeeper._count?.orders || 0} orders</Badge>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      ₹{(shopkeeper.outstanding?.balance || 0).toLocaleString()} due
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredShopkeepers.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No shopkeepers found. Create your first shopkeeper.
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>City</TableHead>
                  {session?.user?.role === "ADMIN" && (
                    <TableHead>Created By</TableHead>
                  )}
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  {!isViewer && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShopkeepers.map((shopkeeper) => (
                  <TableRow key={shopkeeper.id}>
                    <TableCell className="font-medium">{shopkeeper.shopName}</TableCell>
                    <TableCell>{shopkeeper.ownerName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {shopkeeper.mobile}
                      </div>
                    </TableCell>
                    <TableCell>
                      {shopkeeper.city && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {shopkeeper.city}
                        </div>
                      )}
                    </TableCell>
                    {session?.user?.role === "ADMIN" && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{shopkeeper.createdBy?.name || "Unknown"}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Badge variant="secondary">{shopkeeper._count?.orders || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={shopkeeper.outstanding?.balance && shopkeeper.outstanding.balance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                        ₹{(shopkeeper.outstanding?.balance || 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {!isViewer ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(shopkeeper)}
                            className="hover:bg-orange-100 dark:hover:bg-gray-800"
                          >
                            <Pencil className="h-4 w-4 text-orange-500" />
                          </Button>
                          {session?.user?.role === "ADMIN" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(shopkeeper.id)}
                              className="hover:bg-red-100 dark:hover:bg-gray-800"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredShopkeepers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={session?.user?.role === "ADMIN" ? 8 : 7} className="text-center text-muted-foreground py-8">
                      No shopkeepers found. Create your first shopkeeper.
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
