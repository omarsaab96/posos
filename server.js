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
const Notification = require('./models/Notification');


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
    const { userId } = req.query;

    try {
        const products = await Product.find({ createdBy: userId });

        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/get-orders', async (req, res) => {
    const { userId } = req.query;

    try {
        const orders = await Order.find({ createdBy: userId });

        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/get-notifications', async (req, res) => {
    const { userId } = req.query;

    try {
        const notifications = await Notification.find({
            createdBy: userId
        });

        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST
app.post("/add-product", upload.single("image"), async (req, res) => {
    try {
        const { name, barcode, price, currency, type, quantity, variation, createdBy } = req.body;

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
        const newProduct = new Product({ name, barcode, price, currency, type, quantity, image: imageUrl, variation, createdBy });
        await newProduct.save();

        res.status(201).json(newProduct);
    } catch (error) {
        res.status(500).json({ message: "Error uploading product", error: error.message });
    }
});

app.post('/add-order', async (req, res) => {
    try {
        const { name, itemsCount, total, items, createdBy } = req.body;

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
            items,
            createdBy
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
    const randomName = 'User_' + Math.floor(100000 + Math.random() * 900000);

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
        const newUser = new User({ name: randomName, password: hashedPassword, phoneNumber, email, role, isLoggedIn: true, lastLogin: new Date().toLocaleDateString('en-GB') + " " + new Date().toLocaleTimeString('en-GB') });
        await newUser.save();

        //get created user id
        const createdId = newUser._id.toString();

        let user = await User.findOne({ _id: String(createdId) });

        const token = jwt.sign({ id: createdId }, process.env.JWT_SECRET);

        res.status(200).json({
            token,
            userInfo: {
                id: user._id,
                name: user.name,
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
    let user = null;

    if ((email == null && phoneNumber == null) || !password) {
        return res.status(400).json({ message: 'Please enter credentials.' });
    }

    // Lookup user by email or phone number
    if (email != null) {
        user = await User.findOne({ email: String(email) });
    } else if (phoneNumber != null) {
        user = await User.findOne({ phoneNumber: String(phoneNumber) });
    }

    if (!user) {
        return res.status(400).json({ message: 'Account not found' });
    }

    // Check password first
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect password' });
    }

    // Check if already logged in
    if (user.isLoggedIn) {
        return res.status(403).json({ message: 'User already logged in' });
    }

    // If everything is good, mark as logged in
    user.isLoggedIn = true;
    user.lastLogin = new Date().toLocaleDateString('en-GB') + " " + new Date().toLocaleTimeString('en-GB');
    await user.save();

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.status(200).json({
        token,
        userInfo: {
            id: user._id,
            avatar: user.avatar,
            name: user.name,
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

app.post('/edit-profile', upload.single("profileAvatar"), async (req, res) => {
    try {
        const { userId, name, email, phoneNumber } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'Missing userId' });
        }

        const updateFields = {};

        if (req.body.profileAvatar === "avatar2.jpg") {
            updateFields.avatar = null;
        } else if (req.file) {
            const base64Image = req.file.buffer.toString("base64");

            const response = await axios.post(
                `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
                { image: base64Image },
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
            );

            const avatarUrl = response.data.data.url;
            updateFields.avatar = avatarUrl;
        }

        if (name) {
            updateFields.name = name;
        }

        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ message: 'Invalid email format' });
            }
            updateFields.email = email;
            updateFields.emailVerified = false;
        } else {
            updateFields.email = null;
            updateFields.emailVerified = false;
        }

        if (phoneNumber) {
            updateFields.phoneNumber = phoneNumber;
            updateFields.phoneVerified = false;
        } else {
            updateFields.phoneNumber = null;
            updateFields.phoneVerified = false;
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateFields,
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const token = jwt.sign({ id: updatedUser._id }, process.env.JWT_SECRET);

        res.status(200).json({
            token,
            userInfo: {
                id: updatedUser._id,
                avatar: updatedUser.avatar,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phoneNumber,
                role: updatedUser.role,
                isLoggedIn: updatedUser.isLoggedIn,
                lastLogout: updatedUser.lastLogout,
                lastLogin: updatedUser.lastLogin,
                emailVerified: updatedUser.emailVerified,
                phoneVerified: updatedUser.phoneVerified
            }
        });

    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/check-password', async (req, res) => {
    try {
        const { userId, currentPassword } = req.body;

        if (!userId || !currentPassword) {
            return res.status(400).json({ valid: false, message: 'Missing userId or password' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ valid: false, message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (isMatch) {
            return res.status(200).json({ valid: true });
        } else {
            return res.status(200).json({ valid: false });
        }

    } catch (err) {
        console.error('Error checking password:', err);
        res.status(500).json({ valid: false, message: 'Server error' });
    }
});

app.post('/update-password', async (req, res) => {
    try {
        const { userId, newPassword } = req.body;

        if (!userId || !newPassword) {
            return res.status(400).json({ success: false, message: 'Missing userId or new password' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { password: hashedPassword },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const token = jwt.sign({ id: updatedUser }, process.env.JWT_SECRET);

        res.status(200).json({
            token,
            userInfo: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phoneNumber,
                role: updatedUser.role,
                isLoggedIn: updatedUser.isLoggedIn,
                lastLogout: updatedUser.lastLogout,
                lastLogin: updatedUser.lastLogin,
                emailVerified: updatedUser.emailVerified,
                phoneVerified: updatedUser.phoneVerified
            }
        });

    } catch (err) {
        console.error('Error updating password:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/add-notification', async (req, res) => {
    try {
        const { text, relatedProduct, productBarcode, type, createdBy } = req.body;

        if (!text || !relatedProduct || !productBarcode || !type || !createdBy) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const existing = await Notification.findOne({
            relatedProduct: relatedProduct.trim().toLowerCase()
        });

        if (existing) {
            return res.status(409).json({ error: 'Notification for this product already exists' });
        }

        const newNotification = new Notification({
            text,
            relatedProduct: relatedProduct.trim().toLowerCase(),
            productBarcode,
            type,
            createdBy
        });

        await newNotification.save();

        res.status(201).json(newNotification);
    } catch (err) {
        console.error("Error saving notification:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


//PUT
app.put('/edit-product', upload.single("image"), async (req, res) => {
    try {
        const { id, name, barcode, price, currency, type, quantity, variation } = req.body;

        if (!id) {
            return res.status(400).json({ message: "Product ID is required" });
        }

        let imageUrl;
        if (req.body.image === "default.jpg") {
            imageUrl = "/uploads/default.jpg";
        } else if (req.file) {
            const base64Image = req.file.buffer.toString("base64");

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

app.put('/update-product-quantity', async (req, res) => {
    try {
        const { id, soldQuantity } = req.body;

        if (!id || !soldQuantity) {
            return res.status(400).json({ message: "Product ID and sold quantity are required" });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const newQuantity = product.quantity - soldQuantity;
        const newSold = product.soldQuantity + soldQuantity;

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                quantity: newQuantity,
                soldQuantity: newSold
            },
            { new: true }
        );

        res.status(200).json({ message: "Quantity updated successfully", product: updatedProduct });
    } catch (error) {
        res.status(500).json({ message: "Error updating quantity", error: error.message });
    }
});

app.put('/restock-product', async (req, res) => {
    try {
        const { id, restockedQuantity } = req.body;

        if (!id || !restockedQuantity) {
            return res.status(400).json({ message: "Product ID and restocked quantity are required" });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const now = new Date();

        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = now.getFullYear();

        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                quantity: restockedQuantity,
                lastRestock: `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
            },
            { new: true }
        );

        res.status(200).json({ message: "Quantity updated successfully", product: updatedProduct });
    } catch (error) {
        res.status(500).json({ message: "Error updating quantity", error: error.message });
    }
});

app.put('/edit-notification/:id', async (req, res) => {
    try {
        const notificationId = req.params.id;
        const {
            text,
            relatedProduct,
            productBarcode,
            type,
            linked,
            read
        } = req.body;

        const updateFields = {};

        if (text !== undefined) updateFields.text = text;
        if (relatedProduct !== undefined) updateFields.relatedProduct = relatedProduct.trim().toLowerCase();
        if (productBarcode !== undefined) updateFields.productBarcode = productBarcode;
        if (type !== undefined) updateFields.type = type;
        if (linked !== undefined) updateFields.linked = linked;
        if (read !== undefined) updateFields.read = read;

        const updated = await Notification.findByIdAndUpdate(
            notificationId,
            { $set: updateFields },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json(updated);
    } catch (err) {
        console.error("Error editing notification:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/notificationsMarkAsRead/:id', async (req, res) => {
    try {
        const updated = await Notification.findByIdAndUpdate(
            req.params.id,
            { read: true },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json(updated);
    } catch (err) {
        console.error("Error updating notification:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/notificationsMarkAsRead/all/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        const result = await Notification.updateMany(
            { createdBy: userId, read: false },
            { $set: { read: true } }
        );

        res.json({
            message: `All notifications for user ${userId} marked as read`,
            modifiedCount: result.modifiedCount
        });
    } catch (err) {
        console.error("Error updating notifications:", err);
        res.status(500).json({ error: 'Internal server error' });
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
