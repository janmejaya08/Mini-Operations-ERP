const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  await prisma.customerOrder.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.item.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: { email: 'admin@erp.com', passwordHash, name: 'Admin User', role: 'ADMIN' }
  });
  const ops = await prisma.user.create({
    data: { email: 'ops@erp.com', passwordHash, name: 'Operations User', role: 'OPERATIONS_USER' }
  });
  const sales = await prisma.user.create({
    data: { email: 'sales@erp.com', passwordHash, name: 'Sales User', role: 'SALES_USER' }
  });

  const locA = await prisma.location.create({ data: { name: 'Main Plant', code: 'LOC-A' } });
  const locB = await prisma.location.create({ data: { name: 'Regional Warehouse', code: 'LOC-B' } });

  const steel = await prisma.item.create({
    data: { sku: 'RAW-STL-01', name: 'Alloy Steel Bars', category: 'Raw Materials' }
  });
  const motor = await prisma.item.create({
    data: { sku: 'CMP-MTR-02', name: 'Servo Motor 500W', category: 'Components' }
  });

  // Main Plant: 100 Physical, 30 Reserved => 70 Available
  await prisma.inventory.create({
    data: { itemId: steel.id, locationId: locA.id, batch: 'B2026-01', physicalQuantity: 100, reservedQuantity: 30 }
  });

  // Regional Warehouse: 150 Physical, 0 Reserved => 150 Available
  await prisma.inventory.create({
    data: { itemId: steel.id, locationId: locB.id, batch: 'B2026-02', physicalQuantity: 150, reservedQuantity: 0 }
  });

  console.log('Seed executed successfully.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());