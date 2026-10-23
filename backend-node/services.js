import dotenv from 'dotenv';
dotenv.config();

// 1. Fetch YouTube Videos with Tightened Search Query
export async function fetchYoutubeVideos(searchQuery, category = 'oneshot') {
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    // Query refinement based on category to get accurate academic results
    let modifier = "engineering lecture tutorial";
    if (category === 'oneshot') modifier = "one shot full revision lecture";
    else if (category === 'fulldetail') modifier = "complete course detailed explanation unit wise";
    else if (category === 'playlist') modifier = "full playlist complete syllabus";

    const preciseQuery = `${searchQuery} ${modifier}`;
    
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(preciseQuery)}&type=video&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (!searchData.items || searchData.items.length === 0) {
        throw new Error("No precise videos found on YouTube for this topic.");
    }

    const videoIds = searchData.items.map(item => item.id.videoId).filter(Boolean).join(',');

    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

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

// 2. Strict Prompt Tightening for Groq Llama 3.1
export async function categorizeVideosWithLlama(videosArray, subject, category) {
    const systemPrompt = `You are an elite AI curriculum curator for engineering students. 
    You will receive a JSON array of YouTube videos for the subject "${subject}" under the selected category type: "${category}".
    
    CRITICAL INSTRUCTIONS:
    1. Filter out completely irrelevant, clickbait, or entertainment videos that do not match academic learning for "${subject}".
    2. Rank and categorize the remaining videos into three strict groups based on quality and relevance: 'Top Curated Picks', 'Evergreen Detailed', and 'High Engagement'.
    3. Output the result strictly in valid JSON format matching these exact keys: {"Top Curated Picks": [...], "Evergreen Detailed": [...], "High Engagement": [...]}.`;

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
                temperature: 0.1, // Lower temperature for high precision and zero hallucination
                response_format: { type: "json_object" } 
            })
        });

        const data = await response.json();

        if (!response.ok || !data.choices || !data.choices[0]) {
            throw new Error(data.error?.message || "Failed to get response from Groq Llama API.");
        }

        return JSON.parse(data.choices[0].message.content);

    } catch (error) {
        console.warn("⚠️ Groq AI call failed, using smart fallback:", error.message);
        return {
            "Top Curated Picks": videosArray.slice(0, 4),
            "Evergreen Detailed": videosArray.slice(4, 8),
            "High Engagement": videosArray.slice(8, 12)
        };
    }
}