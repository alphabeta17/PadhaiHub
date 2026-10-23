import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // 1. Import cors
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchYoutubeVideos, categorizeVideosWithLlama } from './services.js';

dotenv.config();
const app = express();

app.use(cors()); // 2. Enable CORS for all origins
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optional: Serve frontend static files from public/pages if running everything from port 5000
app.use(express.static(path.join(__dirname, '../frontend/public/pages')));

app.get('/api/categorize/:topic/:category', async (req, res) => {
    try {
        const topic = decodeURIComponent(req.params.topic); // Safely decode topic string
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running live on http://localhost:${PORT}`);
});