// Configuration
const config = {
  airtable: {
    token: 'patWo5RyRmRCbKXp3.afc1eefc274991a91c14b6b95b2f5bb726cfb14deee85b57e10e5b0f84bc2980',
    baseId: 'app2UvEfKduRwGjfR',
    tables: {
      guests: 'Guests',
      orders: 'Orders',
      bills: 'Bills'
    }
  },
  locations: {
    fagu: 'https://maps.app.goo.gl/hdQtqqrPfXkuW9kH8?g_st=com.google.maps.preview.copy',
    cheog: 'https://maps.app.goo.gl/TkR5taVRB1goYrYh9?g_st=iwb',
    temple: 'https://maps.app.goo.gl/TXE7zRfKxUPBtKNL7?g_st=com.google.maps.preview.copy',
    property: 'https://maps.app.goo.gl/ML1D8MqbNofVC5Zq6?g_st=com.google.maps.preview.copy'
  },
  wifi: {
    ssid: 'OCB Stays',
    password: 'CozyBalcony!'
  }
};

// State
const state = {
  currentGuest: null,
  guestOrders: null,
  guestBill: null
};

// DOM Elements
const elements = {
  welcomeMessage: document.getElementById('welcomeMessage'),
  guestName: document.getElementById('guestName'),
  guestID: document.getElementById('guestID'),
  room: document.getElementById('room'),
  checkin: document.getElementById('checkin'),
  menuButton: document.getElementById('menuButton'),
  ordersList: document.getElementById('ordersList'),
  billDetails: document.getElementById('billDetails'),
  connectWifiBtn: document.getElementById('connectWifiBtn'),
  orderModalTitle: document.getElementById('orderModalTitle'),
  orderModalBody: document.getElementById('orderModalBody'),
  cancelOrderBtn: document.getElementById('cancelOrderBtn'),
  guestDetailsCollapse: document.getElementById('guestDetailsCollapse'),
  guestDetailsToggle: document.getElementById('guestDetailsToggle')
};

// Initialize modals
const modals = {
  orderModal: new bootstrap.Modal(document.getElementById('orderModal')),
  rulesModal: new bootstrap.Modal(document.getElementById('rulesModal'))
};

// Helper Functions
const helpers = {
  toggleCollapse: (id) => {
    const content = document.getElementById(id);
    const toggleIcon = document.getElementById(`${id}Toggle`);
    content.classList.toggle('expanded');
    toggleIcon.classList.toggle('expanded');
  },

  openLocation: (locationKey) => {
    const url = config.locations[locationKey];
    if (url) window.open(url, '_blank');
  },

  openAllLocations: () => {
    window.open(config.locations.property, '_blank');
  },

  highlightSection: (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.classList.add('section-highlight');
      setTimeout(() => section.classList.remove('section-highlight'), 2000);
    }
  },

  smoothScrollTo: (elementId) => {
    const element = document.getElementById(elementId);
    if (element) {
      const offset = 20;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
      helpers.highlightSection(elementId);
    }
  },

  makeCall: (phone) => {
    window.location.href = `tel:${phone}`;
  },

  openWhatsApp: (phone) => {
    window.location.href = `https://wa.me/${phone.replace('+', '')}`;
  }
};

// API Functions
const api = {
  // In script.js - Update the fetchGuestData function
fetchGuestData: async () => {
  const params = new URLSearchParams(window.location.search);
  const guestID = params.get('guestID');
  const room = params.get('room');

  if (!guestID || !room) {
    throw new Error('Missing required parameters');
  }

  const baseUrl = 'https://api.airtable.com/v0';
  
  const [guestResponse, ordersResponse, billResponse] = await Promise.all([
    fetch(`${baseUrl}/${config.airtable.baseId}/${config.airtable.tables.guests}?filterByFormula=AND({guestID}='${guestID}',{room}='${room}',{status}='Active')`, {
      headers: { Authorization: `Bearer ${config.airtable.token}` }
    }),
    fetch(`${baseUrl}/${config.airtable.baseId}/${config.airtable.tables.orders}?filterByFormula=AND({Guest}='${guestID}')&sort[0][field]=OrderDate&sort[0][direction]=desc`, {
      headers: { Authorization: `Bearer ${config.airtable.token}` }
    }),
    fetch(`${baseUrl}/${config.airtable.baseId}/${config.airtable.tables.bills}?filterByFormula={guestID}='${guestID}'`, {
      headers: { Authorization: `Bearer ${config.airtable.token}` }
    })
  ]);

  if (!guestResponse.ok) throw new Error(`Guest data error: ${guestResponse.status}`);
  if (!ordersResponse.ok) throw new Error(`Orders error: ${ordersResponse.status}`);
  if (!billResponse.ok) throw new Error(`Bill error: ${billResponse.status}`);

  const [guestData, ordersData, billData] = await Promise.all([
    guestResponse.json(),
    ordersResponse.json(),
    billResponse.json()
  ]);

  return {
    guest: guestData.records[0]?.fields,
    orders: ordersData.records,
    bill: billData.records[0]?.fields
  };
},
  cancelOrder: async (orderId) => {
    const response = await fetch(`${config.airtable.baseId}/${config.airtable.tables.orders}/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${config.airtable.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: { Status: 'Cancelled' }
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
};

// UI Functions
const ui = {
  updatePageWithData: (data) => {
    state.currentGuest = data.guest;
    state.guestOrders = data.orders;
    state.guestBill = data.bill;

    if (!state.currentGuest) {
      throw new Error('Guest not found or no longer active');
    }

    // Update guest details
    elements.guestName.textContent = state.currentGuest.name;
    elements.guestID.textContent = state.currentGuest.guestID;
    elements.room.textContent = state.currentGuest.room;
    
    const checkinDate = new Date(state.currentGuest.checkin);
    const formattedDate = checkinDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    elements.checkin.textContent = `${formattedDate} at 11:00 AM`;
    
    elements.welcomeMessage.textContent = `Hello, ${state.currentGuest.name}! Welcome to OCB Stays 🌲`;

    // Set up menu button
    elements.menuButton.onclick = () => {
      window.location.href = `menu.html?guestID=${state.currentGuest.guestID}&room=${encodeURIComponent(state.currentGuest.room)}`;
    };

    // Display orders and bill
    ui.displayOrders(state.guestOrders);
    ui.displayBillDetails(state.guestBill);
  },

  displayBillDetails: (bill) => {
    if (!bill) {
      elements.billDetails.innerHTML = '<p>No outstanding bill found. Please confirm with your host before departure.</p>';
      return;
    }

    let itemsHtml = '';
    let totalAmount = 0;
    
    try {
      const items = JSON.parse(bill.orderDetails || '[]');
      items.forEach(item => {
        itemsHtml += `
          <div class="order-item">
            <span>${item.item}</span>
            <span>₹${item.amount}</span>
          </div>
        `;
        totalAmount += item.amount;
      });
    } catch (e) {
      console.error('Error parsing bill items:', e);
      itemsHtml = '<p>Could not load bill items</p>';
    }

    const displayTotal = bill.totalAmount || totalAmount;

    elements.billDetails.innerHTML = `
      <p>Please settle your bill with the host before departure.</p>
      <div class="mt-3">
        <h5>Your Bill Summary</h5>
        <div class="order-items">
          ${itemsHtml}
          <div class="order-item mt-2 pt-2 border-top">
            <strong>Total Amount:</strong>
            <strong>₹${displayTotal}</strong>
            <i class="fas fa-download download-btn" onclick="app.downloadBill()" title="Download Bill"></i>
          </div>
        </div>
      </div>
      ${bill.paymentStatus === 'Paid' ? 
        '<div class="alert alert-success mt-3">Payment already settled. Thank you!</div>' : 
        '<p class="mt-3">Payment methods: Cash, UPI, or Bank Transfer</p>'}
    `;
  },

  displayOrders: (orders) => {
    if (!orders || orders.length === 0) {
      elements.ordersList.innerHTML = '<p>You have no orders yet.</p>';
      return;
    }

    elements.ordersList.innerHTML = '';
    
    orders.forEach(order => {
      const orderData = order.fields;
      const orderDate = new Date(orderData.OrderDate);
      const formattedDate = orderDate.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const orderCard = document.createElement('div');
      orderCard.className = `order-card order-${orderData.Status ? orderData.Status.toLowerCase() : 'default'}`;
      orderCard.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong>Order #${orderData.OrderID || order.id}</strong>
            <div>${formattedDate} • ${orderData.Status || 'Unknown'}</div>
          </div>
          <button class="btn btn-sm btn-outline-secondary view-order-btn" data-order-id="${order.id}">
            View Details
          </button>
        </div>
      `;
      
      elements.ordersList.appendChild(orderCard);
    });

    document.querySelectorAll('.view-order-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.target.getAttribute('data-order-id');
        ui.showOrderDetails(orderId);
      });
    });
  },

  showOrderDetails: async (orderId) => {
    const cachedOrder = state.guestOrders.find(o => o.id === orderId);
    if (cachedOrder) {
      ui.displayOrderModal(cachedOrder);
      return;
    }

    try {
      elements.orderModalBody.innerHTML = `
        <div class="text-center">
          <div class="spinner"></div>
          <p>Loading order details...</p>
        </div>
      `;
      modals.orderModal.show();

      const response = await fetch(`${config.airtable.baseId}/${config.airtable.tables.orders}/${orderId}`, {
        headers: { Authorization: `Bearer ${config.airtable.token}` }
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      ui.displayOrderModal(data);
    } catch (error) {
      console.error('Error fetching order details:', error);
      elements.orderModalBody.innerHTML = `
        <p>Error loading order details. Please try again later.</p>
      `;
    }
  },

  displayOrderModal: (orderData) => {
    const order = orderData.fields || orderData;
    const orderDate = new Date(order.OrderDate);
    const formattedDate = orderDate.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    let itemsHtml = '';
    let totalAmount = 0;
    try {
      const items = JSON.parse(order.Items || '[]');
      items.forEach(item => {
        itemsHtml += `
          <div class="order-item">
            <span>${item.quantity} × ${item.name}</span>
            <span>₹${item.price * item.quantity}</span>
          </div>
        `;
        totalAmount += item.price * item.quantity;
      });
    } catch (e) {
      console.error('Error parsing items:', e);
      itemsHtml = '<p>Could not load order items</p>';
    }

    const canCancel = order.Status === 'Pending' && 
                     (new Date() - orderDate) < (5 * 60 * 1000);
    
    elements.orderModalTitle.textContent = `Order #${order.OrderID || orderData.id}`;
    elements.orderModalBody.innerHTML = `
      <div class="mb-3">
        <div><strong>Status:</strong> ${order.Status || 'Unknown'}</div>
        <div><strong>Order Date:</strong> ${formattedDate}</div>
        ${order.SpecialInstructions ? `<div><strong>Special Instructions:</strong> ${order.SpecialInstructions}</div>` : ''}
      </div>
      <div class="order-items">
        <h6>Items:</h6>
        ${itemsHtml}
        <div class="order-item mt-2 pt-2 border-top">
          <strong>Total:</strong>
          <strong>₹${totalAmount}</strong>
        </div>
      </div>
    `;

    if (canCancel) {
      elements.cancelOrderBtn.classList.remove('d-none');
      elements.cancelOrderBtn.onclick = async () => {
        if (confirm('Are you sure you want to cancel this order?')) {
          try {
            await api.cancelOrder(orderData.id);
            alert('Order cancelled successfully!');
            modals.orderModal.hide();
            const orderIndex = state.guestOrders.findIndex(o => o.id === orderData.id);
            if (orderIndex !== -1) {
              state.guestOrders[orderIndex].fields.Status = 'Cancelled';
              ui.displayOrders(state.guestOrders);
            }
          } catch (error) {
            console.error('Error cancelling order:', error);
            alert('Failed to cancel order. Please try again or contact your host.');
          }
        }
      };
    } else {
      elements.cancelOrderBtn.classList.add('d-none');
    }

    modals.orderModal.show();
  },

  downloadBill: () => {
    html2canvas(elements.billDetails).then(canvas => {
      const link = document.createElement('a');
      link.download = `OCB-Stays-Bill-${state.currentGuest.name}-${new Date().toISOString().slice(0,10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  },

  connectToWifi: () => {
    if (navigator.connection && navigator.connection.type === 'wifi') {
      try {
        if (window.WifiWizard2) {
          window.WifiWizard2.connect(
            config.wifi.ssid, 
            false, 
            config.wifi.password,
            () => alert('Connected to WiFi successfully!'),
            (error) => alert('Failed to connect: ' + error)
          );
        } else if (navigator.wifiManager) {
          navigator.wifiManager.connect(
            config.wifi.ssid, 
            config.wifi.password,
            () => alert('Connected to WiFi successfully!'),
            (error) => alert('Failed to connect: ' + error)
          );
        } else {
          alert(`Automatic connection not supported in your browser. Please connect manually:\n\nNetwork: ${config.wifi.ssid}\nPassword: ${config.wifi.password}`);
        }
      } catch (e) {
        console.error('WiFi connection error:', e);
        alert(`Automatic connection failed. Please connect manually:\n\nNetwork: ${config.wifi.ssid}\nPassword: ${config.wifi.password}`);
      }
    } else {
      alert(`Please connect to WiFi manually:\n\nNetwork: ${config.wifi.ssid}\nPassword: ${config.wifi.password}`);
    }
  },

  handleDataError: (error) => {
    if (error.message.includes('Guest not found')) {
      alert('Guest not found or no longer active. Please contact your host.');
      document.body.innerHTML = `
        <h1>Access Denied</h1>
        <p>Your stay is not active or the link is invalid.</p>
        <p>Please contact your host if you believe this is an error.</p>
      `;
    } else {
      document.body.innerHTML = `
        <h1>Error Loading Data</h1>
        <p>We couldn't load your stay information. Please try again later.</p>
        <p>If the problem persists, contact your host.</p>
      `;
    }
  },

  setupNavigation: () => {
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', function(e) {
        e.preventDefault();
        const target = this.getAttribute('href');
        helpers.smoothScrollTo(target.substring(1));
        navTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
      });
    });
    
    window.addEventListener('scroll', function() {
      const sections = ['stayDetails', 'propertyLocation', 'teamSection', 'wifiSection', 'foodOrders', 'checkoutInfo'];
      const scrollPosition = window.scrollY + 100;
      
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element && element.offsetTop <= scrollPosition && 
            element.offsetTop + element.offsetHeight > scrollPosition) {
          navTabs.forEach(tab => tab.classList.remove('active'));
          document.querySelector(`.nav-tab[href="#${section}"]`).classList.add('active');
          break;
        }
      }
    });
  }
};

// App Controller
const app = {
  init: async () => {
    try {
      const data = await api.fetchGuestData();
      ui.updatePageWithData(data);
    } catch (error) {
      console.error('Error initializing app:', error);
      ui.handleDataError(error);
    }

    // Set up event listeners
    elements.connectWifiBtn.addEventListener('click', ui.connectToWifi);
    ui.setupNavigation();

    // Expand guest details by default
    setTimeout(() => {
      elements.guestDetailsCollapse.classList.add('expanded');
      elements.guestDetailsToggle.classList.add('expanded');
    }, 500);
  },

  downloadBill: ui.downloadBill
};

// Initialize the app
document.addEventListener('DOMContentLoaded', app.init);

// Expose app to global scope for HTML onclick handlers
window.app = app;
window.makeCall = helpers.makeCall;
window.openWhatsApp = helpers.openWhatsApp;
window.openLocation = helpers.openLocation;
window.openAllLocations = helpers.openAllLocations;
window.toggleCollapse = helpers.toggleCollapse;
