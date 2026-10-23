import express from 'express';
import { pool } from '../config/db.js';
import nodemailer from 'nodemailer';

const router = express.Router();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const otpStore = new Map();

// 1. Send OTP
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    try {
        const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        if (rows.length > 0) {
            return res.status(400).json({ success: false, message: "Email is already registered! Please login." });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        otpStore.set(email, otp);

        await transporter.sendMail({
            from: `"PadhaiHub" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your PadhaiHub Verification OTP",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #0f5132;">Welcome to PadhaiHub! 🚀</h2>
                    <p>Your verification code is:</p>
                    <h1 style="color: #f0833a; font-size: 32px; letter-spacing: 2px;">${otp}</h1>
                </div>
            `
        });
        
        setTimeout(() => otpStore.delete(email), 5 * 60 * 1000);
        res.status(200).json({ success: true, message: "OTP sent successfully." });

    } catch (error) {
        console.error("Error in send-otp:", error);
        res.status(500).json({ success: false, message: "Failed to send OTP email." });
    }
});

// 2. Verify OTP
router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    const storedOtp = otpStore.get(email);

    if (!storedOtp || storedOtp !== otp) {
        return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
    }

    otpStore.delete(email);
    res.status(200).json({ success: true, message: "OTP verified successfully." });
});

// 3. Save User Profile Details (Including Password)
// 3. Save User Profile Details (Including Password)
router.post('/save-profile', async (req, res) => {
    try {
        const { email, password, fullName, university, course, semester, roll, address, linkedin } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required." });
        }

        // Agar password localStorage mein nahi mila (direct URL hit kiya ho), toh default pass le lo
        const userPassword = password || "default_pass123";

        const query = `
            INSERT INTO users (email, password, fullName, university, course, semester, roll, address, linkedin) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            password = VALUES(password),
            fullName = VALUES(fullName), 
            university = VALUES(university), 
            course = VALUES(course), 
            semester = VALUES(semester), 
            roll = VALUES(roll), 
            address = VALUES(address), 
            linkedin = VALUES(linkedin)
        `;
        
        await pool.query(query, [email, userPassword, fullName || '', university || '', course || '', semester || '', roll || '', address || '', linkedin || '']);
        
        res.status(200).json({ success: true, message: "Profile saved successfully" });

    } catch (error) {
        console.error("❌ Exact Database Error in save-profile:", error.message);
        // Send the exact SQL error message to frontend for debugging
        res.status(500).json({ success: false, message: `DB Error: ${error.message}` });
    }
});

export default router;