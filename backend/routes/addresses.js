import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {
  listAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/addresses.controller.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(listAddresses));
router.get('/:addressId', requireAuth, asyncHandler(getAddress));
router.post('/', requireAuth, asyncHandler(createAddress));
router.put('/:addressId', requireAuth, asyncHandler(updateAddress));
router.delete('/:addressId', requireAuth, asyncHandler(deleteAddress));

export default router;
