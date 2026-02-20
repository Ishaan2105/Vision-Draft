// ==========================================
// Vision Draft Backend - Unified Server
// ==========================================
require('dotenv').config(); // 1. Load your .env secrets first
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // This allows the server to read email/otp from the request
app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// app.get('/', (req, res) => {
//     res.send("🚀 Vision Draft API is online! Use the frontend dashboard to generate art.");
// });

// ==========================================
// 1. MongoDB Connection & Models
// ==========================================
const MONGO_URI = process.env.MONGO_URI; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// History Schema (Art Gallery)
const History = mongoose.model('History', new mongoose.Schema({
    username: { type: String, required: true },
    prompt: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: String },
    createdAt: { type: Date, default: Date.now }
}));

// User Schema (Keep this for future Login features)
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, 
    createdAt: { type: Date, default: Date.now }
}));

// ==========================================
// 2. Unified Email Transporter
// ==========================================
const transporter = nodemailer.createTransport({
    service: 'gmail', // Adding this explicitly helps Render recognize the provider
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    // Adding these specifically for cloud stability
    connectionTimeout: 10000, 
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
        rejectUnauthorized: false // This prevents timeout/handshake errors on Render
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

// Route: Send Registration OTP
app.post('/send-otp', (req, res) => {
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

// Route: Send Password Recovery Email
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
// 4. MongoDB Art Gallery Routes
// ==========================================

// Route to Save Art to the Database
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

// Route to Load a Specific User's History
app.get('/api/history/:username', async (req, res) => {
    try {
        const art = await History.find({ username: req.params.username }).sort({ createdAt: -1 });
        res.json(art);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

// Route to delete art by its unique MongoDB ID
app.delete('/api/delete-art/:id', async (req, res) => {
    try {
        await History.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted from cloud" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// Route: Permanently delete ALL art for a specific user
// Make sure this path matches exactly what is in script.js
app.delete('/api/clear-history/:username', async (req, res) => {
    try {
        const { username } = req.params;
        // This command wipes every image linked to this specific user
        const result = await History.deleteMany({ username: username }); 
        
        console.log(`Deleted ${result.deletedCount} items for ${username}`);
        res.status(200).json({ message: "History cleared successfully" });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ error: "Failed to clear history" });
    }
});

// DELETE ACCOUNT
// Route: Permanently delete a USER and ALL their art
// Route: Secure Cloud Account Wipe
app.delete('/api/delete-account/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { password } = req.body;

        // Verify password first
        const user = await User.findOne({ username: username, password: password });
        if (!user) return res.status(401).json({ message: "Incorrect password" });

        // Wipe History and User from MongoDB
        await History.deleteMany({ username: username });
        await User.deleteOne({ username: username });

        console.log(`🗑️ Full wipe completed for: ${username}`);
        res.status(200).json({ message: "Account deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete account" });
    }
});

// Route: Global Login Check
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Find user in MongoDB
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


// Route: Register new user to MongoDB
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const newUser = new User({ username, email, password });
        await newUser.save(); 
        res.status(201).json({ success: true, message: "User registered in cloud" });
    } catch (err) {
        res.status(500).json({ error: "Registration failed (Username/Email might exist)" });
    }
});

// Route: Update Password in MongoDB
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

// Route: Cloud-based Password Recovery
app.post('/api/recover-password', async (req, res) => {
    try {
        const { email, newPass } = req.body;
        
        // Update user in MongoDB
        const user = await User.findOneAndUpdate({ email: email }, { password: newPass });

        if (!user) return res.status(404).json({ error: "Email not found in database" });

        const mailOptions = {
            from: '"Vision Draft Support" <ishaanhingway@gmail.com>',
            to: email,
            subject: 'Account Recovery - New Password',
            text: `Your new temporary password for ${user.username} is: ${newPass}`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) return res.status(500).json({ error: "Failed to send email" });
            res.status(200).json({ message: "Cloud updated and email sent" });
        });
    } catch (err) {
        res.status(500).json({ error: "Server recovery error" });
    }
});

// ==========================================
// 5. Start the Server
// ==========================================
app.listen(PORT, () => {
    console.log(`
🚀 Vision Draft Backend is Active!
📍 Local URL: http://localhost:${PORT}
📧 Linked to: ishaanhingway@gmail.com
    `);

});



