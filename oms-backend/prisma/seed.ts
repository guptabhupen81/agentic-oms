import { PrismaClient, UserRole, OrderSourceType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // --- Product hierarchy (demo: 4 levels; extend to 5-6 the same way) ---
  const category = await prisma.productHierarchyNode.create({
    data: { name: 'Food & Beverage', level: 1 },
  });
  const subCategory = await prisma.productHierarchyNode.create({
    data: { name: 'Dairy', level: 2, parentId: category.id },
  });
  const brand = await prisma.productHierarchyNode.create({
    data: { name: 'FreshCo', level: 3, parentId: subCategory.id },
  });
  const skuGroup = await prisma.productHierarchyNode.create({
    data: { name: 'FreshCo Milk 1L', level: 4, parentId: brand.id },
  });

  const manufacturer = await prisma.manufacturer.create({
    data: { name: 'FreshCo Dairies Pvt Ltd', gstin: '29ABCDE1234F1Z5' },
  });

  const product = await prisma.product.create({
    data: {
      sku: 'FRESHCO-MILK-1L',
      name: 'FreshCo Toned Milk 1L',
      hierarchyNodeId: skuGroup.id,
      manufacturerId: manufacturer.id,
      uom: 'EACH',
      hsnCode: '0401',
      gstRatePercent: 5,
      defaultUnitPrice: 58,
      minOrderQty: 10,
      maxOrderQty: 500,
    },
  });

  const warehouse = await prisma.warehouse.create({
    data: { name: 'Bengaluru Central Warehouse', code: 'BLR-CW-01' },
  });

  const retailer = await prisma.retailer.create({
    data: {
      name: 'Sri Ganesh Kirana Store',
      gstin: '29XYZAB5678C1Z2',
      creditLimitAmount: 50000,
      creditUsedAmount: 12000,
    },
  });

  const execUser = await prisma.user.create({
    data: {
      name: 'Demo OMS Executive',
      email: 'oms.exec@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      role: UserRole.OMS_EXECUTIVE,
    },
  });

  // --- Two batches, different expiry, to demonstrate FEFO ---
  const batchEarly = await prisma.batch.create({
    data: {
      batchNumber: 'B-EARLY-001',
      productId: product.id,
      manufacturerId: manufacturer.id,
      manufactureDate: new Date('2026-08-01'),
      expiryDate: new Date('2026-09-15'), // expires sooner -> should be picked first
    },
  });
  const batchLater = await prisma.batch.create({
    data: {
      batchNumber: 'B-LATER-002',
      productId: product.id,
      manufacturerId: manufacturer.id,
      manufactureDate: new Date('2026-08-20'),
      expiryDate: new Date('2026-10-30'),
    },
  });

  await prisma.inventoryStock.create({
    data: { warehouseId: warehouse.id, productId: product.id, batchId: batchEarly.id, quantityOnHand: 50 },
  });
  await prisma.inventoryStock.create({
    data: { warehouseId: warehouse.id, productId: product.id, batchId: batchLater.id, quantityOnHand: 100 },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: 'ORD-2026-000001',
      clientOrderId: 'seed-demo-order-1',
      retailerId: retailer.id,
      createdById: execUser.id,
      sourceType: OrderSourceType.OMS_EXECUTIVE,
      lines: { create: [{ productId: product.id, orderedQty: 70 }] },
    },
  });

  console.log('Seed complete.');
  console.log('Demo login: oms.exec@example.com / password123');
  console.log('Warehouse ID:', warehouse.id);
  console.log('Order ID (ordered 70, should pull 50 from early batch + 20 from later batch):', order.id);
  console.log('Next: POST /allocation/run with this orderId+warehouseId, then POST /picklists/generate with orderIds: [orderId]');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
