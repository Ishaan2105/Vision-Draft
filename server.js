// ==========================================
// Vision Draft Backend - Unified Server
// ==========================================
require('dotenv').config(); 
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000; // Render uses port 10000 by default

// ==========================================
// MIDDLEWARE (Crucial Order)
// ==========================================
app.use(cors());
app.use(express.json()); // 1. Parse JSON first so req.body isn't undefined
app.use(express.static(__dirname)); // 2. Serve static files

// 3. Route for the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// 1. MongoDB Connection
// ==========================================
const MONGO_URI = process.env.MONGO_URI; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// History Schema
const History = mongoose.model('History', new mongoose.Schema({
    username: { type: String, required: true },
    prompt: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: String },
    createdAt: { type: Date, default: Date.now }
}));

// User Schema
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, 
    createdAt: { type: Date, default: Date.now }
}));

// ==========================================
// 2. Unified Email Transporter (Cloud Optimized)
// ==========================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587, // Change from 465 to 587
    secure: false, // Must be false for port 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    // Adding extra time and opportunistic TLS
    connectionTimeout: 20000, 
    greetingTimeout: 20000,
    socketTimeout: 25000,
    tls: {
        ciphers: 'SSLv3', // Helps negotiate with Gmail from cloud IPs
        rejectUnauthorized: false
    }
});

transporter.verify((error) => {
    if (error) {
        console.log("❌ Email Server Error:", error);
    } else {
        console.log("✅ Email Server is ready");
    }
});

// ==========================================
// 3. Authentication & Recovery Routes
// ==========================================

app.post('/send-otp', (req, res) => {
    // req.body is now populated because express.json() is at the top
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).send("Email and OTP are required");

    const mailOptions = {
        from: '"Vision Draft Support" <ishaanhingway@gmail.com>',
        to: email,
        subject: "Your Registration OTP",
        text: `Welcome to Vision Draft! Your verification code is: ${otp}`
    };

    transporter.sendMail(mailOptions, (err) => {
        if (err) return res.status(500).send("Failed to send OTP email.");
        res.status(200).send("OTP Sent successfully");
    });
});

app.post('/send-reset-email', (req, res) => {
    const { email, newPass } = req.body;
    if (!email || !newPass) return res.status(400).send("Email and password required");

    const mailOptions = {
        from: '"Vision Draft Support" <ishaanhingway@gmail.com>',
        to: email,
        subject: 'Account Recovery - New Password',
        text: `Your new temporary password is: ${newPass}`
    };

    transporter.sendMail(mailOptions, (error) => {
        if (error) return res.status(500).send("Failed to send recovery email.");
        res.status(200).send("Recovery email sent");
    });
});

// ==========================================
// 4. API Routes
// ==========================================

app.post('/api/save-art', async (req, res) => {
    try {
        const { username, prompt, url, size } = req.body;
        const newArt = new History({ username, prompt, url, size });
        await newArt.save(); 
        res.status(201).json({ message: "Art saved to cloud!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save art" });
    }
});

app.get('/api/history/:username', async (req, res) => {
    try {
        const art = await History.find({ username: req.params.username }).sort({ createdAt: -1 });
        res.json(art);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

app.delete('/api/delete-art/:id', async (req, res) => {
    try {
        await History.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted from cloud" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

app.delete('/api/clear-history/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const result = await History.deleteMany({ username: username }); 
        res.status(200).json({ message: "History cleared successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to clear history" });
    }
});

app.delete('/api/delete-account/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { password } = req.body;
        const user = await User.findOne({ username: username, password: password });
        if (!user) return res.status(401).json({ message: "Incorrect password" });
        await History.deleteMany({ username: username });
        await User.deleteOne({ username: username });
        res.status(200).json({ message: "Account deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete account" });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: username, password: password });
        if (user) {
            res.status(200).json({ success: true, user: user.username });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json({ error: "Server error during login" });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const newUser = new User({ username, email, password });
        await newUser.save(); 
        res.status(201).json({ success: true, message: "User registered in cloud" });
    } catch (err) {
        res.status(500).json({ error: "Registration failed" });
    }
});

app.post('/api/update-password', async (req, res) => {
    try {
        const { username, currentPassword, newPassword } = req.body;
        const user = await User.findOneAndUpdate(
            { username, password: currentPassword },
            { password: newPassword },
            { new: true }
        );
        if (user) {
            res.json({ success: true, message: "Password updated in cloud" });
        } else {
            res.status(401).json({ success: false, message: "Current password incorrect" });
        }
    } catch (err) {
        res.status(500).json({ error: "Server error during password update" });
    }
});

app.post('/api/recover-password', async (req, res) => {
    try {
        const { email, newPass } = req.body;
        const user = await User.findOneAndUpdate({ email: email }, { password: newPass });
        if (!user) return res.status(404).json({ error: "Email not found" });

        const mailOptions = {
            from: '"Vision Draft Support" <ishaanhingway@gmail.com>',
            to: email,
            subject: 'Account Recovery - New Password',
            text: `Your new temporary password is: ${newPass}`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) return res.status(500).json({ error: "Failed to send email" });
            res.status(200).json({ message: "Email sent" });
        });
    } catch (err) {
        res.status(500).json({ error: "Server recovery error" });
    }
});

// ==========================================
// 5. Start the Server
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Vision Draft Backend Active on Port ${PORT}`);
});

module.exports = app;

