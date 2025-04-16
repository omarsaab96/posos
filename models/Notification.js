const mongoose = require('mongoose');

function formatDate() {
    const date = new Date();

    const day = String(date.getDate()).padStart(2, '0'); // Ensure two digits
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

const notificationSchema = new mongoose.Schema({
    text: { type: String, required: true },
    date: { type: String, default: formatDate() },
    relatedProduct: {type: String, required: true},
    productBarcode: {type: String, required: true},
    type: {type: String, required: true},
    linked: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
    read: { type: Boolean, required: true, default: false }
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
