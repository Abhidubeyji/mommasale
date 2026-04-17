import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Check if admin user exists
  let admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  })

  if (!admin) {
    console.log('Creating admin user...')
    admin = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: 'admin@mommasale.com',
        password: '$2a$10$K7L1QJ9QJ9QJ9QJ9QJ9QJOP8ZG5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5', // admin123
        name: 'Admin',
        role: 'ADMIN',
        isActive: true,
        updatedAt: new Date()
      }
    })
  } else {
    console.log('Admin user already exists:', admin.email)
  }

  // Create categories
  const categoriesData = [
    { id: randomUUID(), name: 'Whole Spices', description: 'Premium whole spices for authentic flavor' },
    { id: randomUUID(), name: 'Ground Spices', description: 'Freshly ground spices for cooking' },
    { id: randomUUID(), name: 'Blended Masala', description: 'Special masala blends' },
  ]

  for (const cat of categoriesData) {
    const existing = await prisma.category.findUnique({ where: { name: cat.name } })
    if (!existing) {
      await prisma.category.create({
        data: { ...cat, updatedAt: new Date() }
      })
      console.log('Created category:', cat.name)
    }
  }

  const categories = await prisma.category.findMany()

  // Create sample products
  const productsData = [
    { name: 'Turmeric Powder', category: 'Ground Spices', unitPrice: 200, packingDetail: '500g Pack', packingQty: 0.5, discountPercent: 5, extraDiscountPercent: 2 },
    { name: 'Red Chilli Powder', category: 'Ground Spices', unitPrice: 300, packingDetail: '500g Pack', packingQty: 0.5, discountPercent: 5, extraDiscountPercent: 2 },
    { name: 'Coriander Powder', category: 'Ground Spices', unitPrice: 150, packingDetail: '500g Pack', packingQty: 0.5, discountPercent: 3, extraDiscountPercent: 1 },
    { name: 'Cumin Seeds', category: 'Whole Spices', unitPrice: 400, packingDetail: '250g Pack', packingQty: 0.25, discountPercent: 4, extraDiscountPercent: 2 },
    { name: 'Garam Masala', category: 'Blended Masala', unitPrice: 350, packingDetail: '200g Pack', packingQty: 0.2, discountPercent: 6, extraDiscountPercent: 3 },
  ]

  for (const prod of productsData) {
    const existing = await prisma.product.findFirst({ where: { name: prod.name } })
    if (!existing) {
      const category = categories.find(c => c.name === prod.category)
      if (category) {
        await prisma.product.create({
          data: {
            id: randomUUID(),
            name: prod.name,
            categoryId: category.id,
            unitPrice: prod.unitPrice,
            packingDetail: prod.packingDetail,
            packingQty: prod.packingQty,
            productPrice: prod.unitPrice * prod.packingQty,
            discountPercent: prod.discountPercent,
            extraDiscountPercent: prod.extraDiscountPercent,
            updatedAt: new Date()
          }
        })
        console.log('Created product:', prod.name)
      }
    }
  }

  // Create sample shopkeepers
  const shopkeepersData = [
    { shopName: 'Sharma General Store', ownerName: 'Rajesh Sharma', mobile: '9876543210', city: 'Mumbai', address: 'Shop No. 12, Main Market' },
    { shopName: 'Patel Kirana Store', ownerName: 'Dinesh Patel', mobile: '9876543211', city: 'Delhi', address: 'Sector 5, Block A' },
  ]

  for (const shop of shopkeepersData) {
    const existing = await prisma.shopkeeper.findFirst({ where: { mobile: shop.mobile } })
    if (!existing) {
      await prisma.shopkeeper.create({
        data: {
          id: randomUUID(),
          ...shop,
          createdById: admin.id,
          updatedAt: new Date()
        }
      })
      console.log('Created shopkeeper:', shop.shopName)
    }
  }

  console.log('Seed completed!')
  console.log('Summary:')
  console.log('- Categories:', await prisma.category.count())
  console.log('- Products:', await prisma.product.count())
  console.log('- Shopkeepers:', await prisma.shopkeeper.count())
  console.log('- Users:', await prisma.user.count())
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
