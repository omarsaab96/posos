const mongoose = require('mongoose');

function formatDate() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0'); // Ensure two digits
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  barcode: { type: String, required: true},
  price: { type: Number, required: true },
  variation: { type: String, default: null },
  currency: { type: String, default: 'USD' },
  type: { type: String, default: 'Miscellaneous' },
  quantity: { type: Number, required: true },
  soldQuantity: { type: Number, default:0 },
  date: { type: String, default:  formatDate()},
  lastRestock: { type: String, default:  formatDate()},
  image: { type: String, default:'default.jpg' },
  createdBy: { type: String, required: true },
  linked: { type: Boolean, default:true },
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
