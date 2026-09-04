const express = require('express');
const prisma = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/inventory - Viewable by all authenticated users
router.get('/', authenticate, async (req, res) => {
  try {
    const inventories = await prisma.inventory.findMany({
      include: { item: true, location: true },
      orderBy: { updatedAt: 'desc' }
    });

    const transformed = inventories.map(inv => ({
      id: inv.id,
      itemId: inv.itemId,
      itemSku: inv.item.sku,
      itemName: inv.item.name,
      category: inv.item.category,
      locationId: inv.locationId,
      locationName: inv.location.name,
      batch: inv.batch,
      physicalQuantity: inv.physicalQuantity,
      reservedQuantity: inv.reservedQuantity,
      availableQuantity: inv.physicalQuantity - inv.reservedQuantity
    }));

    res.json(transformed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory - Adjust or add physical stock (Operations or Admin)
router.post('/stock-in', authenticate, authorize(['ADMIN', 'OPERATIONS_USER']), async (req, res) => {
  const { itemId, locationId, batch, quantity } = req.body;
  if (!itemId || !locationId || !batch || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Valid itemId, locationId, batch, and quantity (>0) required' });
  }

  try {
    const result = await prisma.inventory.upsert({
      where: {
        itemId_locationId_batch: { itemId, locationId, batch }
      },
      update: {
        physicalQuantity: { increment: parseInt(quantity) }
      },
      create: {
        itemId,
        locationId,
        batch,
        physicalQuantity: parseInt(quantity),
        reservedQuantity: 0
      }
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;