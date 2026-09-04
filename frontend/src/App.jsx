import React, { useState, useEffect } from 'react';
import { request } from './api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('erp_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('erp_user') || 'null'));
  const [screen, setScreen] = useState('inventory');
  const [error, setError] = useState('');

  // Domain states
  const [inventory, setInventory] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [orders, setOrders] = useState([]);

  // Auth inputs
  const [email, setEmail] = useState('admin@erp.com');
  const [password, setPassword] = useState('password123');

  // Forms
  const [woForm, setWoForm] = useState({ itemId: '', locationId: '', requiredQuantity: '', assignedUserId: '' });
  const [trForm, setTrForm] = useState({ sourceLocationId: '', destinationLocationId: '', itemId: '', batch: '', quantity: '' });
  const [ordForm, setOrdForm] = useState({ itemId: '', locationId: '', batch: '', quantity: '' });

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, screen]);

  const loadData = async () => {
    setError('');
    try {
      if (screen === 'inventory') {
        const data = await request('/inventory');
        setInventory(data);
      } else if (screen === 'workOrders') {
        const data = await request('/work-orders');
        setWorkOrders(data);
      } else if (screen === 'transfers') {
        const data = await request('/transfers');
        setTransfers(data);
      } else if (screen === 'orders') {
        const data = await request('/orders');
        setOrders(data);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('erp_token', res.token);
      localStorage.setItem('erp_user', JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto' }} className="card">
        <h2>Mini Operations ERP Login</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Roles: admin@erp.com, ops@erp.com, sales@erp.com (Pass: password123)
        </p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button style={{ width: '100%' }} type="submit">Sign In</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="header-row">
        <div>
          <h2>Mini Operations ERP</h2>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Logged in as <b>{user.name}</b> ({user.role})
          </span>
        </div>
        <button className="secondary" onClick={handleLogout}>Logout</button>
      </div>

      <div className="nav">
        {['inventory', 'workOrders', 'transfers', 'orders'].map(s => (
          <button key={s} className={screen === s ? 'active' : ''} onClick={() => setScreen(s)}>
            {s === 'inventory' && 'Inventory'}
            {s === 'workOrders' && 'Work Orders'}
            {s === 'transfers' && 'Internal Transfers'}
            {s === 'orders' && 'Customer Orders'}
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {/* Screen 1: Inventory Management */}
      {screen === 'inventory' && (
        <div className="card">
          <h3>Current Inventory</h3>
          <table>
            <thead>
              <tr>
                <th>Item (SKU)</th>
                <th>Category</th>
                <th>Location</th>
                <th>Batch</th>
                <th>Physical</th>
                <th>Reserved</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(inv => (
                <tr key={inv.id}>
                  <td>{inv.itemName} ({inv.itemSku})</td>
                  <td>{inv.category}</td>
                  <td>{inv.locationName}</td>
                  <td>{inv.batch}</td>
                  <td>{inv.physicalQuantity}</td>
                  <td>{inv.reservedQuantity}</td>
                  <td><b>{inv.availableQuantity}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Screen 2: Work Orders & Stock Check */}
      {screen === 'workOrders' && (
        <div>
          {user.role === 'ADMIN' && (
            <div className="card">
              <h3>Create Work Order</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await request('/work-orders', { method: 'POST', body: JSON.stringify(woForm) });
                  setWoForm({ itemId: '', locationId: '', requiredQuantity: '', assignedUserId: '' });
                  loadData();
                } catch (err) { setError(err.message); }
              }}>
                <div className="grid">
                  <input placeholder="Item ID" value={woForm.itemId} onChange={e => setWoForm({...woForm, itemId: e.target.value})} required />
                  <input placeholder="Location ID" value={woForm.locationId} onChange={e => setWoForm({...woForm, locationId: e.target.value})} required />
                  <input type="number" placeholder="Required Quantity" value={woForm.requiredQuantity} onChange={e => setWoForm({...woForm, requiredQuantity: e.target.value})} required />
                  <input placeholder="Assigned User ID" value={woForm.assignedUserId} onChange={e => setWoForm({...woForm, assignedUserId: e.target.value})} required />
                </div>
                <button type="submit">Create Work Order</button>
              </form>
            </div>
          )}
          <div className="card">
            <h3>Work Orders & Shortage Calculation</h3>
            <table>
              <thead>
                <tr>
                  <th>WO Number</th>
                  <th>Item</th>
                  <th>Location</th>
                  <th>Required</th>
                  <th>Available</th>
                  <th>Shortage</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map(wo => (
                  <tr key={wo.id}>
                    <td>{wo.workOrderNumber}</td>
                    <td>{wo.item}</td>
                    <td>{wo.location}</td>
                    <td>{wo.requiredQuantity}</td>
                    <td>{wo.availableAtLocation}</td>
                    <td>
                      {wo.shortage > 0 ? (
                        <span className="badge shortage">Shortage: {wo.shortage}</span>
                      ) : (
                        <span className="badge ok">Stock OK</span>
                      )}
                    </td>
                    <td>{wo.assignedUser}</td>
                    <td><span className="badge status">{wo.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Screen 3: Internal Transfers */}
      {screen === 'transfers' && (
        <div>
          {['ADMIN', 'OPERATIONS_USER'].includes(user.role) && (
            <div className="card">
              <h3>Initiate Internal Stock Transfer</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await request('/transfers', { method: 'POST', body: JSON.stringify(trForm) });
                  setTrForm({ sourceLocationId: '', destinationLocationId: '', itemId: '', batch: '', quantity: '' });
                  loadData();
                } catch (err) { setError(err.message); }
              }}>
                <div className="grid">
                  <input placeholder="Source Location ID" value={trForm.sourceLocationId} onChange={e => setTrForm({...trForm, sourceLocationId: e.target.value})} required />
                  <input placeholder="Destination Location ID" value={trForm.destinationLocationId} onChange={e => setTrForm({...trForm, destinationLocationId: e.target.value})} required />
                  <input placeholder="Item ID" value={trForm.itemId} onChange={e => setTrForm({...trForm, itemId: e.target.value})} required />
                  <input placeholder="Batch" value={trForm.batch} onChange={e => setTrForm({...trForm, batch: e.target.value})} required />
                  <input type="number" placeholder="Quantity" value={trForm.quantity} onChange={e => setTrForm({...trForm, quantity: e.target.value})} required />
                </div>
                <button type="submit">Request Transfer</button>
              </form>
            </div>
          )}
          <div className="card">
            <h3>Stock Transfers</h3>
            <table>
              <thead>
                <tr>
                  <th>Transfer #</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Batch</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(tr => (
                  <tr key={tr.id}>
                    <td>{tr.transferNumber}</td>
                    <td>{tr.sourceLocation?.name || tr.sourceLocationId}</td>
                    <td>{tr.destinationLocation?.name || tr.destinationLocationId}</td>
                    <td>{tr.batch}</td>
                    <td>{tr.quantity}</td>
                    <td><span className="badge status">{tr.status}</span></td>
                    <td>
                      {tr.status === 'REQUESTED' && ['ADMIN', 'OPERATIONS_USER'].includes(user.role) && (
                        <button onClick={async () => {
                          try {
                            await request(`/transfers/${tr.id}/dispatch`, { method: 'POST' });
                            loadData();
                          } catch (err) { setError(err.message); }
                        }}>Dispatch</button>
                      )}
                      {tr.status === 'DISPATCHED' && ['ADMIN', 'OPERATIONS_USER'].includes(user.role) && (
                        <button onClick={async () => {
                          try {
                            await request(`/transfers/${tr.id}/receive`, { method: 'POST' });
                            loadData();
                          } catch (err) { setError(err.message); }
                        }}>Receive</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Screen 4: Customer Orders & Reservation */}
      {screen === 'orders' && (
        <div>
          {['ADMIN', 'SALES_USER'].includes(user.role) && (
            <div className="card">
              <h3>Reserve Customer Order</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await request('/orders', { method: 'POST', body: JSON.stringify(ordForm) });
                  setOrdForm({ itemId: '', locationId: '', batch: '', quantity: '' });
                  loadData();
                } catch (err) { setError(err.message); }
              }}>
                <div className="grid">
                  <input placeholder="Item ID" value={ordForm.itemId} onChange={e => setOrdForm({...ordForm, itemId: e.target.value})} required />
                  <input placeholder="Location ID" value={ordForm.locationId} onChange={e => setOrdForm({...ordForm, locationId: e.target.value})} required />
                  <input placeholder="Batch" value={ordForm.batch} onChange={e => setOrdForm({...ordForm, batch: e.target.value})} required />
                  <input type="number" placeholder="Quantity" value={ordForm.quantity} onChange={e => setOrdForm({...ordForm, quantity: e.target.value})} required />
                </div>
                <button type="submit">Place Order & Reserve</button>
              </form>
            </div>
          )}
          <div className="card">
            <h3>Customer Orders</h3>
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Location</th>
                  <th>Batch</th>
                  <th>Quantity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(ord => (
                  <tr key={ord.id}>
                    <td>{ord.orderNumber}</td>
                    <td>{ord.location?.name || ord.locationId}</td>
                    <td>{ord.batch}</td>
                    <td>{ord.quantity}</td>
                    <td><span className="badge ok">{ord.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}