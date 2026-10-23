import dotenv from 'dotenv';
dotenv.config();

// 1. Fetch YouTube Videos and their Statistics
export async function fetchYoutubeVideos(searchQuery) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    // Step A: Search for the top 5 videos
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(searchQuery)}&type=video&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    const videoIds = searchData.items.map(item => item.id.videoId).join(',');

    // Step B: Get the views and comment counts for those specific videos
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

    // Map into a clean table/array format
    return statsData.items.map(item => ({
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        viewCount: item.statistics.viewCount,
        commentCount: item.statistics.commentCount || 0,
        url: `https://www.youtube.com/watch?v=${item.id}`
    }));
}

// 2. Feed the Table to Llama for Categorization
export async function categorizeVideosWithLlama(videosArray) {
    const systemPrompt = `You are a data analyst. I will provide a JSON array of YouTube videos with their publish dates, view counts, and comment counts. 
    Categorize these videos into three distinct groups: 'Trending Now', 'Evergreen/Highly Viewed', and 'High Engagement (Comments)'. 
    Output the result in a clean JSON format.`;
    
    const url = `${process.env.GROQ_BASE_URL}/chat/completions`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant', 
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: JSON.stringify(videosArray) }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" } // Forces Llama to return clean JSON
        })
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}