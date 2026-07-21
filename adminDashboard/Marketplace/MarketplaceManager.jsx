import { ShoppingBag, Package, X } from "lucide-react";
import { useState, useEffect } from 'react';
import { adminApi } from '@/services/api';
import { useToast } from '@ctx/ToastContext';
import './MarketplaceManager.css';
import '../admin.shared.css';

export default function MarketplaceManager() {
  const showToast = useToast();
  const [activeTab, setActiveTab] = useState('listings');
  const [loading, setLoading] = useState(false);

  // Listings State
  const [listings, setListings] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    price: '',
    description: '',
    image_url: '',
    upi_id: '',
    bank_account: '',
  });

  // Orders State
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (activeTab === 'listings') {
      fetchListings();
    } else if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [activeTab]);

  async function fetchListings() {
    setLoading(true);
    try {
      const res = await adminApi.getMerchandise();
      // Filter listings to display only admin-owned official store items
      const adminItems = (res.merchandise || []).filter(i => i.seller_role === 'admin');
      setListings(adminItems);
    } catch (err) {
      showToast(err.message || 'Failed to fetch merchandise catalog.', 'error');
    }
    setLoading(false);
  }

  async function fetchOrders() {
    setLoading(true);
    try {
      const res = await adminApi.getMerchandiseOrders();
      setOrders(res.orders || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch customer orders.', 'error');
    }
    setLoading(false);
  }

  async function handleAddListing(e) {
    e.preventDefault();
    if (!newItem.title || !newItem.price) {
      showToast('Title and Price are required.', 'warning');
      return;
    }
    if (!newItem.upi_id && !newItem.bank_account) {
      showToast('Please provide at least one payment method (UPI or Bank account).', 'warning');
      return;
    }

    try {
      await adminApi.createMerchandise({
        ...newItem,
        price: parseFloat(newItem.price),
      });
      showToast('Merchandise item listed successfully.', 'success');
      setShowAddForm(false);
      fetchListings();
      // Reset Form
      setNewItem({
        title: '',
        price: '',
        description: '',
        image_url: '',
        upi_id: '',
        bank_account: '',
      });
    } catch (err) {
      showToast(err.message || 'Failed to list item.', 'error');
    }
  }

  async function handleUpdateOrderStatus(orderId, newStatus) {
    try {
      await adminApi.updateMerchandiseOrder(orderId, { status: newStatus });
      showToast(`Order status updated to ${newStatus}.`, 'success');
      fetchOrders();
    } catch (err) {
      showToast(err.message || 'Failed to update order status.', 'error');
    }
  }

  return (
    <div className="ad-root marketplace-manager-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Merchandise Store & Marketplace</h1>
          <p className="page-sub">Sell official campus merchandise, manage payment details, and fulfill orders.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-nav-wrapper">
        <button
          className={`tab-nav-btn ${activeTab === 'listings' ? 'active' : ''}`}
          onClick={() => setActiveTab('listings')}
        >
          My Listed Merchandise
        </button>
        <button
          className={`tab-nav-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Merchandise Orders
          {orders.filter(o => o.status === 'pending').length > 0 && (
            <span className="badge-count-pill">
              {orders.filter(o => o.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {loading && (
        <div className="loading-spinner-wrapper">
          <div className="ad-spinner"></div>
          <span>Loading catalog details…</span>
        </div>
      )}

      {/* ── TAB CONTENT: CATALOG LISTINGS ── */}
      {!loading && activeTab === 'listings' && (
        <div className="listings-tab-content">
          <div className="ad-card control-filters-card" style={{ padding: '1rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                You are managing the <strong>Official Admin Merchandise catalog</strong>. Students can purchase items directly.
              </p>
              <button className="pd-btn pd-btn-primary" onClick={() => setShowAddForm(true)}>
                + List New Merchandise
              </button>
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="empty-state-layout">
              <span className="empty-icon"><ShoppingBag size={32} aria-hidden="true" /></span>
              <p>No official merchandise listed yet. Click button above to add items.</p>
            </div>
          ) : (
            <div className="merch-products-grid">
              {listings.map(item => (
                <div className="merch-product-card" key={item.id}>
                  <div className="merch-image-wrapper">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} />
                    ) : (
                      <div className="merch-image-placeholder">No Image Available</div>
                    )}
                  </div>
                  <div className="merch-card-body">
                    <h3 className="merch-title">{item.title}</h3>
                    <p className="merch-desc">{item.description || 'No description provided.'}</p>
                    <div className="merch-payment-methods">
                      {item.upi_id && <span className="method-pill">UPI: {item.upi_id}</span>}
                      {item.bank_account && <span className="method-pill">Bank Account Linked</span>}
                    </div>
                    <div className="merch-footer">
                      <span className="merch-price">₹{parseFloat(item.price).toFixed(2)}</span>
                      <span className="merch-badge-role">Official</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB CONTENT: CUSTOMER ORDERS ── */}
      {!loading && activeTab === 'orders' && (
        <div className="orders-tab-content">
          <div className="ad-card">
            <div className="ad-card-header">
              <h2 className="ad-card-title">Merchandise Purchase Requests</h2>
            </div>
            {orders.length === 0 ? (
              <div className="empty-state-layout">
                <span className="empty-icon"><Package size={32} aria-hidden="true" /></span>
                <p>No customer orders placed yet.</p>
              </div>
            ) : (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Total Amount</th>
                      <th>Buyer Email</th>
                      <th>Payment Reference</th>
                      <th>Fulfillment Status</th>
                      <th>Shipping Address</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.id}>
                        <td><strong>{order.item_title}</strong></td>
                        <td>{order.quantity}</td>
                        <td><strong>₹{parseFloat(order.total_price).toFixed(2)}</strong></td>
                        <td>{order.buyer_email}</td>
                        <td><code className="pay-ref-pill">{order.payment_reference}</code></td>
                        <td>
                          <span className={`status-badge-pill status-${order.status.toLowerCase()}`}>
                            {order.status}
                          </span>
                        </td>
                        <td style={{ maxWidth: '200px', whiteSpace: 'normal', fontSize: '0.8rem' }}>
                          {order.shipping_address}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <select
                            className="status-update-select"
                            value={order.status}
                            onChange={e => handleUpdateOrderStatus(order.id, e.target.value)}
                          >
                            <option value="pending">Pending</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="fulfilled">Fulfilled</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADD MERCHANDISE MODAL FORM ── */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">List Official Merchandise</h2>
              <button className="modal-close-btn" onClick={() => setShowAddForm(false)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <form onSubmit={handleAddListing}>
              <div className="form-group">
                <label>Product Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Official College Hoodie (Black)"
                  value={newItem.title}
                  onChange={e => setNewItem({ ...newItem, title: e.target.value })}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Price (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 799"
                    value={newItem.price}
                    onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Image URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/ hoodie.jpg"
                    value={newItem.image_url}
                    onChange={e => setNewItem({ ...newItem, image_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Product Description</label>
                <textarea
                  rows="3"
                  className="form-textarea-field"
                  placeholder="Material details, size guidelines, custom prints, etc."
                  value={newItem.description}
                  onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                />
              </div>

              <div className="ad-card payment-setup-card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Configure Direct Payment Methods
                </h4>
                <div className="form-grid-2" style={{ marginBottom: 0 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>UPI ID</label>
                    <input
                      type="text"
                      placeholder="e.g. campusstore@upi"
                      value={newItem.upi_id}
                      onChange={e => setNewItem({ ...newItem, upi_id: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Bank Account details</label>
                    <input
                      type="text"
                      placeholder="e.g. A/C: 12345, IFSC: SBIN000"
                      value={newItem.bank_account}
                      onChange={e => setNewItem({ ...newItem, bank_account: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="pd-btn pd-btn-outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="pd-btn pd-btn-primary">
                  Publish Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
