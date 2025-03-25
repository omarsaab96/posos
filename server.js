const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require("multer");
const path = require("path");

const Product = require('./models/Product');
const Order = require('./models/Order');
const Inventory = require('./models/Inventory');


require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: "*" })); // Allow all origins for development
app.use(express.json());
app.use(express.static('public'));


// Set up Multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/"); // Save images in the 'uploads' folder
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Rename file with timestamp
    }
});

const upload = multer({ storage: storage });



// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.log(err));



//GET
app.get('/get-products', async (req, res) => {
    try {
        const products = await Product.find();

        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/get-orders', async (req, res) => {
    try {
        const orders = await Order.find();

        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST
app.post("/add-product", upload.single("image"), async (req, res) => {
    try {
        const { name, barcode, price, currency, type, quantity, variation } = req.body;
        const image = req.file ? req.file.filename : null; // Store uploaded file name

        // Basic validation
        if (!name || !barcode || !price || !quantity) {
            return res.status(400).json({ message: "All fields are required: name, barcode, price, quantity" });
        }

        // Save product to database
        const newProduct = new Product({ name, barcode, price, currency, type, quantity, image, variation });
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.post('/add-order', async (req, res) => {
    try {
        console.log(req)
        const { name, itemsCount, total, items } = req.body;

        // Validate required fields
        if (!name || !itemsCount || !total || !items || !Array.isArray(items)) {
            return res.status(400).json({ message: "Missing required fields or invalid data format." });
        }

        // Create a new order
        const newOrder = new Order({
            name,
            // date: new Date().toLocaleDateString('en-GB'), // Format: DD/MM/YYYY
            itemsCount,
            total,
            items
        });

        // Save to database
        await newOrder.save();

        res.status(201).json({ message: "Order created successfully!", order: newOrder });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/add-inventory', async (req, res) => {
    try {
        const { productId, quantity, location } = req.body;

        if (!productId || !quantity) {
            return res.status(400).json({ message: "Fields productId and quantity are required" });
        }

        // Check if the product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const newInventory = new Inventory({ productId, quantity, location });
        await newInventory.save();
        res.status(201).json(newInventory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.post('/find-product', async (req, res) => {
    try {
        const { barcode } = req.body;

        if (!barcode) {
            return res.status(400).json({ message: "Barcode is required" });
        }

        // Ensure barcode is treated as a string
        const product = await Product.findOne({ barcode: String(barcode) });

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/find-order', async (req, res) => {
    try {
        const { oid } = req.body;

        if (!oid) {
            return res.status(400).json({ message: "Order ID is required" });
        }

        // Ensure barcode is treated as a string
        const order = await Order.findOne({ _id: String(oid) });

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/delete-product', async (req, res) => {
    try {
        const { barcode } = req.body;

        if (!barcode) {
            return res.status(400).json({ message: "Barcode is required" });
        }

        // Find the product by its original barcode
        const product = await Product.findOne({ barcode });

        // If no product is found, send a 404 response
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Update the product's linked status and modify the barcode
        product.linked = false;
        product.barcode = `${barcode}_deleted_${Date.now()}`;

        // Save the updated product
        await product.save();

        res.status(200).json({ message: "Product unlinked successfully", product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/delete-order', async (req, res) => {
    try {
        const { oid } = req.body;

        if (!oid) {
            return res.status(400).json({ message: "Order ID is required" });
        }

        // Find and update the order by its ID
        const result = await Order.findOneAndUpdate(
            { _id: String(oid) },
            { linked: false },
            { new: true }
        );

        // If no order is found, send a 404 response
        if (!result) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.status(200).json({ message: "Order unlinked successfully", order: result });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//PUT
app.put('/edit-product', upload.single("image"), async (req, res) => {
    try {
        const { id, name, barcode, price, currency, type, quantity, variation } = req.body;
        const image = req.file ? req.file.filename : undefined; // Update image if provided

        if (!id) {
            return res.status(400).json({ message: "Product ID is required" });
        }

        // Find and update the product
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { name, barcode, price, currency, type, quantity, variation, ...(image && { image }) },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json(updatedProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


//DELETE


// Set server to listen on port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
