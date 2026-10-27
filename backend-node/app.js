import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import './config/env.js';
import authRoutes from './routes/auth.routes.js'; 
import { fetchYoutubeVideos, categorizeVideosWithLlama } from './services.js';  
import { pool, initDatabase } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());

// AI Categorization Route
app.get('/api/categorize/:topic/:category', async (req, res) => {
    try {
        const topic = decodeURIComponent(req.params.topic);
        const category = req.params.category || 'oneshot';
        console.log(`🔍 Fetching precise videos for: ${topic} [Category: ${category}]...`);
        
        const videoTable = await fetchYoutubeVideos(topic, category);
        const categorizedResult = await categorizeVideosWithLlama(videoTable, topic, category);
        
        res.json({
            success: true,
            topicRequested: topic,
            categoryRequested: category,
            rawVideoData: videoTable,
            aiCategorization: categorizedResult
        });
    } catch (error) {
        console.error("Error in categorization pipeline:", error);
        res.status(500).json({ success: false, error: error.message || "Pipeline failed." });
    }
});

// API Routes
app.use('/api/auth', authRoutes);

// Serve Static Frontend Files
const pagesPath = path.join(__dirname, '../frontend/public/pages');
app.use(express.static(pagesPath));

// Default route -> Start at Login (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(pagesPath, 'index.html'));
});

// AI Categorization Route
app.get('/api/categorize/:topic', async (req, res) => {
    try {
        const topic = req.params.topic;
        console.log(`🔍 Fetching videos for topic: ${topic}...`);
        
        // 1. Get videos with stats from YouTube API
        const videoTable = await fetchYoutubeVideos(topic);
        console.log("✅ Fetched video stats successfully. Sending to Llama 3.1 via Groq...");
        
        // 2. Feed to Llama to categorize
        const categorizedResult = await categorizeVideosWithLlama(videoTable);
        
        // 3. Return structured data to frontend
        res.json({
            success: true,
            topicRequested: topic,
            rawVideoData: videoTable,
            aiCategorization: categorizedResult
        });
    } catch (error) {
        console.error("❌ Error in categorization pipeline:", error);
        res.status(500).json({ success: false, error: error.message || "Pipeline failed." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { role, identifier, password } = req.body;

        if (role === 'visitor') {
            return res.json({ success: true, message: "Visitor access granted." });
        }

        if (role !== 'student') {
            return res.status(501).json({
                success: false,
                error: "Faculty and admin login are not supported by the current users schema."
            });
        }

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                error: "Roll number and password are required."
            });
        }

        const [rows] = await pool.execute(
            "SELECT id, email, fullName, roll FROM users WHERE roll = ? AND password = ?",
            [identifier, password]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: "Invalid credentials or user not found."
            });
        }

        res.json({ success: true, message: "Login successful!", user: rows[0] });
    } catch (error) {
        console.error("Login database error:", error);
        res.status(500).json({ success: false, error: "Server error during login." });
    }
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await initDatabase();
            break;
        } catch (error) {
            if (attempt === 3) {
                throw error;
            }

            const delay = attempt * 2000;
            console.warn(`Database initialization attempt ${attempt}/3 failed; retrying in ${delay / 1000}s.`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

startServer().catch(async (error) => {
    console.error('Server startup failed:', error);
    await pool.end();
    process.exitCode = 1;
});