const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  location: { type: String, default: null },
  linked: { type: Boolean, default:true },
});

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;
