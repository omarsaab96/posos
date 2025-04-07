const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phoneNumber: { type: String, default: null },
    email: { type: String, default: null },
    password: { type: String, required: true },
    isLoggedIn: { type: Boolean, default: false },
    lastLogout: { type: String, default: null },
    lastLogin: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
});

module.exports = mongoose.model('User', userSchema);