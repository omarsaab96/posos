const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { authenticateToken, isAdmin } = require('./middleware/auth');

const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Inventory = require('./models/Inventory');

const app = express();

// Middleware
app.use(cors({ origin: "*" })); // Allow all origins for development
app.use(express.json());
app.use(express.static('public'));


// Set up Multer storage
const upload = multer({ storage: multer.memoryStorage() });
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
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

        if (!name || !barcode || !price || !quantity) {
            return res.status(400).json({ message: "All fields are required: name, barcode, price, quantity" });
        }

        let imageUrl = null;
        if (req.file) {
            const base64Image = req.file.buffer.toString("base64");

            // Upload to ImgBB
            const response = await axios.post(
                `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
                { image: base64Image },
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
            );

            console.log(response);


            imageUrl = response.data.data.url; // Get the direct image URL
        }

        // Save product to database
        const newProduct = new Product({ name, barcode, price, currency, type, quantity, image: imageUrl, variation });
        await newProduct.save();

        res.status(201).json(newProduct);
    } catch (error) {
        res.status(500).json({ message: "Error uploading product", error: error.message });
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

app.post('/unlink-product', async (req, res) => {
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
        product.barcode = `${barcode}-deleted_${Date.now()}`;

        // Save the updated product
        await product.save();

        res.status(200).json({ message: "Product unlinked successfully", product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/unlink-order', async (req, res) => {
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

app.post('/register', async (req, res) => {
    const { password, phoneNumber, email, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    if (!password || (!phoneNumber && !email)) {
        return res.status(400).json({ message: 'Missing account info' });
    }

    if (email) {
        const existingUserByEmail = await User.findOne({ email });
        if (existingUserByEmail) {
            return res.status(400).json({ message: 'Email is already registered.' });
        }
    }

    if (phoneNumber) {
        const existingUserByPhone = await User.findOne({ phoneNumber });
        if (existingUserByPhone) {
            return res.status(400).json({ message: 'Phone number is already registered.' });
        }
    }

    try {
        const newUser = new User({ password: hashedPassword, phoneNumber, email, role, lastLogin: new Date().toLocaleDateString('en-GB') + " " + new Date().toLocaleTimeString('en-GB') });
        await newUser.save();

        //get created user id
        const createdId = newUser._id.toString();

        let user = await User.findOne({ _id: String(createdId) });

        const token = jwt.sign({ id: createdId }, process.env.JWT_SECRET);

        res.status(200).json({
            token,
            userInfo: {
                id: user._id,
                email: user.email,
                phone: user.phoneNumber,
                role: user.role,
                isLoggedIn: user.isLoggedIn,
                lastLogout: user.lastLogout,
                lastLogin: user.lastLogin,
                emailVerified: user.emailVerified,
                phoneVerified: user.phoneVerified
            }
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.post('/login', async (req, res) => {
    const { email, phoneNumber, password } = req.body;

    if ((email == null && phoneNumber == null) || !password) {
        return res.status(400).json({ message: 'Please enter credentials.' });
    }

    if (email != null) {
        const user = await User.findOne({ email: String(email) });
    } else if (phoneNumber != null) {
        const user = await User.findOne({ phoneNumber: String(phoneNumber) });
    } else {
        const user = null;
        return res.status(400).json({ message: 'Please enter email or phone number.' });
    }

    if (user==null) {
        return res.status(400).json({ message: 'User not found' });
    } else {
        if (user.isLoggedIn) {
            return res.status(403).json({ message: 'User already loggedin' });
        } else {
            user.isLoggedIn = true;
            await user.save();
        }
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect password' });
    } else {
        user.lastLogin = new Date().toLocaleDateString('en-GB') + " " + new Date().toLocaleTimeString('en-GB');
        await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.status(200).json({
        token,
        userInfo: {
            id: user._id,
            email: user.email,
            phone: user.phoneNumber,
            role: user.role,
            isLoggedIn: user.isLoggedIn,
            lastLogout: user.lastLogout,
            lastLogin: user.lastLogin,
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified
        }
    });
});

app.post('/logout', async (req, res) => {
    const { userId } = req.body;
    let user;

    if (!userId) {
        return res.status(400).json({ message: 'User id required.' });
    } else {
        user = await User.findOne({ _id: Object(userId) });
    }

    if (!user) {
        return res.status(400).json({ message: 'User not found' });
    } else {
        if (!user.isLoggedIn) {
            return res.status(400).json({ message: 'User is already logged out.' });
        } else {
            user.isLoggedIn = false;
            user.lastLogout = new Date().toLocaleDateString('en-GB') + " " + new Date().toLocaleTimeString('en-GB');
            await user.save();
        }

    }

    res.status(200).json({ message: 'Logged out successfully.' });
});


//PUT
app.put('/edit-product', upload.single("image"), async (req, res) => {
    try {
        const { id, name, barcode, price, currency, type, quantity, variation } = req.body;

        if (!id) {
            return res.status(400).json({ message: "Product ID is required" });
        }

        let imageUrl;
        if (req.file) {
            const base64Image = req.file.buffer.toString("base64");

            // Upload new image to ImgBB
            const response = await axios.post(
                `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
                { image: base64Image },
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
            );

            imageUrl = response.data.data.url; // Get the new image URL
        }

        // Find and update the product
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { name, barcode, price, currency, type, quantity, variation, ...(imageUrl && { image: imageUrl }) },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json(updatedProduct);
    } catch (error) {
        res.status(500).json({ message: "Error updating product", error: error.message });
    }
});

//DELETE
app.delete('/delete-all-products', authenticateToken, isAdmin, async (req, res) => {
    try {
        await Product.deleteMany({});
        res.status(200).json({ message: "All products deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "Error deleting products", error: error.message });
    }
});

app.delete('/delete-all-orders', authenticateToken, isAdmin, async (req, res) => {
    try {
        await Order.deleteMany({});
        res.status(200).json({ message: "All orders deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "Error deleting orders", error: error.message });
    }
});



// Set server to listen on port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
