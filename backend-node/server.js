import express from 'express';
import dotenv from 'dotenv';
import { fetchYoutubeVideos, categorizeVideosWithLlama } from './sevices.js'; 

dotenv.config();
const app = express();
app.use(express.json());

app.get('/api/categorize/:topic', async (req, res) => {
    try {
        const topic = req.params.topic;
        console.log(`Fetching videos for: ${topic}...`);

        // 1. Get the table of videos with stats from YouTube
        const videoTable = await fetchYoutubeVideos(topic);
        console.log("Fetched video stats successfully. Sending to Llama...");

        // 2. Feed the table to Llama to categorize them
        const categorizedResult = await categorizeVideosWithLlama(videoTable);

        // 3. Return the final structured data to your frontend
        res.json({
            topicRequested: topic,
            rawVideoData: videoTable,
            aiCategorization: categorizedResult
        });

    } catch (error) {
        console.error("Error in categorization pipeline:", error);
        res.status(500).json({ error: "Pipeline failed." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}/api/categorize/statics`);
});