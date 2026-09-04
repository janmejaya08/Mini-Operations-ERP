const express = require('express');
const prisma = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/orders
router.get('/', authenticate, async (req, res) => {
  try {
    const orders = await prisma.customerOrder.findMany({
      include: { item: true, location: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders - Sales User or Admin can create and reserve
// Uses ACID transaction with concurrency checks to prevent overselling
router.post('/', authenticate, authorize(['ADMIN', 'SALES_USER']), async (req, res) => {
  const { itemId, locationId, batch, quantity } = req.body;
  const qty = parseInt(quantity);

  if (!itemId || !locationId || !batch || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Valid itemId, locationId, batch, and quantity > 0 required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({
        where: {
          itemId_locationId_batch: { itemId, locationId, batch }
        }
      });

      if (!inv) {
        throw new Error('Inventory batch does not exist at designated location');
      }

      const available = inv.physicalQuantity - inv.reservedQuantity;
      if (qty > available) {
        throw new Error(`Insufficient inventory: Required ${qty}, Available: ${available}`);
      }

      // Reserve stock atomically
      await tx.inventory.update({
        where: { id: inv.id },
        data: { reservedQuantity: { increment: qty } }
      });

      const order = await tx.customerOrder.create({
        data: {
          orderNumber: `ORD-${Date.now()}`,
          itemId,
          locationId,
          batch,
          quantity: qty,
          status: 'RESERVED'
        }
      });

      return order;
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;