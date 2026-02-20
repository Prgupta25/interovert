import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { getPgPool } from '../config/pg.js';
import MongoUser from '../models/User.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function isAuthenticated(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: token missing' });
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    const tokenUserId = String(decoded.userId || '');
    const pool = getPgPool();
    if (!pool) {
      const mongoUser = await MongoUser.findById(tokenUserId)
        .select('_id email name profile isVerified phoneNumber createdAt')
        .lean();
      if (!mongoUser) {
        return res.status(401).json({ message: 'Unauthorized: invalid token user' });
      }

      req.user = {
        id: String(mongoUser._id),
        legacy_user_id: String(mongoUser._id),
        email: mongoUser.email,
        full_name: mongoUser.name,
        profile_photo_url: mongoUser.profile?.avatar || null,
        bio: mongoUser.profile?.bio || '',
        profile_visibility: 'PUBLIC',
        email_verified: Boolean(mongoUser.isVerified),
        phone_verified: Boolean(mongoUser.phoneNumber),
        gov_id_verified: false,
        verified_badge: Boolean(mongoUser.isVerified),
        created_at: mongoUser.createdAt,
      };
      return next();
    }

    let { rows } = await pool.query(
      `SELECT id, legacy_user_id, email, full_name, profile_photo_url, bio, profile_visibility,
              email_verified, phone_verified, gov_id_verified, verified_badge, created_at
         FROM users
        WHERE deleted_at IS NULL
          AND (id::text = $1 OR legacy_user_id = $1)
        LIMIT 1`,
      [tokenUserId]
    );

    if (!rows.length && !UUID_REGEX.test(tokenUserId)) {
      const mongoUser = await MongoUser.findById(tokenUserId).lean();
      if (mongoUser) {
        await pool.query(
          `INSERT INTO users (
              legacy_user_id,
              email,
              password_hash,
              full_name,
              profile_photo_url,
              bio,
              email_verified,
              phone_number,
              phone_verified,
              verified_badge
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (email)
            DO UPDATE SET
              legacy_user_id = EXCLUDED.legacy_user_id,
              full_name = EXCLUDED.full_name,
              updated_at = NOW()`,
          [
            String(mongoUser._id),
            String(mongoUser.email || '').trim().toLowerCase(),
            String(mongoUser.password || 'placeholder_hash'),
            String(mongoUser.name || 'User'),
            mongoUser.profile?.avatar || null,
            mongoUser.profile?.bio || '',
            Boolean(mongoUser.isVerified),
            mongoUser.phoneNumber || null,
            Boolean(mongoUser.phoneNumber),
            Boolean(mongoUser.isVerified),
          ]
        );

        rows = (await pool.query(
          `SELECT id, legacy_user_id, email, full_name, profile_photo_url, bio, profile_visibility,
                  email_verified, phone_verified, gov_id_verified, verified_badge, created_at
             FROM users
            WHERE deleted_at IS NULL
              AND (id::text = $1 OR legacy_user_id = $1)
            LIMIT 1`,
          [tokenUserId]
        )).rows;
      }
    }

    if (!rows.length) {
      return res.status(401).json({ message: 'Unauthorized: invalid token user' });
    }

    req.user = rows[0];
    return next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized: invalid token' });
  }
}
