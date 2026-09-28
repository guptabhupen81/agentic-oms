import { PrismaClient, UserRole, OrderSourceType, SellerType } from '@prisma/client';
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

  // --- Channel hierarchy (exactly 2 levels: Channel -> Sub-Channel) ---
  const generalTrade = await prisma.channelHierarchyNode.create({
    data: { name: 'General Trade', level: 1 },
  });
  const kiranaSubChannel = await prisma.channelHierarchyNode.create({
    data: { name: 'Kirana', level: 2, parentId: generalTrade.id },
  });

  const retailer = await prisma.retailer.create({
    data: {
      code: 'RET-0001',
      name: 'Sri Ganesh Kirana Store',
      gstin: '29XYZAB5678C1Z2', // checksum-valid GSTIN
      pinCode: '560001',
      city: 'Bangalore',
      state: 'Karnataka',
      creditLimitAmount: 50000,
      creditUsedAmount: 12000,
      channelNodeId: kiranaSubChannel.id,
    },
  });

  // --- Salesmen (3 seller types) + retailer/van mappings ---
  const preSeller = await prisma.salesman.create({
    data: { code: 'SM-0001', name: 'Ramesh Kumar', phone: '9900000001', sellerType: SellerType.PRE_SELLER },
  });
  const deliveryBoy = await prisma.salesman.create({
    data: { code: 'SM-0002', name: 'Suresh Babu', phone: '9900000002', sellerType: SellerType.DELIVERY_BOY },
  });
  const vanSeller = await prisma.salesman.create({
    data: { code: 'SM-0003', name: 'Manoj Patil', phone: '9900000003', sellerType: SellerType.VAN_SELLER },
  });

  // Retailer gets a Pre-Seller AND a Delivery Boy — allowed together.
  await prisma.retailerSalesmanMapping.create({
    data: { retailerId: retailer.id, salesmanId: preSeller.id },
  });
  await prisma.retailerSalesmanMapping.create({
    data: { retailerId: retailer.id, salesmanId: deliveryBoy.id },
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

  // --- Vans, mapped to salesmen (only Van-Seller/Delivery-Boy are eligible) ---
  const deliveryVan = await prisma.van.create({
    data: { registration: 'KA-01-AB-1234', name: 'Delivery Van 1', assignedSalesmanId: deliveryBoy.id },
  });
  const secondaryVan = await prisma.van.create({
    data: { registration: 'KA-01-AB-5678', name: 'Van Sales 1', assignedSalesmanId: vanSeller.id },
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
  console.log('Delivery van (mapped to Delivery Boy, can accept picklists):', deliveryVan.id);
  console.log('Secondary van (mapped to Van-Seller, cannot accept picklists):', secondaryVan.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
