const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ message: 'Access token missing' });
    }

    const token = authHeader.split(' ')[1]; // Expect "Bearer <token>"

    if (!token) {
        return res.status(401).json({ message: 'Token missing' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(403).json({ message: 'Invalid token user' });
        }

        req.user = user; // Attach user to request object
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid token', error: error.message });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
};

module.exports = {
    authenticateToken,
    isAdmin
};
