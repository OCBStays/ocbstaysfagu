console.log('🟢 guest script.js loaded');

const config = {
  apiBaseUrl: 'https://railway-production-1577.up.railway.app/api',
  menuUrl: 'https://ocbstays.github.io/ocbstaysfagu/guest/menu.html'
};

let currentGuest = null;
let currentGuestID = null;
let currentRoom = null;
let currentOrders = [];

// ---------- Generic helpers ----------

function formatDateTime(dateStr) {
  if (!dateStr) return 'Not available';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(dateStr) {
  if (!dateStr) return 'Not available';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function rupee(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toFixed(2)}`;
}

// ---------- DOM helper actions ----------

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/*function toggleCollapse(id) {
  const content = document.getElementById(id);
  const icon = document.getElementById('guestDetailsToggle');
  if (!content) return;
  const isVisible = content.style.display === 'block';
  content.style.display = isVisible ? 'none' : 'block';
  if (icon) {
    icon.classList.toggle('fa-chevron-down', isVisible);
    icon.classList.toggle('fa-chevron-up', !isVisible);
  }
}*/

function toggleCollapse(id) {
  const content = document.getElementById(id);
  const icon = document.getElementById('guestDetailsToggle');
  if (!content) return;

  const isExpanded = content.classList.contains('expanded');

  if (isExpanded) {
    content.classList.remove('expanded');
    if (icon) icon.classList.remove('expanded');
  } else {
    content.classList.add('expanded');
    if (icon) icon.classList.add('expanded');
  }
}


function makeCall(number) {
  if (!number) return;
  window.location.href = `tel:${number}`;
}

function openWhatsApp(number) {
  if (!number) return;
  const text = encodeURIComponent('Hi, I am staying at OCB Stays and need some help.');
  window.open(`https://wa.me/${number.replace('+', '')}?text=${text}`, '_blank');
}

function openLocation(key) {
  let url = '';
  switch (key) {
    case 'fagu':
      url = 'https://www.google.com/maps/search/?api=1&query=Fagu%20Himachal%20Pradesh';
      break;
    case 'cheog':
      url = 'https://www.google.com/maps/search/?api=1&query=Cheog%20Market%20Himachal%20Pradesh';
      break;
    case 'temple':
      url = 'https://www.google.com/maps/search/?api=1&query=Banga%20Pani%20Temple%20Cheog';
      break;
    case 'property':
      url = 'https://www.google.com/maps/search/?api=1&query=OCB%20Stays%20Fagu%20Cottage';
      break;
    default:
      url = 'https://www.google.com/maps/search/?api=1&query=Fagu%20Himachal%20Pradesh';
  }
  window.open(url, '_blank');
}

function openAllLocations() {
  // Simple all-locations view: open Fagu area; you can replace with your custom MyMaps link
  window.open('https://www.google.com/maps/search/?api=1&query=OCB%20Stays%20Fagu', '_blank');
}

// Footer nav smooth-scroll & active state
function initFooterNav() {
  const tabs = document.querySelectorAll('.footer-nav .nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const href = tab.getAttribute('href');
      if (href && href.startsWith('#')) {
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

// Wi-Fi copy button
function initWifiButton() {
  const btn = document.getElementById('connectWifiBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('OCBStays123');
      alert('Wi-Fi password copied to clipboard: OCBStays123');
    } catch (err) {
      console.error('Clipboard error:', err);
      alert('Wi-Fi password: OCBStays123');
    }
  });
}

// ---------- API calls ----------

async function apiGet(path) {
  const url = `${config.apiBaseUrl}${path}`;
  console.log('🌐 GET', url);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function apiPut(path, body) {
  const url = `${config.apiBaseUrl}${path}`;
  console.log('🌐 PUT', url, body);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PUT ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ---------- Guest + Orders + Bill ----------

async function loadGuestDetails() {
  const params = new URLSearchParams(window.location.search);
  const guestID = params.get('guestID');
  const room = params.get('room');

  currentGuestID = guestID || null;
  currentRoom = room || null;

  if (!guestID) {
    setText('guestName', 'Guest (ID missing)');
    setText('room', room || 'Not specified');
    setText('guestID', 'N/A');
    setText('checkin', 'N/A');
    document.getElementById('billDetails').innerHTML =
      '<p>Please open the link shared by your host, it should contain a <code>guestID</code> parameter.</p>';
    return;
  }

  try {
    const guest = await apiGet(`/guests/by-guest-id/${encodeURIComponent(guestID)}`);
    currentGuest = guest;

    const displayName = guest.name || 'Guest';
    setText('welcomeMessage', `Welcome to OCB Stays 🌲, ${displayName}`);
    setText('guestName', displayName);
    setText('room', guest.room || room || 'Not specified');
    setText('guestID', guest.guestID || guestID);
    setText('checkin', formatDate(guest.checkin));

    // Also update menu button link (for safety)
    initMenuButton();

  } catch (err) {
    console.error('Error loading guest:', err);
    setText('guestName', 'Guest not found');
    setText('room', room || 'Not found');
    setText('guestID', currentGuestID);
    setText('checkin', 'Not found');
    document.getElementById('billDetails').innerHTML =
      '<p class="text-danger">We could not find your booking. Please contact the host.</p>';
  }
}

async function loadOrders() {
  const list = document.getElementById('ordersList');
  if (!list) return;

  if (!currentGuestID) {
    list.innerHTML = '<p>Orders will appear here once your guest link has a valid guestID.</p>';
    return;
  }

  try {
    list.innerHTML = '<p>Loading your orders...</p>';
    const orders = await apiGet(`/orders?guest=${encodeURIComponent(currentGuestID)}`);
    currentOrders = orders || [];

    if (!currentOrders.length) {
      list.innerHTML = '<p class="text-muted">No orders placed yet. Use the button above to view the menu.</p>';
      return;
    }

    currentOrders.sort((a, b) => {
      const d1 = new Date(a.OrderDate || a.created_at || 0).getTime();
      const d2 = new Date(b.OrderDate || b.created_at || 0).getTime();
      return d2 - d1;
    });

    const html = currentOrders.map(order => {
      const status = order.Status || 'Pending';
      const dateStr = formatDateTime(order.OrderDate || order.created_at);
      const total = rupee(order.TotalAmount || 0);
      const badgeClass =
        status === 'Delivered' ? 'bg-success' :
        status === 'Cancelled' ? 'bg-secondary' :
        'bg-warning';

      return `
        <div class="order-card mb-2 p-2 border rounded" data-order-id="${order.OrderID}">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <strong>Order #${order.OrderID}</strong><br>
              <small>${dateStr}</small>
            </div>
            <div class="text-end">
              <span class="badge ${badgeClass}">${status}</span><br>
              <small>${total}</small>
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.innerHTML = html;

    // Attach click handlers for each order card
    document.querySelectorAll('.order-card').forEach(card => {
      card.addEventListener('click', () => {
        const orderID = card.getAttribute('data-order-id');
        const order = currentOrders.find(o => String(o.OrderID) === String(orderID));
        if (order) {
          openOrderModal(order);
        }
      });
    });

  } catch (err) {
    console.error('Error loading orders:', err);
    list.innerHTML = '<p class="text-danger">Failed to load your orders. Please try again later.</p>';
  }
}

function parseItems(itemsField) {
  if (!itemsField) return [];
  if (Array.isArray(itemsField)) return itemsField;
  if (typeof itemsField === 'object') return itemsField;
  try {
    const parsed = JSON.parse(itemsField);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function openOrderModal(order) {
  const modalEl = document.getElementById('orderModal');
  const body = document.getElementById('orderModalBody');
  const cancelBtn = document.getElementById('cancelOrderBtn');

  if (!modalEl || !body || !cancelBtn) return;

  const items = parseItems(order.Items);
  const listHtml = items.length
    ? items.map(item => {
        const qty = item.quantity || 1;
        const price = Number(item.price) || 0;
        const name = item.name || 'Item';
        const amount = price * qty;
        const notes = item.specialInstructions || item.notes || '';
        return `
          <div class="d-flex justify-content-between border-bottom py-1">
            <div>
              <strong>${qty}× ${name}</strong>
              ${notes ? `<div class="text-muted small">${notes}</div>` : ''}
            </div>
            <div>${rupee(amount)}</div>
          </div>
        `;
      }).join('')
    : '<p class="text-muted">No item details available for this order.</p>';

  body.innerHTML = `
    <p><strong>Order ID:</strong> ${order.OrderID}</p>
    <p><strong>Date:</strong> ${formatDateTime(order.OrderDate || order.created_at)}</p>
    <p><strong>Status:</strong> ${order.Status || 'Pending'}</p>
    <hr>
    <h6>Items</h6>
    ${listHtml}
    <hr>
    <p class="text-end"><strong>Total:</strong> ${rupee(order.TotalAmount || 0)}</p>
  `;

  // Cancel button visibility
  if ((order.Status || 'Pending') === 'Pending') {
    cancelBtn.classList.remove('d-none');
    cancelBtn.onclick = async () => {
      const confirmCancel = window.confirm('Are you sure you want to cancel this order?');
      if (!confirmCancel) return;

      try {
        await apiPut(`/orders/${encodeURIComponent(order.OrderID)}`, {
          Status: 'Cancelled'
        });
        alert('Order cancelled.');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
        await loadOrders();
      } catch (err) {
        console.error('Cancel order error:', err);
        alert('Failed to cancel order. Please contact your host.');
      }
    };
  } else {
    cancelBtn.classList.add('d-none');
    cancelBtn.onclick = null;
  }

  const modalInstance = new bootstrap.Modal(modalEl);
  modalInstance.show();
}

async function loadBill() {
  const container = document.getElementById('billDetails');
  if (!container) return;

  if (!currentGuestID) {
    container.innerHTML = '<p>Bill will appear here once your booking is linked with a valid guestID.</p>';
    return;
  }

  try {
    container.innerHTML = '<p>Loading bill information...</p>';
    const bills = await apiGet(`/bills?guest=${encodeURIComponent(currentGuestID)}`);

    if (!bills || !bills.length) {
      container.innerHTML = '<p class="text-muted">Your final bill will be prepared at the time of checkout.</p>';
      return;
    }

    // Use the latest bill (by created_at, if present)
    const sorted = [...bills].sort((a, b) => {
      const t1 = new Date(a.created_at || a.checkinDate || 0).getTime();
      const t2 = new Date(b.created_at || b.checkinDate || 0).getTime();
      return t2 - t1;
    });
    const bill = sorted[0];

    const orderItems = parseItems(bill.orderDetails);
    const itemsHtml = orderItems.length
      ? `
        <h6>Food & Amenities</h6>
        <div class="mb-2">
          ${orderItems.map(it => {
            const qty = it.quantity || 1;
            const price = Number(it.price) || 0;
            const amount = qty * price;
            return `
              <div class="d-flex justify-content-between small border-bottom py-1">
                <div>${qty}× ${it.item || it.name || 'Item'}</div>
                <div>${rupee(amount)}</div>
              </div>
            `;
          }).join('')}
        </div>
      `
      : '';

    const roomLine = bill.roomRate && bill.nightsStayed
      ? `
        <div class="d-flex justify-content-between">
          <span>Stay (${bill.nightsStayed} night(s) × ${rupee(bill.roomRate)})</span>
          <span>${rupee(bill.subtotal || (bill.nightsStayed * bill.roomRate))}</span>
        </div>
      `
      : '';

    const subtotal = bill.subtotal || 0;
    const taxes = bill.taxes || 0;
    const total = bill.totalAmount || (subtotal + taxes);

    container.innerHTML = `
      <div class="p-2 border rounded">
        <p><strong>Bill ID:</strong> ${bill.billID}</p>
        ${roomLine}
        ${itemsHtml}
        <hr>
        <div class="d-flex justify-content-between">
          <span>Subtotal</span>
          <span>${rupee(subtotal)}</span>
        </div>
        <div class="d-flex justify-content-between">
          <span>Taxes</span>
          <span>${rupee(taxes)}</span>
        </div>
        <div class="d-flex justify-content-between fw-bold mt-2">
          <span>Total</span>
          <span>${rupee(total)}</span>
        </div>
        <p class="mt-2 small text-muted mb-0">
          Please confirm the amount with your host at checkout. If anything looks incorrect, reach out to the team.
        </p>
      </div>
    `;
  } catch (err) {
    console.error('Error loading bill:', err);
    container.innerHTML = '<p class="text-danger">Failed to load bill details. Please contact your host.</p>';
  }
}

// ---------- Menu button (opens menu.html) ----------

function initMenuButton() {
  const btn = document.getElementById('menuButton');
  if (!btn) return;

  btn.onclick = () => {
    const params = new URLSearchParams();
    if (currentGuestID) params.set('guestID', currentGuestID);
    if (currentRoom) params.set('room', currentRoom);
    const url = `${config.menuUrl}?${params.toString()}`;
    window.open(url, '_blank');
  };
}

// ---------- Init ----------

async function initGuestPortal() {
  console.log('🚀 initGuestPortal');

  initFooterNav();
  initWifiButton();
  initMenuButton();

  await loadGuestDetails();
  await loadOrders();
  await loadBill();
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('📌 DOMContentLoaded (guest portal)');
  initGuestPortal().catch(err => {
    console.error('Guest portal init error:', err);
  });
});
