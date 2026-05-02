import Address from '../models/Address.js';
import { geocodeAddress, buildFormattedAddress } from '../services/geocodeService.js';

// GET /api/addresses  — list logged-in user's saved (profile) addresses
export async function listAddresses(req, res) {
  const addresses = await Address.find({ owner_id: req.user._id, type: 'user' })
    .sort({ createdAt: -1 })
    .lean();
  return res.json(addresses);
}

// GET /api/addresses/:addressId  — single address
export async function getAddress(req, res) {
  const address = await Address.findById(req.params.addressId).lean();
  if (!address) return res.status(404).json({ message: 'Address not found' });
  if (String(address.owner_id) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  return res.json(address);
}

// POST /api/addresses  — create a new user address (profile)
export async function createAddress(req, res) {
  const { label, line1, line2, city, state, country, postalCode } = req.body || {};

  if (!line1 || !city) {
    return res.status(400).json({ message: 'line1 and city are required' });
  }

  const formatted = buildFormattedAddress({ line1, line2, city, state, postalCode, country });
  const geocode = await geocodeAddress(formatted);
  const verified =
    !!geocode && typeof geocode.lat === 'number' && typeof geocode.lng === 'number';

  const address = await Address.create({
    owner_id: req.user._id,
    type: 'user',
    label: (label || 'Home').trim(),
    line1: line1.trim(),
    line2: (line2 || '').trim(),
    city: city.trim(),
    state: (state || '').trim(),
    country: (country || '').trim(),
    postalCode: (postalCode || '').trim(),
    formattedAddress: formatted,
    geocode: verified ? geocode : null,
    is_verified: verified,
  });

  return res.status(201).json({ message: 'Address saved', address });
}

// PUT /api/addresses/:addressId  — update a user address
export async function updateAddress(req, res) {
  const address = await Address.findById(req.params.addressId);
  if (!address) return res.status(404).json({ message: 'Address not found' });
  if (String(address.owner_id) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const { label, line1, line2, city, state, country, postalCode } = req.body || {};

  const updated = {
    label: (label ?? address.label) || 'Home',
    line1: (line1 ?? address.line1).trim(),
    line2: ((line2 ?? address.line2) || '').trim(),
    city: (city ?? address.city).trim(),
    state: ((state ?? address.state) || '').trim(),
    country: ((country ?? address.country) || '').trim(),
    postalCode: ((postalCode ?? address.postalCode) || '').trim(),
  };

  if (!updated.line1 || !updated.city) {
    return res.status(400).json({ message: 'line1 and city are required' });
  }

  updated.formattedAddress = buildFormattedAddress(updated);
  const nextGeocode = await geocodeAddress(updated.formattedAddress);
  const verified =
    !!nextGeocode && typeof nextGeocode.lat === 'number' && typeof nextGeocode.lng === 'number';
  updated.geocode = verified ? nextGeocode : null;
  updated.is_verified = verified;

  Object.assign(address, updated);
  await address.save();

  return res.json({ message: 'Address updated', address });
}

// POST /api/addresses/:addressId/verify  — retry geocoding an existing address
export async function verifyExistingAddress(req, res) {
  const address = await Address.findById(req.params.addressId);
  if (!address) return res.status(404).json({ message: 'Address not found' });
  if (String(address.owner_id) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const formatted =
    address.formattedAddress ||
    buildFormattedAddress({
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    });
  const geocode = await geocodeAddress(formatted);
  const verified =
    !!geocode && typeof geocode.lat === 'number' && typeof geocode.lng === 'number';

  address.formattedAddress = formatted;
  address.geocode = verified ? geocode : null;
  address.is_verified = verified;
  await address.save();

  return res.json({
    verified,
    message: verified
      ? 'Address verified on the map.'
      : 'Still could not verify this address. Try editing it with a clearer street, city, or postal code.',
    address,
  });
}

// DELETE /api/addresses/:addressId  — delete a user address
export async function deleteAddress(req, res) {
  const address = await Address.findById(req.params.addressId);
  if (!address) return res.status(404).json({ message: 'Address not found' });
  if (String(address.owner_id) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  if (address.type === 'event') {
    return res.status(400).json({ message: 'Cannot delete an event address directly' });
  }
  await address.deleteOne();
  return res.json({ message: 'Address deleted' });
}
