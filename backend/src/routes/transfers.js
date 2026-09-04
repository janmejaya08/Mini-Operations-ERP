const express = require('express');
const prisma = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/transfers
router.get('/', authenticate, async (req, res) => {
  try {
    const transfers = await prisma.stockTransfer.findMany({
      include: { sourceLocation: true, destinationLocation: true, item: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(transfers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transfers - Operations User or Admin
router.post('/', authenticate, authorize(['ADMIN', 'OPERATIONS_USER']), async (req, res) => {
  const { sourceLocationId, destinationLocationId, itemId, batch, quantity } = req.body;
  const qty = parseInt(quantity);

  if (!sourceLocationId || !destinationLocationId || !itemId || !batch || !qty || qty <= 0) {
    return res.status(400).json({ error: 'All fields and quantity > 0 required' });
  }

  if (sourceLocationId === destinationLocationId) {
    return res.status(400).json({ error: 'Source and Destination cannot be the same' });
  }

  try {
    const transfer = await prisma.stockTransfer.create({
      data: {
        transferNumber: `TR-${Date.now()}`,
        sourceLocationId,
        destinationLocationId,
        itemId,
        batch,
        quantity: qty,
        status: 'REQUESTED'
      }
    });
    res.status(201).json(transfer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transfers/:id/dispatch
// Source physical stock reduces atomically
router.post('/:id/dispatch', authenticate, authorize(['ADMIN', 'OPERATIONS_USER']), async (req, res) => {
  const transferId = req.params.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({ where: { id: transferId } });
      if (!transfer) throw new Error('Transfer not found');
      if (transfer.status !== 'REQUESTED') {
        throw new Error(`Cannot dispatch transfer with status: ${transfer.status}`);
      }

      const sourceInv = await tx.inventory.findUnique({
        where: {
          itemId_locationId_batch: {
            itemId: transfer.itemId,
            locationId: transfer.sourceLocationId,
            batch: transfer.batch
          }
        }
      });

      if (!sourceInv) throw new Error('Source inventory record not found');
      const available = sourceInv.physicalQuantity - sourceInv.reservedQuantity;
      if (available < transfer.quantity) {
        throw new Error(`Insufficient available stock at source. Available: ${available}, Needed: ${transfer.quantity}`);
      }

      // Deduct source physical inventory
      await tx.inventory.update({
        where: { id: sourceInv.id },
        data: { physicalQuantity: { decrement: transfer.quantity } }
      });

      // Update transfer status
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: { status: 'DISPATCHED' }
      });

      return updatedTransfer;
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/transfers/:id/receive
// Destination physical stock increases; guarded against replay/double-receive
router.post('/:id/receive', authenticate, authorize(['ADMIN', 'OPERATIONS_USER']), async (req, res) => {
  const transferId = req.params.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({ where: { id: transferId } });
      if (!transfer) throw new Error('Transfer not found');
      if (transfer.status === 'RECEIVED') {
        throw new Error('Duplicate receipt forbidden: Transfer has already been received');
      }
      if (transfer.status !== 'DISPATCHED') {
        throw new Error(`Cannot receive transfer that is in status: ${transfer.status}`);
      }

      // Increment destination inventory atomically
      await tx.inventory.upsert({
        where: {
          itemId_locationId_batch: {
            itemId: transfer.itemId,
            locationId: transfer.destinationLocationId,
            batch: transfer.batch
          }
        },
        update: {
          physicalQuantity: { increment: transfer.quantity }
        },
        create: {
          itemId: transfer.itemId,
          locationId: transfer.destinationLocationId,
          batch: transfer.batch,
          physicalQuantity: transfer.quantity,
          reservedQuantity: 0
        }
      });

      const updated = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: { status: 'RECEIVED' }
      });

      return updated;
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;