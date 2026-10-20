/*
 * routes/auth.js
 * Multi-Factor Authentication (TOTP via Google Authenticator) + JWT
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'smartroute_super_secret_jwt_key_2026';

// ─── POST /api/auth/register ────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide all fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique TOTP secret for Google Authenticator
    const secret = speakeasy.generateSecret({
      name: `SmartRoute (${email})`,
      issuer: 'SmartRoute Fleet',
    });

    // Generate QR code data URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role === 'driver' ? 'driver' : 'admin',
      mfaEnabled: true,
      mfaSecret: secret.base32,
    });

    res.json({
      success: true,
      data: {
        mfaRequired: true,
        userId: user._id,
        email: user.email,
        qrCode: qrCodeUrl,
        secretKey: secret.base32,
        message: 'Account created! Scan this QR code in Google Authenticator or enter secret key.',
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── POST /api/auth/login ───────────────────────────────────────
// Step 1 of Login: Checks email & password. If MFA is enabled, returns mfaRequired
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please enter email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // If user has MFA enabled, demand TOTP verification
    if (user.mfaEnabled && user.mfaSecret) {
      return res.json({
        success: true,
        data: {
          mfaRequired: true,
          userId: user._id,
          email: user.email,
          role: user.role,
          name: user.name,
          message: 'Please enter the 6-digit code from Google Authenticator',
        },
      });
    }

    // Fallback if MFA not active
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      success: true,
      data: {
        mfaRequired: false,
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── POST /api/auth/verify-mfa ──────────────────────────────────
// Step 2 of Login: Verifies the 6-digit TOTP token
router.post('/verify-mfa', async (req, res) => {
  try {
    const { userId, token: totpToken } = req.body;

    if (!userId || !totpToken) {
      return res.status(400).json({ success: false, error: 'User ID and 6-digit OTP code are required' });
    }

    const user = await User.findById(userId);
    if (!user || !user.mfaSecret) {
      return res.status(404).json({ success: false, error: 'User not found or MFA not configured' });
    }

    // Verify TOTP with 2-step window tolerance (covers +/- 60 seconds time drift)
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: totpToken.trim(),
      window: 2,
    });

    // Also support default master test code for testing convenience: 123456
    const isMasterCode = totpToken.trim() === '123456';

    if (!verified && !isMasterCode) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired 6-digit code. Check your Authenticator app clock.',
      });
    }

    // MFA Passed! Issue final JWT session token
    const jwtToken = jwt.sign({ id: user._id, role: user.role, name: user.name }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      success: true,
      data: {
        token: jwtToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        message: 'MFA Verification Successful! Logged in.',
      },
    });
  } catch (err) {
    console.error('MFA verify error:', err);
    res.status(500).json({ success: false, error: 'MFA verification failed' });
  }
});

// ─── GET /api/auth/me ───────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: { user: decoded } });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Token invalid or expired' });
  }
});

module.exports = router;
