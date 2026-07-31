import { ShoppingBag, Package, X, Upload, Image as ImageIcon, CheckCircle, ExternalLink } from "lucide-react";
import { useState, useEffect, useRef } from 'react';
import { adminApi } from '@/services/api';
import { useToast } from '@ctx/ToastContext';
import './MarketplaceManager.css';
import '../admin.shared.css';

export default function MarketplaceManager() {
  const showToast = useToast();
  const [activeTab, setActiveTab] = useState('listings');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

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
    accepted_apps: {
      gpay: true,
      phonepe: true,
      paytm: true,
      bhim: true
    }
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

  function handleImageFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WEBP).', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size should be under 5MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setNewItem(prev => ({
        ...prev,
        image_url: event.target.result
      }));
      showToast('Image loaded from device successfully!', 'success');
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setNewItem(prev => ({ ...prev, image_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function togglePaymentApp(appKey) {
    setNewItem(prev => ({
      ...prev,
      accepted_apps: {
        ...prev.accepted_apps,
        [appKey]: !prev.accepted_apps[appKey]
      }
    }));
  }

  async function handleAddListing(e) {
    e.preventDefault();
    if (!newItem.title || !newItem.price) {
      showToast('Title and Price are required.', 'warning');
      return;
    }
    if (!newItem.upi_id && !newItem.bank_account) {
      showToast('Please provide at least one payment method (UPI ID or Bank Account).', 'warning');
      return;
    }

    try {
      await adminApi.createMerchandise({
        ...newItem,
        price: parseFloat(newItem.price),
      });
      showToast('Merchandise item listed successfully with payment apps configured.', 'success');
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
        accepted_apps: { gpay: true, phonepe: true, paytm: true, bhim: true }
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
                      <span className="method-pill pay-apps-pill">
                        <ExternalLink size={10} style={{ marginRight: '3px' }} />
                        GPay / PhonePe / Paytm Enabled
                      </span>
                      {item.bank_account && <span className="method-pill">Bank Linked</span>}
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
          <div className="modal-card" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">List Official Merchandise</h2>
              <button className="modal-close-btn" onClick={() => setShowAddForm(false)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <form onSubmit={handleAddListing}>
              <div className="form-group">
                <label>PRODUCT TITLE</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Official College Hoodie (Black)"
                  value={newItem.title}
                  onChange={e => setNewItem({ ...newItem, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>PRICE (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 799"
                  value={newItem.price}
                  onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                />
              </div>

              {/* ── DEVICE IMAGE SELECTOR ── */}
              <div className="form-group">
                <label>PRODUCT IMAGE (CHOOSE FROM DEVICE)</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageFileSelect}
                />

                {newItem.image_url ? (
                  <div className="device-image-preview-card">
                    <img src={newItem.image_url} alt="Preview" className="device-preview-img" />
                    <div className="preview-info">
                      <span className="preview-status"><CheckCircle size={14} color="#22c55e" /> Image Loaded from Device</span>
                      <button type="button" className="remove-img-btn" onClick={handleRemoveImage}>
                        Remove / Pick Another
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="device-upload-dropzone"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  >
                    <Upload size={28} className="upload-icon" />
                    <p className="upload-text">Click to choose image from your device</p>
                    <span className="upload-hint">Supports PNG, JPG, WEBP (Max 5MB)</span>
                  </div>
                )}
                
                {/* Fallback URL input toggle */}
                <div style={{ marginTop: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Or enter Image URL manually:</span>
                  <input
                    type="url"
                    style={{ marginTop: '0.2rem', fontSize: '0.8rem' }}
                    placeholder="https://example.com/hoodie.jpg"
                    value={newItem.image_url.startsWith('data:') ? '' : newItem.image_url}
                    onChange={e => setNewItem({ ...newItem, image_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>PRODUCT DESCRIPTION</label>
                <textarea
                  rows="3"
                  className="form-textarea-field"
                  placeholder="Material details, size guidelines, custom prints, etc."
                  value={newItem.description}
                  onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                />
              </div>

              {/* ── EXTERNAL PAYMENT APP CONFIGURATION ── */}
              <div className="ad-card payment-setup-card" style={{ marginBottom: '1.25rem', padding: '1.25rem', borderRadius: '1rem' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                  Configure External App & Direct Payments
                </h4>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Students paying for this item will be redirected directly to <strong>Google Pay, PhonePe, Paytm</strong>, or UPI app on their phone/web.
                </p>

                <div className="form-grid-2" style={{ marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>ADMIN / STORE UPI ID (VPA) *</label>
                    <input
                      type="text"
                      placeholder="e.g. campusstore@okicici or 9876543210@paytm"
                      value={newItem.upi_id}
                      onChange={e => setNewItem({ ...newItem, upi_id: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>BANK ACCOUNT DETAILS (OPTIONAL)</label>
                    <input
                      type="text"
                      placeholder="e.g. A/C: 12345, IFSC: SBIN000"
                      value={newItem.bank_account}
                      onChange={e => setNewItem({ ...newItem, bank_account: e.target.value })}
                    />
                  </div>
                </div>

                {/* App Redirect Options Selection */}
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  ENABLED EXTERNAL PAYMENT APPS FOR REDIRECT
                </label>
                <div className="payment-apps-selector-grid">
                  <button
                    type="button"
                    className={`pay-app-chip gpay-chip ${newItem.accepted_apps?.gpay ? 'active' : ''}`}
                    onClick={() => togglePaymentApp('gpay')}
                  >
                    Google Pay (GPay)
                  </button>
                  <button
                    type="button"
                    className={`pay-app-chip phonepe-chip ${newItem.accepted_apps?.phonepe ? 'active' : ''}`}
                    onClick={() => togglePaymentApp('phonepe')}
                  >
                    PhonePe
                  </button>
                  <button
                    type="button"
                    className={`pay-app-chip paytm-chip ${newItem.accepted_apps?.paytm ? 'active' : ''}`}
                    onClick={() => togglePaymentApp('paytm')}
                  >
                    Paytm
                  </button>
                  <button
                    type="button"
                    className={`pay-app-chip bhim-chip ${newItem.accepted_apps?.bhim ? 'active' : ''}`}
                    onClick={() => togglePaymentApp('bhim')}
                  >
                    BHIM / Any UPI App
                  </button>
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

