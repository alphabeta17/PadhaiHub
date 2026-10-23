import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js'; 
import { fetchYoutubeVideos, categorizeVideosWithLlama } from './services.js';  
import { initDatabase } from './config/db.js';// Make sure file name case matches exactly

dotenv.config();

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

// Server Listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`Server is running live on http://localhost:${PORT}`);
    // Initialize MySQL Tables and Seed Data
    await initDatabase();
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