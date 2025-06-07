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
  const date = getLocalDate(dateStr);
  today.setHours(0, 0, 0, 0);
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

// Calendar Management
let currentDisplayMonth = new Date().getMonth();
let currentDisplayYear = new Date().getFullYear();

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
    
  } catch (error) {
    console.error('Error generating calendar:', error);
  }
}

function isDateInRange(date, start, end) {
  const d = getLocalDate(date);
  const s = getLocalDate(start);
  const e = getLocalDate(end);
  return d >= s && d <= e;
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
      if (guestItem) guestItem.click();
    }, 100);
  });
  
  return card;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize calendar
  await generateCalendarView();
  
  // Load initial data
  await loadTodaysGuests();
  await loadUpcomingGuests();
  
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
});