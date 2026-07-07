/**
 * StudentSphere – Student Marketplace Logic
 * File: marketplaceStudent.js
 */

(function () {
  'use strict';

  if (!window.StudentSphere || !window.StudentSphere.user) {
    return;
  }

  var user = window.StudentSphere.user;
  var showToast = window.StudentSphere.showToast;
  window.StudentSphere.init('marketplace');

  /* ─────────────────────────────────────────────
     1. INITIALIZE MARKETPLACE ITEMS
  ───────────────────────────────────────────── */
  var listings = [
    {
      id: 1,
      title: 'Calculus: Early Transcendentals (Stewart)',
      price: 350,
      category: 'textbook',
      seller: 'Rahul Verma',
      contact: '9876543210',
      desc: 'Semester 1 textbook. Excellent condition, no pencil markings or highlightings.'
    },
    {
      id: 2,
      title: 'Standard White Lab Coat (Size M)',
      price: 150,
      category: 'lab',
      seller: 'Priya Patel',
      contact: '9812345670',
      desc: 'Only used for Chemistry lab in Sem 2. Freshly dry-cleaned.'
    },
    {
      id: 3,
      title: 'Casio fx-991EX Scientific Calculator',
      price: 650,
      category: 'electronics',
      seller: 'Amit Sen',
      contact: '9908877665',
      desc: 'Classwiz series with solar power. Fully functional, including box and manual.'
    },
    {
      id: 4,
      title: 'Engineering Mini Drafter & Board',
      price: 800,
      category: 'lab',
      seller: 'Siddharth Roy',
      contact: '9554433221',
      desc: 'Standard drafting machine for Engineering Graphics class. Includes carry bag.'
    }
  ];

  var activeCategory = 'all';

  /* ─────────────────────────────────────────────
     2. RENDER LISTINGS
  ───────────────────────────────────────────── */
  var grid = document.getElementById('listingsGrid');

  function renderListings() {
    if (!grid) return;

    var filtered = listings.filter(function (item) {
      if (activeCategory === 'all') return true;
      return item.category === activeCategory;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="color:var(--clr-muted);text-align:center;grid-column:1/-1;padding:3rem 0;font-size:0.85rem;">No listings found. Be the first to sell!</div>';
      return;
    }

    grid.innerHTML = filtered.map(function (item) {
      var bannerClass = 'listing-banner';
      if (item.category === 'textbook') bannerClass += ' textbook';
      if (item.category === 'lab') bannerClass += ' lab';
      if (item.category === 'electronics') bannerClass += ' electronics';

      return (
        '<div class="listing-card" data-id="' + item.id + '">' +
          '<div class="' + bannerClass + '">' +
            '<span class="listing-category-tag">' + item.category + '</span>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">' +
              '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>' +
            '</svg>' +
            '<span class="listing-price-badge">\u20b9' + item.price + '</span>' +
          '</div>' +
          '<div class="listing-body">' +
            '<h3 class="listing-title">' + esc(item.title) + '</h3>' +
            '<p class="listing-desc">' + esc(item.desc) + '</p>' +
            '<div class="listing-seller-info">' +
              '<span>Seller: ' + esc(item.seller) + '</span>' +
              '<span>Contact: ' + esc(item.contact) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="listing-footer">' +
            '<button class="listing-btn">Contact Seller</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Bind buy click
    grid.querySelectorAll('.listing-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.listing-card');
        var id = parseInt(card.getAttribute('data-id'), 10);
        handlePurchase(id);
      });
    });
  }

  function handlePurchase(id) {
    for (var i = 0; i < listings.length; i++) {
      if (listings[i].id === id) {
        var item = listings[i];
        showToast('Notification request sent to ' + item.seller + ' (' + item.contact + ') for: ' + item.title, 'success', 4000);
        return;
      }
    }
  }

  function esc(val) {
    if (val === undefined || val === null) return '';
    return String(val)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  /* ─────────────────────────────────────────────
     3. FILTERS & SEARCH
  ───────────────────────────────────────────── */
  var filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeCategory = btn.getAttribute('data-category');
      renderListings();
    });
  });

  /* ─────────────────────────────────────────────
     4. SELL MODAL CONTROLLERS
  ───────────────────────────────────────────── */
  var sellModal = document.getElementById('sellModalOverlay');
  var openModalBtn = document.getElementById('openSellModalBtn');
  var closeModalBtn = document.getElementById('closeModalBtn');
  var cancelModalBtn = document.getElementById('cancelModalBtn');
  var sellForm = document.getElementById('sellItemForm');

  if (openModalBtn && sellModal) {
    openModalBtn.addEventListener('click', function () {
      sellModal.classList.add('active');
    });
  }

  function hideModal() {
    if (sellModal) {
      sellModal.classList.remove('active');
    }
    if (sellForm) {
      sellForm.reset();
    }
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', hideModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', hideModal);

  if (sellForm) {
    sellForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var title = document.getElementById('itemTitle').value.trim();
      var price = parseInt(document.getElementById('itemPrice').value.trim(), 10);
      var category = document.getElementById('itemCategory').value;
      var contact = document.getElementById('itemContact').value.trim();
      var desc = document.getElementById('itemDesc').value.trim();

      if (!title || isNaN(price) || !contact || !desc) {
        showToast('Please fill all mandatory listing details.', 'error', 3000);
        return;
      }

      var newItem = {
        id: listings.length + 1,
        title: title,
        price: price,
        category: category,
        seller: user.name,
        contact: contact,
        desc: desc
      };

      listings.unshift(newItem); // Add to top
      hideModal();
      showToast('Item listed for sale successfully!', 'success', 3000);
      renderListings();
    });
  }

  // Initial render
  renderListings();

}());
