const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { register, login } = require('../controllers/authController');

const router = express.Router();

function createAuthLimiter(windowMs, limit) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler(_req, res) {
      return res.status(429).json({
        error: {
          code: 'AUTH_RATE_LIMITED',
          message: 'Too many authentication attempts. Please try again later.',
        },
      });
    },
  });
}

router.post('/register', createAuthLimiter(60 * 60 * 1000, 5), register);
router.post('/login', createAuthLimiter(15 * 60 * 1000, 10), login);

module.exports = router;


