// ==========================================
// Vision Draft Backend - Unified Server
// ==========================================
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 10000;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ==========================================
// 1. MongoDB Connection
// ==========================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

const History = mongoose.model('History', new mongoose.Schema({
    username: { type: String, required: true },
    prompt: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: String },
    createdAt: { type: Date, default: Date.now }
}));

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, 
    createdAt: { type: Date, default: Date.now }
}));

// ==========================================
// 2. Unified Gmail API Helper
// ==========================================
const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

/**
 * Sends an email using the Gmail API (Port 443 - Bypasses Render Firewalls)
 */
const sendGmail = async (to, subject, bodyContent) => {
    try {
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `From: Vision Draft <${process.env.EMAIL_USER}>`,
            `To: ${to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            bodyContent,
        ];
        const message = messageParts.join('\n');

        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage },
        });
        return true;
    } catch (error) {
        console.error('❌ Gmail API Error:', error.message);
        throw error;
    }
};

// ==========================================
// 3. Authentication & Recovery Routes
// ==========================================

// Route for Registration OTP
app.post('/send-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).send("Email and OTP are required");

    try {
        await sendGmail(email, 'Your Vision Draft Verification Code', `Your verification code is: <b>${otp}</b>`);
        console.log(`✅ OTP sent successfully to ${email}`);
        res.status(200).send("OTP Sent successfully");
    } catch (err) {
        res.status(500).send("Failed to send OTP email.");
    }
});

// Generic Reset Email Route
app.post('/send-reset-email', async (req, res) => {
    const { email, newPass } = req.body;
    if (!email || !newPass) return res.status(400).send("Email and password required");

    try {
        await sendGmail(email, 'Account Recovery - New Password', `Your new temporary password is: <b>${newPass}</b>`);
        res.status(200).send("Recovery email sent");
    } catch (error) {
        res.status(500).send("Failed to send recovery email.");
    }
});

// Full API Recovery Route
app.post('/api/recover-password', async (req, res) => {
    try {
        const { email, newPass } = req.body;
        const user = await User.findOneAndUpdate({ email: email }, { password: newPass });
        if (!user) return res.status(404).json({ error: "Email not found" });

        await sendGmail(email, 'Account Recovery - New Password', `Your new temporary password is: <b>${newPass}</b>`);
        console.log(`✅ Recovery email sent to ${email}`);
        res.status(200).json({ message: "Recovery email sent" });
    } catch (err) {
        res.status(500).json({ error: "Server recovery error" });
    }
});

// ==========================================
// 4. API Routes (History & User Management)
// ==========================================

// --- ADMIN ROUTE ---
// Access this at: https://vision-draft.onrender.com/api/admin/all-users
app.get('/api/admin/all-users', async (req, res) => {
    try {
        const users = await User.find({}, 'username email createdAt'); // Password hidden for security
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Error fetching user list" });
    }
});

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
        await History.deleteMany({ username: username }); 
        res.status(200).json({ message: "History cleared successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to clear history" });
    }
});

app.delete('/api/delete-account/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { password } = req.body;
        const user = await User.findOne({ username, password });
        if (!user) return res.status(401).json({ message: "Incorrect password" });
        await History.deleteMany({ username });
        await User.deleteOne({ username });
        res.status(200).json({ message: "Account deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete account" });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
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

// ==========================================
// 5. Start the Server
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Vision Draft Backend Active on Port ${PORT}`);
});

module.exports = app;
