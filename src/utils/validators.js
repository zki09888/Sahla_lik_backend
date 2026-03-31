function sanitizeString(str, maxLength = 255) {
  if (typeof str !== 'string' || str.length === 0) return '';
  const trimmed = str.trim();
  return trimmed.slice(0, maxLength);
}

function sanitizeInteger(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = parseInt(value, 10);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function sanitizeFloat(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = parseFloat(value);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function isValidPhone(phone) {
  const re = /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{1,4}([-\s\.]?[0-9]{1,4}){1,2}$/;
  return re.test(String(phone).replace(/\s/g, ''));
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

function sanitizeObject(obj, allowedFields) {
  const sanitized = {};
  for (const key of allowedFields) {
    if (obj[key] === undefined || obj[key] === null) continue;
    if (typeof obj[key] === 'string') {
      sanitized[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'number') {
      sanitized[key] = obj[key];
    } else if (Array.isArray(obj[key])) {
      sanitized[key] = obj[key].map(item => sanitizeString(item));
    }
  }
  return sanitized;
}

function generatePagination(page, limit, total) {
  const currentPage = Math.max(1, sanitizeInteger(page, 1, 1000));
  const pageSize = Math.min(100, Math.max(1, sanitizeInteger(limit, 1, 100)));
  const offset = (currentPage - 1) * pageSize;
  const totalPages = Math.ceil(total / pageSize);

  return {
    page: currentPage,
    limit: pageSize,
    offset,
    total,
    pages: totalPages,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages
  };
}

module.exports = {
  sanitizeString,
  sanitizeInteger,
  sanitizeFloat,
  isValidEmail,
  isValidPhone,
  isValidPassword,
  sanitizeObject,
  generatePagination
};
