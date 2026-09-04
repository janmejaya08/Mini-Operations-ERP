const express = require('express');
const prisma = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/work-orders
router.get('/', authenticate, async (req, res) => {
  try {
    const workOrders = await prisma.workOrder.findMany({
      include: { item: true, location: true, assignedUser: true },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate shortage dynamically based on current available stock at target location
    const enriched = await Promise.all(
      workOrders.map(async (wo) => {
        const stocks = await prisma.inventory.findMany({
          where: { itemId: wo.itemId, locationId: wo.locationId }
        });
        const totalAvailable = stocks.reduce(
          (acc, curr) => acc + (curr.physicalQuantity - curr.reservedQuantity),
          0
        );
        const shortage = Math.max(0, wo.requiredQuantity - totalAvailable);

        return {
          id: wo.id,
          workOrderNumber: wo.workOrderNumber,
          item: wo.item.name,
          itemId: wo.itemId,
          location: wo.location.name,
          locationId: wo.locationId,
          requiredQuantity: wo.requiredQuantity,
          availableAtLocation: totalAvailable,
          shortage,
          assignedUser: wo.assignedUser.name,
          assignedUserId: wo.assignedUserId,
          status: wo.status
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/work-orders - Only Admin can create
router.post('/', authenticate, authorize(['ADMIN']), async (req, res) => {
  const { itemId, locationId, requiredQuantity, assignedUserId } = req.body;
  const qty = parseInt(requiredQuantity);

  if (!itemId || !locationId || !assignedUserId || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Valid parameters and quantity (>0) required' });
  }

  try {
    const workOrderNumber = `WO-${Date.now()}`;
    const workOrder = await prisma.workOrder.create({
      data: {
        workOrderNumber,
        itemId,
        locationId,
        requiredQuantity: qty,
        assignedUserId,
        status: 'ASSIGNED'
      }
    });
    res.status(201).json(workOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/work-orders/:id/status
router.patch('/:id/status', authenticate, authorize(['ADMIN', 'OPERATIONS_USER']), async (req, res) => {
  const { status } = req.body;
  if (!['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const updated = await prisma.workOrder.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;