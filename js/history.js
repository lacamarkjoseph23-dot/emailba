const historyBody = document.getElementById("historyBody");
const dateFromInput = document.getElementById("dateFromInput");
const dateToInput = document.getElementById("dateToInput");
const filterBtn = document.getElementById("filterBtn");
const sortSelect = document.getElementById("sortSelect");

console.log("DOM Elements check:");
console.log("historyBody:", historyBody);
console.log("dateFromInput:", dateFromInput);
console.log("dateToInput:", dateToInput);
console.log("filterBtn:", filterBtn);

let historyData = [];
let currentSensorData = null;
let thresholds = {};
let minDate = null;
let maxDate = null;

// Flatpickr instances
let fromPicker = null;
let toPicker = null;

// Pagination variables
let currentPage = 1;
let recordsPerPage = 10;
let filteredData = [];

// Check if database is available
console.log("history.js loading...");
if (typeof window.database === 'undefined') {
  console.error("Firebase database not initialized!");
} else {
  console.log("Firebase database available in history.js");
}

// ============== LOAD THRESHOLDS FROM FIREBASE ===============
window.database.ref("thresholds").on("value", snapshot => {
  thresholds = snapshot.val();
  console.log("Thresholds loaded:", thresholds);
  
  if (thresholds) {
    console.log("Temperature thresholds:", thresholds.temperature);
    console.log("pH thresholds:", thresholds.ph);
    console.log("Salinity thresholds:", thresholds.salinity);
    console.log("Turbidity thresholds:", thresholds.turbidity);
    console.log("DO thresholds:", thresholds.do);
  } else {
    console.error("No thresholds found in Firebase!");
  }
});

// ============== HELPER FUNCTION: GET COLOR BASED ON THRESHOLD ===============
function getColorClass(parameter, value) {
  if (!thresholds || !thresholds[parameter] || value === undefined || value === null) {
    return '';
  }

  const threshold = thresholds[parameter];
  const { safeMin, safeMax, warnMin, warnMax } = threshold;

  if (value >= safeMin && value <= safeMax) {
    return 'status-safe';
  }
  
  if ((value >= warnMin && value < safeMin) || (value > safeMax && value <= warnMax)) {
    return 'status-caution';
  }
  
  if (value < warnMin || value > warnMax) {
    return 'status-critical';
  }

  return '';
}

// ============== LOAD CURRENT SENSOR DATA ===============
window.database.ref("sensors").on("value", snapshot => {
  currentSensorData = snapshot.val();
  console.log("Current sensor data:", currentSensorData);
});

// ============== LOAD HISTORICAL DATA ===============
window.database.ref("history").limitToLast(500).on("value", snapshot => {
  historyData = [];

  snapshot.forEach(child => {
    const data = child.val();

    // Handle both 'timestamp' (number) and 'time' (string) formats
    let timestamp;
    
    if (data.timestamp && typeof data.timestamp === "number") {
      timestamp = data.timestamp;
    } else if (data.time && typeof data.time === "string") {
      timestamp = new Date(data.time).getTime();
      
      if (isNaN(timestamp)) {
        console.warn("Could not parse time string:", data.time);
        return;
      }
    } else {
      console.warn("Record has no valid timestamp or time field:", data);
      return;
    }

    const cleanData = {
      temperature: data.temperature,
      ph: data.ph,
      salinity: data.salinity,
      turbidity: data.turbidity,
      do: data.do,
      timestamp: timestamp
    };

    historyData.push(cleanData);
  });

  console.log("Total history records loaded:", historyData.length);
  
  if (historyData.length > 0) {
    console.log("Sample record:", historyData[0]);
    initializeDatePickers();
  } else {
    console.warn("No valid history data found!");
  }
});

// ============== INITIALIZE FLATPICKR DATE PICKERS ===============
function initializeDatePickers() {
  // Set date range to full year 2026
  minDate = new Date(2026, 0, 1); // January 1, 2026
  maxDate = new Date(2026, 11, 31); // December 31, 2026

  console.log("Date range:", minDate.toLocaleDateString(), "to", maxDate.toLocaleDateString());

  // Get dates that have data
  const datesWithData = new Set();
  historyData.forEach(d => {
    const date = new Date(d.timestamp);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    datesWithData.add(dateStr);
  });

  console.log("Dates with data:", datesWithData.size);

  // Check if dark mode is active
  const isDarkMode = document.body.classList.contains('dark');

  // Initialize "Start Date" picker
  fromPicker = flatpickr(dateFromInput, {
    dateFormat: "M d, Y",
    minDate: minDate,
    maxDate: maxDate,
    defaultDate: null,
    onDayCreate: function(dObj, dStr, fp, dayElem) {
      // Mark days that have data
      const date = dayElem.dateObj;
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (datesWithData.has(dateStr)) {
        dayElem.classList.add('has-data');
      } else {
        dayElem.classList.add('no-data');
      }
      
      // Disable dates that are after the selected end date (if any)
      if (toPicker && toPicker.selectedDates.length > 0) {
        const endDate = toPicker.selectedDates[0];
        if (date > endDate) {
          dayElem.classList.add('flatpickr-disabled');
        }
      }
    },
    onMonthChange: function(selectedDates, dateStr, instance) {
      // Refresh calendar when month changes to apply constraints
      setTimeout(() => instance.redraw(), 0);
    },
    onYearChange: function(selectedDates, dateStr, instance) {
      // Refresh calendar when year changes to apply constraints
      setTimeout(() => instance.redraw(), 0);
    },
    onReady: function(selectedDates, dateStr, instance) {
      if (isDarkMode) {
        instance.calendarContainer.classList.add('dark-mode-calendar');
      }
    }
  });

  // Initialize "End Date" picker
  toPicker = flatpickr(dateToInput, {
    dateFormat: "M d, Y",
    minDate: minDate,
    maxDate: maxDate,
    defaultDate: null,
    onDayCreate: function(dObj, dStr, fp, dayElem) {
      // Mark days that have data
      const date = dayElem.dateObj;
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (datesWithData.has(dateStr)) {
        dayElem.classList.add('has-data');
      } else {
        dayElem.classList.add('no-data');
      }
      
      // Disable dates that are before the selected start date (if any)
      if (fromPicker && fromPicker.selectedDates.length > 0) {
        const startDate = fromPicker.selectedDates[0];
        if (date < startDate) {
          dayElem.classList.add('flatpickr-disabled');
        }
      }
    },
    onMonthChange: function(selectedDates, dateStr, instance) {
      // Refresh calendar when month changes to apply constraints
      setTimeout(() => instance.redraw(), 0);
    },
    onYearChange: function(selectedDates, dateStr, instance) {
      // Refresh calendar when year changes to apply constraints
      setTimeout(() => instance.redraw(), 0);
    },
    onReady: function(selectedDates, dateStr, instance) {
      if (isDarkMode) {
        instance.calendarContainer.classList.add('dark-mode-calendar');
      }
    }
  });

  console.log("Date pickers initialized successfully!");
}

// ============== APPLY FILTER ===============
filterBtn.addEventListener("click", () => {
  const dateFromValue = dateFromInput.value;
  const dateToValue = dateToInput.value;

  console.log("Filter applied - Start Date:", dateFromValue, "End Date:", dateToValue);

  // UPDATED VALIDATION: Both dates are required
  if (!dateFromValue || !dateToValue) {
    alert("Please select both start date and end date");
    return;
  }

  // Parse selected dates
  const dateFrom = new Date(dateFromValue);
  const dateTo = new Date(dateToValue);

  if (dateFrom > dateTo) {
    alert("Start date cannot be after end date");
    return;
  }

  // Filter data for DATE RANGE
  let filtered = historyData.filter(item => {
    const itemDate = new Date(item.timestamp);
    
    // Set time to start of day for comparison
    const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    const fromDateOnly = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
    const toDateOnly = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate());
    
    return itemDateOnly >= fromDateOnly && itemDateOnly <= toDateOnly;
  });

  console.log("Historical records matching filter:", filtered.length);

  // Sort data
  const sortOrder = sortSelect.value;
  filtered.sort((a, b) => {
    if (sortOrder === "oldest") {
      return a.timestamp - b.timestamp;
    } else {
      return b.timestamp - a.timestamp;
    }
  });

  console.log("Total filtered results:", filtered.length, "records");
  
  // Store filtered data and reset to page 1
  filteredData = filtered;
  currentPage = 1;
  
  renderTable();
  renderPagination();
});

// ============== ADD EVENT LISTENERS FOR DATE SELECTION ===============
// When start date changes, refresh end date picker to show proper constraints
dateFromInput.addEventListener("change", () => {
  if (toPicker) {
    setTimeout(() => toPicker.redraw(), 100);
  }
});

// When end date changes, refresh start date picker to show proper constraints
dateToInput.addEventListener("change", () => {
  if (fromPicker) {
    setTimeout(() => fromPicker.redraw(), 100);
  }
});

// ============== RENDER HISTORICAL DATA TABLE WITH PAGINATION ===============
function renderTable() {
  historyBody.innerHTML = "";

  if (filteredData.length === 0) {
    historyBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px;">
          <i class="fas fa-info-circle" style="font-size: 2em; color: #0ea5e9; margin-bottom: 10px;"></i>
          <div style="font-size: 1.1em; font-weight: 600; color: #334155; margin-top: 10px;">No Data Available</div>
          <div style="font-size: 0.95em; color: #64748b; margin-top: 5px;">There are no records for the selected date range</div>
        </td>
      </tr>
    `;
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationControls = document.getElementById('paginationControls');
    if (paginationInfo) paginationInfo.innerHTML = '';
    if (paginationControls) paginationControls.innerHTML = '';
    return;
  }

  // Calculate pagination
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = Math.min(startIndex + recordsPerPage, filteredData.length);
  const pageData = filteredData.slice(startIndex, endIndex);

  // Render rows for current page
  pageData.forEach(d => {
    const date = new Date(d.timestamp).toLocaleString();

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${date}</strong></td>
      <td class="${getColorClass('temperature', d.temperature)}">${d.temperature !== undefined ? d.temperature.toFixed(1) : "--"}</td>
      <td class="${getColorClass('ph', d.ph)}">${d.ph !== undefined ? d.ph.toFixed(2) : "--"}</td>
      <td class="${getColorClass('salinity', d.salinity)}">${d.salinity !== undefined ? d.salinity.toFixed(1) : "--"}</td>
      <td class="${getColorClass('turbidity', d.turbidity)}">${d.turbidity !== undefined ? d.turbidity.toFixed(1) : "--"}</td>
      <td class="${getColorClass('do', d.do)}">${d.do !== undefined ? d.do.toFixed(1) : "--"}</td>
    `;
    historyBody.appendChild(row);
  });

  // Update info display
  updatePaginationInfo(startIndex + 1, endIndex, filteredData.length);
}

// ============== UPDATE PAGINATION INFO ===============
function updatePaginationInfo(start, end, total) {
  const infoElement = document.getElementById('paginationInfo');
  if (infoElement) {
    infoElement.textContent = `Showing ${start}-${end} of ${total} records`;
  }
}

// ============== RENDER PAGINATION CONTROLS ===============
function renderPagination() {
  const totalPages = Math.ceil(filteredData.length / recordsPerPage);
  const paginationContainer = document.getElementById('paginationControls');
  
  if (!paginationContainer || totalPages <= 1) {
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  let paginationHTML = '';

  // Previous button
  paginationHTML += `
    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
      <i class="fas fa-chevron-left"></i> Previous
    </button>
  `;

  // Page numbers
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    paginationHTML += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `
      <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
    paginationHTML += `<button class="pagination-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }

  // Next button
  paginationHTML += `
    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
      Next <i class="fas fa-chevron-right"></i>
    </button>
  `;

  paginationContainer.innerHTML = paginationHTML;
}

// ============== GO TO PAGE FUNCTION ===============
function goToPage(page) {
  const totalPages = Math.ceil(filteredData.length / recordsPerPage);
  if (page < 1 || page > totalPages) return;
  
  currentPage = page;
  renderTable();
  renderPagination();
  
  // Scroll to top of table
  const table = document.querySelector('.history-table');
  if (table) {
    table.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ============== SUBMENU SWITCHING ===============
function showDataView() {
  const dataSection = document.getElementById('dataViewSection');
  const analyticsSection = document.getElementById('analyticsSection');
  
  if (dataSection) dataSection.style.display = 'block';
  if (analyticsSection) analyticsSection.style.display = 'none';
  
  // Update active submenu
  document.querySelectorAll('.submenu-item').forEach(item => item.classList.remove('active'));
  const dataViewTab = document.getElementById('dataViewTab');
  if (dataViewTab) dataViewTab.classList.add('active');
}

function showAnalytics() {
  const dataSection = document.getElementById('dataViewSection');
  const analyticsSection = document.getElementById('analyticsSection');
  
  if (dataSection) dataSection.style.display = 'none';
  if (analyticsSection) analyticsSection.style.display = 'block';
  
  // Update active submenu
  document.querySelectorAll('.submenu-item').forEach(item => item.classList.remove('active'));
  const analyticsTab = document.getElementById('analyticsTab');
  if (analyticsTab) analyticsTab.classList.add('active');
}

// Make functions global
window.goToPage = goToPage;
window.showDataView = showDataView;
window.showAnalytics = showAnalytics;