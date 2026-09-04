const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const bcrypt = require('bcryptjs');

let adminToken, salesToken, opsToken;
let steelItem, locA, locB;

beforeAll(async () => {
  await prisma.customerOrder.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.item.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();

  const pw = await bcrypt.hash('pass123', 10);
  const admin = await prisma.user.create({ data: { email: 'admin@t.com', passwordHash: pw, name: 'A', role: 'ADMIN' } });
  const ops = await prisma.user.create({ data: { email: 'ops@t.com', passwordHash: pw, name: 'O', role: 'OPERATIONS_USER' } });
  const sales = await prisma.user.create({ data: { email: 'sales@t.com', passwordHash: pw, name: 'S', role: 'SALES_USER' } });

  const aRes = await request(app).post('/api/auth/login').send({ email: 'admin@t.com', password: 'pass123' });
  adminToken = aRes.body.token;

  const oRes = await request(app).post('/api/auth/login').send({ email: 'ops@t.com', password: 'pass123' });
  opsToken = oRes.body.token;

  const sRes = await request(app).post('/api/auth/login').send({ email: 'sales@t.com', password: 'pass123' });
  salesToken = sRes.body.token;

  locA = await prisma.location.create({ data: { name: 'Site A', code: 'SA' } });
  locB = await prisma.location.create({ data: { name: 'Site B', code: 'SB' } });
  steelItem = await prisma.item.create({ data: { sku: 'TEST-SKU', name: 'Test Steel', category: 'Raw' } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('ERP Mandatory Technical Validations', () => {

  beforeEach(async () => {
    await prisma.customerOrder.deleteMany();
    await prisma.stockTransfer.deleteMany();
    await prisma.inventory.deleteMany();

    // Baseline: Loc A has 100 Physical, 30 Reserved (70 Available)
    await prisma.inventory.create({
      data: {
        itemId: steelItem.id,
        locationId: locA.id,
        batch: 'B1',
        physicalQuantity: 100,
        reservedQuantity: 30
      }
    });
  });

  // Test 1: Cannot reserve more than available inventory
  test('Test 1: Cannot reserve more than available inventory', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        itemId: steelItem.id,
        locationId: locA.id,
        batch: 'B1',
        quantity: 80 // Only 70 is available (100 - 30)
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient inventory/);

    // Verify database state was preserved
    const inv = await prisma.inventory.findFirst({ where: { batch: 'B1' } });
    expect(inv.reservedQuantity).toBe(30);
  });

  // Test 2: Cannot transfer more than available inventory
  test('Test 2: Cannot transfer more than available inventory', async () => {
    // Create transfer for 90 units (Available is only 70)
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        sourceLocationId: locA.id,
        destinationLocationId: locB.id,
        itemId: steelItem.id,
        batch: 'B1',
        quantity: 90
      });

    const transferId = createRes.body.id;

    const dispatchRes = await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', `Bearer ${opsToken}`);

    expect(dispatchRes.status).toBe(400);
    expect(dispatchRes.body.error).toMatch(/Insufficient available stock at source/);
  });

  // Test 3: Destination stock increases only after transfer receipt
  test('Test 3: Destination stock increases only after transfer receipt', async () => {
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        sourceLocationId: locA.id,
        destinationLocationId: locB.id,
        itemId: steelItem.id,
        batch: 'B1',
        quantity: 40
      });
    const transferId = createRes.body.id;

    // Dispatch
    await request(app)
      .post(`/api/transfers/${transferId}/dispatch`)
      .set('Authorization', `Bearer ${opsToken}`);

    // Check destination stock immediately after dispatch: MUST be 0
    let destInv = await prisma.inventory.findUnique({
      where: { itemId_locationId_batch: { itemId: steelItem.id, locationId: locB.id, batch: 'B1' } }
    });
    expect(destInv).toBeNull();

    // Source must be reduced from 100 to 60
    let srcInv = await prisma.inventory.findUnique({
      where: { itemId_locationId_batch: { itemId: steelItem.id, locationId: locA.id, batch: 'B1' } }
    });
    expect(srcInv.physicalQuantity).toBe(60);

    // Receive
    const receiveRes = await request(app)
      .post(`/api/transfers/${transferId}/receive`)
      .set('Authorization', `Bearer ${opsToken}`);

    expect(receiveRes.status).toBe(200);

    // Destination stock must now reflect the received 40 units
    destInv = await prisma.inventory.findUnique({
      where: { itemId_locationId_batch: { itemId: steelItem.id, locationId: locB.id, batch: 'B1' } }
    });
    expect(destInv.physicalQuantity).toBe(40);
  });

  // Test 4: Same transfer cannot be received twice
  test('Test 4: Same transfer cannot be received twice', async () => {
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        sourceLocationId: locA.id,
        destinationLocationId: locB.id,
        itemId: steelItem.id,
        batch: 'B1',
        quantity: 20
      });
    const transferId = createRes.body.id;

    await request(app).post(`/api/transfers/${transferId}/dispatch`).set('Authorization', `Bearer ${opsToken}`);
    const firstReceive = await request(app).post(`/api/transfers/${transferId}/receive`).set('Authorization', `Bearer ${opsToken}`);
    expect(firstReceive.status).toBe(200);

    // Second receive attempt
    const secondReceive = await request(app).post(`/api/transfers/${transferId}/receive`).set('Authorization', `Bearer ${opsToken}`);
    expect(secondReceive.status).toBe(400);
    expect(secondReceive.body.error).toMatch(/Duplicate receipt forbidden/);
  });

  // Test 5: Unauthorized user cannot perform restricted operation
  test('Test 5: Unauthorized user cannot perform restricted operation', async () => {
    // Sales User attempting to create a Work Order (Restricted to ADMIN)
    const res = await request(app)
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        itemId: steelItem.id,
        locationId: locA.id,
        requiredQuantity: 10,
        assignedUserId: 'any-id'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Access denied/);
  });
});