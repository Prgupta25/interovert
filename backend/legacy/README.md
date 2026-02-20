# Legacy Backend Modules

These files are preserved for reference from the earlier CommonJS structure and are intentionally not mounted by `backend/server.js`:

- `backend/routes/authRoutes.js`
- `backend/controllers/authController.js`
- `backend/models/OTP.JS`
- `backend/config/db.js`
- `backend/config/config.js`
- `backend/utils/otpGenerator.js`
- `backend/utils/emailService.js`

Active runtime modules use the ESM route/controller/service architecture under `backend/routes`, `backend/controllers`, `backend/services`, and `backend/middlewares`.
