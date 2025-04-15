const mongoose = require('mongoose');

function formatDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0'); // Ensure two digits
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

const notificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    date: { type: String, default: formatDate() },
    linked: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
    read: { type: Boolean, required: true, default: false }
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
