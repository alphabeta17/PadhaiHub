import express from 'express';
import { pool } from '../config/db.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// --- SMTP Nodemailer Setup ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Temporary In-Memory Store for OTPs (Hackathon friendly)
const otpStore = new Map();

// 1. Route to Send OTP
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    // Generate a random 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Save to memory
    otpStore.set(email, otp);

    try {
        // Send actual email
        await transporter.sendMail({
            from: `"PadhaiHub" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your PadhaiHub Login OTP",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #0f5132;">Welcome to PadhaiHub! 🚀</h2>
                    <p>Your verification code for login is:</p>
                    <h1 style="color: #f0833a; font-size: 32px; letter-spacing: 2px;">${otp}</h1>
                    <p style="color: #666; font-size: 12px;">This code is valid for 5 minutes.</p>
                </div>
            `
        });
        
        // Auto delete OTP after 5 minutes
        setTimeout(() => otpStore.delete(email), 5 * 60 * 1000);
        
        res.status(200).json({ success: true, message: "OTP sent successfully to your email." });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ success: false, message: "Failed to send OTP via email." });
    }
});

// 2. Route to Verify OTP
router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    
    // Check if OTP matches what is in memory
    const storedOtp = otpStore.get(email);

    if (!storedOtp || storedOtp !== otp) {
        return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
    }

    // OTP verified successfully, remove it from memory so it can't be reused
    otpStore.delete(email);
    res.status(200).json({ success: true, message: "OTP verified successfully." });
});

// 3. Save or Update User Profile Details
router.post('/save-profile', async (req, res) => {
    try {
        const { email, fullName, university, course, semester, roll, address, linkedin } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        // UPSERT LOGIC: Agar user nahi hai toh Create karo, agar hai toh Update karo
        const query = `
            INSERT INTO users (email, fullName, university, course, semester, roll, address, linkedin) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            fullName = VALUES(fullName), 
            university = VALUES(university), 
            course = VALUES(course), 
            semester = VALUES(semester), 
            roll = VALUES(roll), 
            address = VALUES(address), 
            linkedin = VALUES(linkedin)
        `;

        const [result] = await pool.query(query, [email, fullName, university, course, semester, roll, address, linkedin]);

        res.status(200).json({ success: true, message: "Profile saved successfully" });
    } catch (error) {
        console.error("Error in save-profile:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

export default router;