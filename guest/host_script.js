// Configuration
const config = {
  airtable: {
    token: 'patWo5RyRmRCbKXp3.afc1eefc274991a91c14b6b95b2f5bb726cfb14deee85b57e10e5b0f84bc2980',
    baseId: 'app2UvEfKduRwGjfR',
    tables: {
      guests: 'Guests',
      bills: 'Bills',
      orders: 'Orders'
    }
  },
  urls: {
    guestPortal: 'https://ocbstays.github.io/ocbstaysfagu/guest/index.html',
    guestMenu: 'https://ocbstays.github.io/ocbstaysfagu/guest/menu.html'
  },
  rooms: ["Stargazing Deck (0)", "Stargazing Cabin (1)", "A Frame Cottage"],
  paymentModes: ["UPI", "Cash", "Card", "NetBanking"]
};

// State
let currentDisplayMonth = new Date().getMonth();
let currentDisplayYear = new Date().getFullYear();
let selectedGuestId = null;

// Date Utilities
function getLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const date = new Date(dateStr);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
}

function formatLocalDate(dateStr, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return getLocalDate(dateStr).toLocaleDateString('en-US', options);
}

function isSameDay(date1, date2) {
  const d1 = getLocalDate(date1);
  const d2 = getLocalDate(date2);
  return d1.getFullYear() === d2.getFullYear() && 
         d1.getMonth() === d2.getMonth() && 
         d1.getDate() === d2.getDate();
}

function isToday(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = getLocalDate(dateStr);
  date.setHours(0, 0, 0, 0);
  return date.getTime() === today.getTime();
}

function isPastDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = getLocalDate(dateStr);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function calculateNights(checkin, checkout) {
  const oneDay = 24 * 60 * 60 * 1000;
  const start = getLocalDate(checkin);
  const end = getLocalDate(checkout);
  return Math.round(Math.abs((start - end) / oneDay));
}

function isDateInRange(date, start, end) {
  const d = getLocalDate(date);
  const s = getLocalDate(start);
  const e = getLocalDate(end);
  return d >= s && d <= e;
}

// API Helper
async function fetchAirtable(endpoint, options = {}) {
  const url = `https://api.airtable.com/v0/${config.airtable.baseId}/${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${config.airtable.token}`,
        'Content-Type': 'application/json'
      },
      ...options
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message || 'API request failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Airtable API error:', error);
    throw error;
  }
}

function showToast(message, type = 'success') {
  const toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast show align-items-center text-white bg-${type} border-0`;
  toast.role = 'alert';
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Calendar Management
async function generateCalendarView() {
  const container = document.getElementById('property-calendar-view');
  const propertyFilter = document.getElementById('propertyFilter').value;
  
  container.innerHTML = '';
  
  // Generate current and next month
  for (let i = 0; i < 2; i++) {
    const month = (currentDisplayMonth + i) % 12;
    const year = currentDisplayYear + Math.floor((currentDisplayMonth + i) / 12);
    await generateCalendarMonth(month, year, propertyFilter);
  }
  
  // Update month display
  document.getElementById('currentMonthDisplay').textContent = 
    new Date(currentDisplayYear, currentDisplayMonth).toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
}

async function generateCalendarMonth(month, year, propertyFilter) {
  try {
    // Get all active bookings
    const data = await fetchAirtable(`${config.airtable.tables.guests}?filterByFormula={status}="Active"`);
    
    // Filter by property if needed
    const bookings = propertyFilter === 'all' 
      ? data.records 
      : data.records.filter(r => r.fields.room === propertyFilter);
    
    // Create month container
    const monthContainer = document.createElement('div');
    monthContainer.className = 'calendar-month';
    
    // Month header
    const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    let html = `
      <div class="month-title">${monthName}</div>
      <div class="weekdays">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div class="days-grid">
    `;
    
    // Empty cells for days before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      html += `<div class="calendar-day"></div>`;
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find bookings for this day
      const dayBookings = bookings.filter(b => {
        const guest = b.fields;
        return isDateInRange(dateStr, guest.checkin, guest.checkout);
      });
      
      const dayClasses = ['calendar-day'];
      if (date.toDateString() === today.toDateString()) dayClasses.push('today');
      if (dayBookings.length > 0) dayClasses.push('booked-day');
      if (date < today) dayClasses.push('past-day');
      
      html += `
        <div class="${dayClasses.join(' ')}" data-date="${dateStr}">
          <div class="day-number">${day}</div>
          ${dayBookings.length > 0 ? '<div class="day-events"><span class="day-event-dot"></span></div>' : ''}
        </div>
      `;
    }
    
    html += `</div>`;
    monthContainer.innerHTML = html;
    document.getElementById('property-calendar-view').appendChild(monthContainer);
    
    // Add click handlers to days
    monthContainer.querySelectorAll('.calendar-day').forEach(day => {
      day.addEventListener('click', () => {
        const date = day.dataset.date;
        if (date) {
          showDayDetails(date, bookings);
        }
      });
    });
    
  } catch (error) {
    console.error('Error generating calendar:', error);
    showToast('Failed to load calendar', 'danger');
  }
}

async function showDayDetails(date, allBookings) {
  const modalTitle = document.getElementById('dayModalTitle');
  const modalBody = document.getElementById('dayModalBody');
  const modal = new bootstrap.Modal(document.getElementById('dayModal'));
  
  modalTitle.textContent = new Date(date).toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  
  // Find bookings for this day
  const dayBookings = allBookings.filter(b => {
    const guest = b.fields;
    return isDateInRange(date, guest.checkin, guest.checkout);
  });
  
  if (dayBookings.length === 0) {
    modalBody.innerHTML = `
      <div class="alert alert-info">No bookings for this day</div>
      <div class="modal-event-actions">
        <button class="btn btn-sm btn-primary" id="bookThisDateBtn">Book This Date</button>
      </div>
    `;
  } else {
    modalBody.innerHTML = dayBookings.map(booking => {
      const guest = booking.fields;
      const isCheckingIn = isSameDay(guest.checkin, date);
      const isCheckingOut = isSameDay(guest.checkout, date);
      
      let statusBadge = '';
      if (isCheckingIn && isCheckingOut) {
        statusBadge = '<span class="badge bg-warning">Same Day</span>';
      } else if (isCheckingIn) {
        statusBadge = '<span class="badge bg-primary">Check-in</span>';
      } else if (isCheckingOut) {
        statusBadge = '<span class="badge bg-danger">Check-out</span>';
      } else {
        statusBadge = '<span class="badge bg-success">Staying</span>';
      }
      
      return `
        <div class="modal-event" data-guest-id="${booking.id}">
          <div><strong>${guest.name || 'Unnamed Guest'}</strong> ${statusBadge}</div>
          <div>Room: ${guest.room}</div>
          <div>Dates: ${formatLocalDate(guest.checkin)} to ${formatLocalDate(guest.checkout)}</div>
          <div>Mobile: ${guest.mobile || 'Not provided'}</div>
        </div>
      `;
    }).join('');
  }
  
  modal.show();
  
  // Add event listeners to guest details
  document.querySelectorAll('#dayModalBody .modal-event').forEach(detail => {
    detail.addEventListener('click', () => {
      modal.hide();
      document.querySelector('#manage-footer-tab').click();
      setTimeout(() => {
        const guestId = detail.dataset.guestId;
        const guestItem = document.querySelector(`#guestList [data-guest-id="${guestId}"]`);
        if (guestItem) {
          guestItem.click();
        }
      }, 100);
    });
  });
  
  // Add event listener to book button
  document.getElementById('bookThisDateBtn')?.addEventListener('click', () => {
    modal.hide();
    document.querySelector('#addGuestBtn').click();
    document.getElementById('dateRange')._flatpickr.setDate([date, date]);
  });
}

// Guest Management
async function loadTodaysGuests() {
  const container = document.getElementById('today-guests-list');
  container.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div></div>';
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const data = await fetchAirtable(`${config.airtable.tables.guests}?filterByFormula={status}="Active"`);
    
    const todaysGuests = data.records.filter(record => {
      const guest = record.fields;
      return isDateInRange(today.toISOString().split('T')[0], guest.checkin, guest.checkout);
    });
    
    if (todaysGuests.length === 0) {
      container.innerHTML = '<div class="alert alert-info">No guests staying today</div>';
      return;
    }
    
    container.innerHTML = '';
    todaysGuests.forEach(record => {
      const guest = record.fields;
      const card = createGuestCard(record.id, guest, true);
      container.appendChild(card);
    });
    
  } catch (error) {
    console.error("Error loading today's guests:", error);
    container.innerHTML = '<div class="alert alert-danger">Failed to load guests</div>';
  }
}

async function loadUpcomingGuests() {
  const container = document.getElementById('upcoming-guests-list');
  container.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div></div>';
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const data = await fetchAirtable(`${config.airtable.tables.guests}?filterByFormula={status}="Active"`);
    
    const upcomingGuests = data.records.filter(record => {
      const guest = record.fields;
      return getLocalDate(guest.checkin) > today;
    }).sort((a, b) => getLocalDate(a.fields.checkin) - getLocalDate(b.fields.checkin));
    
    if (upcomingGuests.length === 0) {
      container.innerHTML = '<div class="alert alert-info">No upcoming guests</div>';
      return;
    }
    
    container.innerHTML = '';
    upcomingGuests.forEach(record => {
      const guest = record.fields;
      const card = createGuestCard(record.id, guest, false);
      container.appendChild(card);
    });
    
  } catch (error) {
    console.error("Error loading upcoming guests:", error);
    container.innerHTML = '<div class="alert alert-danger">Failed to load guests</div>';
  }
}

function createGuestCard(guestId, guest, isTodayCard) {
  const card = document.createElement('div');
  card.className = 'guest-card';
  card.dataset.guestId = guestId;
  
  const checkinDate = getLocalDate(guest.checkin);
  const checkoutDate = getLocalDate(guest.checkout);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let statusBadge = '';
  if (isTodayCard) {
    if (isSameDay(guest.checkin, today.toISOString())) {
      statusBadge = '<span class="badge bg-primary">Checking In</span>';
    } else if (isSameDay(guest.checkout, today.toISOString())) {
      statusBadge = '<span class="badge bg-danger">Checking Out</span>';
    } else {
      statusBadge = '<span class="badge bg-success">Staying</span>';
    }
  } else {
    const daysToCheckin = Math.ceil((checkinDate - today) / (1000 * 60 * 60 * 24));
    statusBadge = `<span class="badge bg-info">${daysToCheckin} days</span>`;
  }
  
  card.innerHTML = `
    <div class="guest-summary">
      <div>
        <h5>${guest.name || 'Unnamed Guest'}</h5>
        <div class="guest-meta">
          ${guest.room} • ${formatLocalDate(guest.checkin)} to ${formatLocalDate(guest.checkout)}
          ${statusBadge}
        </div>
      </div>
    </div>
  `;
  
  card.addEventListener('click', () => {
    document.querySelector('#manage-footer-tab').click();
    setTimeout(() => {
      const guestItem = document.querySelector(`#guestList [data-guest-id="${guestId}"]`);
      if (guestItem) {
        guestItem.click();
      }
    }, 100);
  });
  
  return card;
}

async function loadActiveGuests() {
  const guestList = document.getElementById('guestList');
  guestList.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div></div>';
  
  try {
    const data = await fetchAirtable(`${config.airtable.tables.guests}?filterByFormula={status}="Active"`);
    
    if (data.records.length === 0) {
      guestList.innerHTML = '<div class="text-center py-3 text-muted">No active guests found</div>';
      return;
    }
    
    guestList.innerHTML = '';
    data.records.forEach(record => {
      const guest = record.fields;
      const item = document.createElement('div');
      item.className = 'guest-list-item';
      item.dataset.guestId = record.id;
      item.innerHTML = `
        <div class="guest-list-name">${guest.name || 'Unnamed Guest'} (${guest.guestID})</div>
        <div class="guest-list-room">${guest.room}</div>
        <div class="guest-list-dates">${formatLocalDate(guest.checkin)} - ${formatLocalDate(guest.checkout)}</div>
      `;
      guestList.appendChild(item);
      
      // Select guest if it matches the stored selectedGuestId
      if (selectedGuestId && record.id === selectedGuestId) {
        item.classList.add('active');
        loadGuestDetails(record.id, guest);
      }
    });
    
    // Add click handler for guest selection
    document.querySelectorAll('#guestList .guest-list-item').forEach(item => {
      item.addEventListener('click', async () => {
        selectedGuestId = item.dataset.guestId;
        document.querySelectorAll('#guestList .guest-list-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        document.getElementById('selectedGuestInfo').style.display = 'block';
        
        const guest = await fetchAirtable(`${config.airtable.tables.guests}/${item.dataset.guestId}`);
        displayGuestDetails(guest.fields);
      });
    });
  } catch (error) {
    console.error('Error loading guests:', error);
    guestList.innerHTML = '<div class="alert alert-danger">Failed to load guests</div>';
  }
}

async function displayGuestDetails(guest) {
  const container = document.getElementById('guestDetailsContent');
  const nights = calculateNights(guest.checkin, guest.checkout);
  
  container.innerHTML = `
    <div class="guest-details-section">
      <h6>Guest Information</h6>
      <div class="guest-details-grid">
        <div class="detail-item">
          <div class="detail-label">Name</div>
          <div class="detail-value">${guest.name || 'Unnamed Guest'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Mobile</div>
          <div class="detail-value">${guest.mobile || 'Not provided'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Room</div>
          <div class="detail-value">${guest.room}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Nights</div>
          <div class="detail-value">${nights}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Check-in</div>
          <div class="detail-value">${formatLocalDate(guest.checkin)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Check-out</div>
          <div class="detail-value">${formatLocalDate(guest.checkout)}</div>
        </div>
      </div>
      
      ${guest.Comments ? `
      <div class="notes-section">
        <div class="detail-label">Notes</div>
        <div class="notes-content">${guest.Comments}</div>
      </div>
      ` : ''}
    </div>
    
    <div class="guest-details-section">
      <h6>Payment Summary</h6>
      <div class="payment-summary">
        <div class="payment-summary-item">
          <span>Advance Paid:</span>
          <span>₹${guest.advanceAmount || 0} 
            <span class="payment-mode">${guest.advanceMode ? `(${guest.advanceMode})` : ''}</span>
          </span>
        </div>
        <div class="payment-summary-item">
          <span>Balance Due:</span>
          <span>₹${guest.balanceAmount || 0}</span>
        </div>
      </div>
    </div>
  `;
  
  // Setup action buttons
  document.getElementById('copyGuestLink').onclick = () => {
    navigator.clipboard.writeText(guest.homeLink);
    showToast('Link copied to clipboard!', 'success');
  };
  
  document.getElementById('sendEmailToGuest').onclick = () => window.open(
    `mailto:?subject=OCB Stays Information&body=${encodeURIComponent(generateEmailBody(guest, guest.homeLink))}`
  );
  
  document.getElementById('sendWhatsappToGuest').onclick = () => window.open(
    `https://wa.me/${guest.mobile}?text=${encodeURIComponent(generateWhatsappMessage(guest, guest.homeLink))}`
  );
  
  document.getElementById('callGuest').href = `tel:${guest.mobile}`;
  
  document.getElementById('editGuestBtn').addEventListener('click', () => {
    openEditGuestModal(guest);
  });
}

function generateEmailBody(guest, link) {
  return `Hi ${guest.name},
Thank you for choosing OCB Stays for your upcoming trip to Fagu. 

Your booking for ${guest.room} for ${formatLocalDate(guest.checkin)} is confirmed with advance payment of ₹${guest.advanceAmount || 0} (non-refundable), balance ₹${guest.balanceAmount || 0} to be transferred on arrival.

Check-in : ${formatLocalDate(guest.checkin)} 1pm || Check Out: ${formatLocalDate(guest.checkout)} 11am

Please follow the below link for CheckIn instructions and other important info:
${link}

Please share your Id's for the record purpose & feel free to get in touch anytime in case you have any queries or need any assistance. 

Hope you have a great time !! 

Thanks, 
Prateek & Ishika 
OCB Stays, Curated with Love..`;
}

function generateWhatsappMessage(guest, link) {
  return `Hi ${guest.name},
Thank you for choosing OCB Stays for your upcoming trip to Fagu.
Please follow the below link:
${link}

Cheers,
Team OCB Stays`;
}

function openEditGuestModal(guest) {
  document.getElementById('editName').value = guest.name || '';
  document.getElementById('editMobile').value = guest.mobile || '';
  document.getElementById('editRoom').value = guest.room || '';
  document.getElementById('editCheckin')._flatpickr.setDate(guest.checkin);
  document.getElementById('editCheckout')._flatpickr.setDate(guest.checkout);
  document.getElementById('editAdvance').value = guest.advanceAmount || 0;
  document.getElementById('editAdvanceMode').value = guest.advanceMode || '';
  document.getElementById('editBalance').value = guest.balanceAmount || 0;
  document.getElementById('editComments').value = guest.Comments || '';
  document.getElementById('editGuestId').value = selectedGuestId;
  
  new bootstrap.Modal(document.getElementById('editGuestModal')).show();
}

async function checkRoomAvailability() {
  const dateRange = document.getElementById('dateRange').value;
  if (!dateRange) {
    document.getElementById('availabilityStatus').innerHTML = '<span class="unavailable">Please select dates</span>';
    return;
  }
  
  const [checkin, checkout] = dateRange.split(' to ');
  const roomSelect = document.getElementById('room');
  const statusDiv = document.getElementById('availabilityStatus');
  
  statusDiv.innerHTML = '<span>Checking availability...</span>';
  
  try {
    const data = await fetchAirtable(`${config.airtable.tables.guests}?filterByFormula={status}="Active"`);
    
    const bookedRooms = new Set();
    data.records.forEach(record => {
      const guest = record.fields;
      if (isDateRangeOverlap(checkin, checkout, guest.checkin, guest.checkout)) {
        bookedRooms.add(guest.room);
      }
    });
    
    roomSelect.innerHTML = '<option value="">Select Room</option>';
    let availableCount = 0;
    
    config.rooms.forEach(room => {
      if (!bookedRooms.has(room)) {
        const option = document.createElement('option');
        option.value = room;
        option.textContent = room;
        roomSelect.appendChild(option);
        availableCount++;
      }
    });
    
    if (availableCount === 0) {
      statusDiv.innerHTML = '<span class="unavailable">No rooms available for selected dates</span>';
      roomSelect.disabled = true;
    } else {
      statusDiv.innerHTML = `<span class="available">${availableCount} room(s) available</span>`;
      roomSelect.disabled = false;
    }
  } catch (error) {
    console.error('Error checking availability:', error);
    statusDiv.innerHTML = '<span class="unavailable">Error checking availability</span>';
  }
}

function isDateRangeOverlap(start1, end1, start2, end2) {
  const d1 = getLocalDate(start1);
  const d2 = getLocalDate(end1);
  const d3 = getLocalDate(start2);
  const d4 = getLocalDate(end2);
  return (d1 < d4) && (d3 < d2);
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize date pickers
  flatpickr("#dateRange", {
    mode: "range",
    minDate: "today",
    dateFormat: "Y-m-d",
    onChange: function(selectedDates) {
      if (selectedDates.length === 2) {
        checkRoomAvailability();
      }
    }
  });

  flatpickr("#editCheckin", { minDate: "today", dateFormat: "Y-m-d" });
  flatpickr("#editCheckout", { minDate: "today", dateFormat: "Y-m-d" });

  // Load initial data
  await loadTodaysGuests();
  await loadUpcomingGuests();
  await loadActiveGuests();
  await generateCalendarView();

  // Event listeners
  document.getElementById('addGuestBtn').addEventListener('click', () => {
    new bootstrap.Modal(document.getElementById('addGuestModal')).show();
  });
  
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    currentDisplayMonth--;
    if (currentDisplayMonth < 0) {
      currentDisplayMonth = 11;
      currentDisplayYear--;
    }
    generateCalendarView();
  });
  
  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    currentDisplayMonth++;
    if (currentDisplayMonth > 11) {
      currentDisplayMonth = 0;
      currentDisplayYear++;
    }
    generateCalendarView();
  });
  
  document.getElementById('propertyFilter').addEventListener('change', generateCalendarView);
  
  // Tab switching
  document.querySelectorAll('#mainTabs .nav-link').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const target = tab.dataset.tabTarget;
      
      // Hide all content
      document.querySelectorAll('.main-content > div').forEach(content => {
        content.style.display = 'none';
      });
      
      // Show selected content
      document.getElementById(`${target}-content`).style.display = 'block';
      
      // Update active tab
      document.querySelectorAll('#mainTabs .nav-link').forEach(t => {
        t.classList.remove('active');
      });
      tab.classList.add('active');
    });
  });
  
  // Register guest form
  document.getElementById('registerBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    const btn = e.target;
    btn.disabled = true;
    
    try {
      const dateRange = document.getElementById('dateRange').value;
      if (!dateRange) throw new Error('Please select dates');
      
      const [checkin, checkout] = dateRange.split(' to ');
      const formData = {
        room: document.getElementById('room').value,
        checkin,
        checkout,
        name: document.getElementById('name').value,
        mobile: document.getElementById('mobile').value,
        advanceAmount: document.getElementById('advanceAmount').value || 0,
        advanceMode: document.getElementById('advanceMode').value || '',
        balanceAmount: document.getElementById('balanceAmount').value || 0,
        Comments: document.getElementById('comments').value || ''
      };
      
      if (!formData.room) throw new Error('Please select a room');
      if (!formData.name) throw new Error('Please enter guest name');
      if (!formData.mobile) throw new Error('Please enter mobile number');
      
      const guestID = 'GST' + Array.from({length: 5}, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
      const homeLink = `${config.urls.guestPortal}?guestID=${guestID}&room=${encodeURIComponent(formData.room)}`;
      
      // Create guest in Airtable
      const response = await fetchAirtable(config.airtable.tables.guests, {
        method: 'POST',
        body: JSON.stringify({
          fields: {
            ...formData,
            guestID,
            status: "Active",
            homeLink,
            advanceAmount: parseFloat(formData.advanceAmount),
            balanceAmount: parseFloat(formData.balanceAmount)
          }
        })
      });

      if (!response.id) throw new Error('Failed to create guest record');
      
      // Clear form
      document.getElementById('guestForm').reset();
      new bootstrap.Modal(document.getElementById('addGuestModal')).hide();
      
      showToast('Guest registered successfully!', 'success');
      
      // Refresh data
      await loadTodaysGuests();
      await loadUpcomingGuests();
      await loadActiveGuests();
      await generateCalendarView();
      
    } catch (error) {
      console.error("Registration error:", error);
      showToast(`Error: ${error.message}`, 'danger');
    } finally {
      btn.disabled = false;
    }
  });
  
  // Save guest changes
  document.getElementById('saveGuestChanges').addEventListener('click', async () => {
    const btn = document.getElementById('saveGuestChanges');
    btn.disabled = true;
    
    try {
      const guestId = document.getElementById('editGuestId').value;
      if (!guestId) throw new Error('No guest selected');
      
      const formData = {
        name: document.getElementById('editName').value,
        mobile: document.getElementById('editMobile').value,
        room: document.getElementById('editRoom').value,
        checkin: document.getElementById('editCheckin').value,
        checkout: document.getElementById('editCheckout').value,
        advanceAmount: document.getElementById('editAdvance').value || 0,
        advanceMode: document.getElementById('editAdvanceMode').value || '',
        balanceAmount: document.getElementById('editBalance').value || 0,
        Comments: document.getElementById('editComments').value || ''
      };
      
      if (!formData.name) throw new Error('Name is required');
      if (!formData.mobile) throw new Error('Mobile is required');
      if (!formData.room) throw new Error('Room is required');
      if (!formData.checkin) throw new Error('Check-in date is required');
      if (!formData.checkout) throw new Error('Check-out date is required');
      
      await fetchAirtable(`${config.airtable.tables.guests}/${guestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: formData })
      });
      
      // Close modal
      new bootstrap.Modal(document.getElementById('editGuestModal')).hide();
      showToast('Guest details updated successfully!', 'success');
      
      // Refresh data
      await loadTodaysGuests();
      await loadUpcomingGuests();
      await loadActiveGuests();
      await generateCalendarView();
      
    } catch (error) {
      console.error('Error updating guest:', error);
      showToast(`Error: ${error.message}`, 'danger');
    } finally {
      btn.disabled = false;
    }
  });
});