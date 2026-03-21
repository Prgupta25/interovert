function isObjectIdLike(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || ''));
}

export function validateEventIdParam(req, res, next) {
  if (!isObjectIdLike(req.params.eventId)) {
    return res.status(400).json({ message: 'Invalid event ID format' });
  }
  next();
}

export function validateCreateEvent(req, res, next) {
  const {
    name, description, datetime, category, activities, maxAttendees, aboutYou, expectations,
    // address: either an existing addressId OR address fields
    addressId, addressLine1, addressCity,
  } = req.body || {};

  const required = { name, description, datetime, category, activities, maxAttendees, aboutYou, expectations };
  const missing = Object.entries(required)
    .filter(([, v]) => v === undefined || v === null || v === '')
    .map(([k]) => k);

  if (missing.length) {
    return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
  }

  // Must supply either an existing addressId OR at minimum addressLine1 + addressCity
  if (!addressId && (!addressLine1 || !addressCity)) {
    return res.status(400).json({
      message: 'Address is required: provide addressId (saved address) or addressLine1 + addressCity',
    });
  }

  next();
}
