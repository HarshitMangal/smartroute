/*
 * models/User.js
 * User Schema with Roles: 'admin' (can edit/create graphs & optimize) and 'driver' (can view & complete routes)
 */

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'driver'],
    default: 'admin',
  },
  mfaEnabled: {
    type: Boolean,
    default: true, // Default enabled for high-security enterprise dispatch
  },
  mfaSecret: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', UserSchema);
