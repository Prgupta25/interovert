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
    geocode,
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
  updated.geocode = await geocodeAddress(updated.formattedAddress);

  Object.assign(address, updated);
  await address.save();

  return res.json({ message: 'Address updated', address });
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
