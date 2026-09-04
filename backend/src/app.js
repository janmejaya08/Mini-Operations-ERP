const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const workOrderRoutes = require('./routes/workOrders');
const transferRoutes = require('./routes/transfers');
const customerOrderRoutes = require('./routes/customerOrders');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/orders', customerOrderRoutes);

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`ERP Backend operating on port ${PORT}`));
}

module.exports = app;