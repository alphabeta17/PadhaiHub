import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// Save or Update User Profile Details
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