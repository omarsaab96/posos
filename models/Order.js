const mongoose = require('mongoose');

function formatDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0'); // Ensure two digits
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}

const orderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    date: { type: String, default:  formatDate()},
    itemsCount: { type: Number, required: true },
    total: { type: Number, required: true },
    items: { type: Object, default: null },
    linked: { type: Boolean, default:true },
    createdBy: { type: String, required: true }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
