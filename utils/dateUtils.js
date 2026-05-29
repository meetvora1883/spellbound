// utils/dateUtils.js
const months = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
};
const monthNames = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

/**
 * Convert user input to YYYY-MM-DD
 * Accepts: "DD MMM YYYY" (12 Feb 2026) or "YYYY-MM-DD" (2026-02-12)
 */
function parseDate(input) {
  input = input.trim();
  
  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [_, year, month, day] = isoMatch;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  // Try DD MMM YYYY
  const parts = input.split(/\s+/);
  if (parts.length === 3) {
    let [day, month, year] = parts;
    month = monthNames[month.toLowerCase()];
    if (month) {
      day = day.padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  return null;
}

/**
 * Convert YYYY-MM-DD to DD MMM YYYY (e.g., 2026-02-12 → 12 Feb 2026)
 */
function formatDateDisplay(storageDate) {
  const [year, month, day] = storageDate.split('-');
  const monthName = months[month] || month;
  return `${parseInt(day)} ${monthName} ${year}`;
}

/**
 * Format might with dot thousand separators, no trailing .000
 * Examples:
 *   1200    → 1.200
 *   1200.5  → 1.200.5
 *   1234567 → 1.234.567
 */
function formatMight(value) {
  if (!value) return '0';
  
  // Convert to string and clean
  let str = value.toString().trim();
  if (str === '') return '0';
  
  // Parse as float to handle decimals
  const num = parseFloat(str);
  if (isNaN(num)) return '0';
  
  // Split integer and decimal parts
  const parts = num.toString().split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1] || '';
  
  // Add dot thousands separators to integer part
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Return with decimal part if exists (trim trailing zeros)
  if (decimalPart) {
    // Trim trailing zeros from decimal
    let trimmedDecimal = decimalPart.replace(/0+$/, '');
    if (trimmedDecimal) {
      return `${integerPart}.${trimmedDecimal}`;
    }
  }
  return integerPart;
}

module.exports = {
  parseDate,
  formatDateDisplay,
  formatMight
};