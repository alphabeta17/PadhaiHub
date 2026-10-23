import dotenv from 'dotenv';
dotenv.config();

// 1. Fetch YouTube Videos and their Statistics
export async function fetchYoutubeVideos(searchQuery) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    // Step A: Search for the top videos
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(searchQuery)}&type=video&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (!searchData.items || searchData.items.length === 0) {
        throw new Error("No videos found on YouTube for this topic.");
    }

    const videoIds = searchData.items.map(item => item.id.videoId).filter(Boolean).join(',');

    // Step B: Get views, comments, and thumbnails for those specific videos
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

    // Map into a clean array format
    return statsData.items.map(item => ({
        id: item.id,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        channelUrl: `https://www.youtube.com/@${item.snippet.channelTitle.replace(/\s+/g, '')}`,
        thumbnail: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : '',
        publishedAt: item.snippet.publishedAt,
        viewCount: parseInt(item.statistics.viewCount || 0),
        commentCount: parseInt(item.statistics.commentCount || 0),
        likeCount: parseInt(item.statistics.likeCount || 0),
        url: `https://www.youtube.com/watch?v=${item.id}`
    }));
}

// 2. Feed the Table to Llama via Groq for Categorization
// 2. Feed the Table to Llama via Groq for Categorization
export async function categorizeVideosWithLlama(videosArray) {
    const systemPrompt = `You are an expert data analyst and educational curator. I will provide a JSON array of YouTube videos with publish dates, view counts, and comment counts. Categorize these videos into three distinct groups: 'Trending Now', 'Evergreen/Highly Viewed', and 'High Engagement (Comments)'. Output the result in a clean JSON format matching these exact keys.`;

    const url = `${process.env.GROQ_BASE_URL}/chat/completions`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192', 
                messages: [
                    { role: 'system', content: systemPrompt }, 
                    { role: 'user', content: JSON.stringify(videosArray) }
                ],
                temperature: 0.2,
                response_format: { type: "json_object" } 
            })
        });

        const data = await response.json();

        // Agar Groq ne koi error message return kiya hai toh use console par print karein
        if (!response.ok || !data.choices || !data.choices[0]) {
            console.error("❌ Groq API Detailed Error:", JSON.stringify(data, null, 2));
            throw new Error(data.error?.message || "Failed to get response from Groq Llama API.");
        }

        return JSON.parse(data.choices[0].message.content);

    } catch (error) {
        console.warn("⚠️ Groq AI call failed. Using fallback categorization so UI doesn't break:", error.message);
        
        // Fallback categorization agar Groq API fail ya rate-limit ho jaye
        return {
            "Trending Now": videosArray.slice(0, 4),
            "Evergreen/Highly Viewed": videosArray.slice(4, 7),
            "High Engagement (Comments)": videosArray.slice(7, 10)
        };
    }
}