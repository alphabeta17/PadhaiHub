import './config/env.js';

const CATEGORY_SEARCH_TERMS = {
    oneshot: 'one shot revision lecture',
    fulldetail: 'complete course detailed lecture',
    playlist: 'complete lecture playlist'
};

function tokenize(value) {
    return value
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .split(/\s+/)
        .filter(token => token.length > 2);
}

function scoreVideo(video, subject, branch) {
    const subjectTokens = [...new Set(tokenize(`${subject} ${branch || ''}`))];
    const titleTokens = new Set(tokenize(video.title));
    const descriptionTokens = new Set(tokenize(video.description || ''));
    const matchedTitleTerms = subjectTokens.filter(token => titleTokens.has(token)).length;
    const matchedDescriptionTerms = subjectTokens.filter(token => descriptionTokens.has(token)).length;
    const relevanceScore = subjectTokens.length
        ? (matchedTitleTerms * 3 + matchedDescriptionTerms) / (subjectTokens.length * 4)
        : 0;
    const engagementRate = video.viewCount
        ? (video.likeCount + video.commentCount) / video.viewCount
        : 0;

    return { ...video, relevanceScore, engagementRate };
}

function getFallbackCategories(videos) {
    const byRelevance = [...videos].sort((a, b) =>
        b.relevanceScore - a.relevanceScore || b.viewCount - a.viewCount
    );
    const byDepth = [...videos].sort((a, b) =>
        new Date(a.publishedAt) - new Date(b.publishedAt) || b.viewCount - a.viewCount
    );
    const byEngagement = [...videos].sort((a, b) =>
        b.engagementRate - a.engagementRate || b.commentCount - a.commentCount
    );

    return {
        'Top Curated Picks': byRelevance.slice(0, 6),
        'Evergreen Detailed': byDepth.slice(0, 6),
        'High Engagement': byEngagement.slice(0, 6)
    };
}

export async function fetchYoutubeVideos(searchQuery, category = 'oneshot', branch = '') {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        throw new Error('YouTube search is not configured. Set YOUTUBE_API_KEY on the backend.');
    }

    const queryTerms = [
        `"${searchQuery}"`,
        branch,
        CATEGORY_SEARCH_TERMS[category] || CATEGORY_SEARCH_TERMS.oneshot,
        'lecture tutorial'
    ].filter(Boolean);
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.search = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        videoCategoryId: '27',
        maxResults: '25',
        order: 'relevance',
        relevanceLanguage: 'en',
        safeSearch: 'strict',
        q: queryTerms.join(' '),
        key: apiKey
    }).toString();

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    if (!searchResponse.ok) {
        throw new Error(searchData.error?.message || 'YouTube search failed.');
    }

    const searchItems = (searchData.items || []).filter(item => item.id?.videoId);
    if (searchItems.length === 0) {
        throw new Error(`No educational videos found for "${searchQuery}". Try a shorter subject name.`);
    }

    const videoIds = searchItems.map(item => item.id.videoId).join(',');
    const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    statsUrl.search = new URLSearchParams({
        part: 'snippet,statistics',
        id: videoIds,
        key: apiKey
    }).toString();

    const statsResponse = await fetch(statsUrl);
    const statsData = await statsResponse.json();
    if (!statsResponse.ok) {
        throw new Error(statsData.error?.message || 'Could not load YouTube video details.');
    }

    const videosById = new Map((statsData.items || []).map(item => [item.id, item]));
    return searchItems
        .map(searchItem => {
            const item = videosById.get(searchItem.id.videoId);
            if (!item) return null;

            return {
                id: item.id,
                title: item.snippet.title,
                description: item.snippet.description,
                channel: item.snippet.channelTitle,
                channelUrl: `https://www.youtube.com/channel/${item.snippet.channelId}`,
                thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || '',
                publishedAt: item.snippet.publishedAt,
                viewCount: Number(item.statistics.viewCount || 0),
                commentCount: Number(item.statistics.commentCount || 0),
                likeCount: Number(item.statistics.likeCount || 0),
                url: `https://www.youtube.com/watch?v=${item.id}`
            };
        })
        .filter(Boolean);
}

export async function categorizeVideosWithLlama(videosArray, subject, category, branch = '') {
    const scoredVideos = videosArray.map(video => scoreVideo(video, subject, branch));
    const fallbackCategories = getFallbackCategories(scoredVideos);
    const apiKey = process.env.GROQ_API_KEY;
    const baseUrl = process.env.GROQ_BASE_URL;
    if (!apiKey || !baseUrl) {
        console.warn('Groq AI is not configured; returning relevance-ranked YouTube results.');
        return fallbackCategories;
    }

    const candidates = scoredVideos.map(({ id, title, description, channel, publishedAt, viewCount, likeCount, commentCount, relevanceScore }) => ({
        id,
        title,
        description: description.slice(0, 500),
        channel,
        publishedAt,
        viewCount,
        likeCount,
        commentCount,
        relevanceScore
    }));
    const systemPrompt = `You are a strict academic video relevance ranker. The requested subject is "${subject}"${branch ? ` in the "${branch}" branch` : ''}; study format is "${category}".
Only recommend candidates that directly teach this subject at college or engineering level. Exclude unrelated topics, entertainment, motivational content, and videos that only mention a matching keyword. Do not invent IDs or videos.
Return JSON only with these exact keys: "Top Curated Picks", "Evergreen Detailed", "High Engagement". Each value must be an array of candidate ID strings copied from the supplied data. Top picks should be the most relevant and instructional; evergreen should favor comprehensive lectures and playlists; engagement should favor useful, well-engaged instruction. A candidate may appear in only one group.`;

    try {
        const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: JSON.stringify(candidates) }
                ],
                temperature: 0,
                response_format: { type: 'json_object' }
            })
        });
        const data = await response.json();
        if (!response.ok || !data.choices?.[0]?.message?.content) {
            throw new Error(data.error?.message || 'AI ranking returned no results.');
        }

        const result = JSON.parse(data.choices[0].message.content);
        const candidateById = new Map(scoredVideos.map(video => [video.id, video]));
        const usedIds = new Set();
        const validated = {};

        for (const key of ['Top Curated Picks', 'Evergreen Detailed', 'High Engagement']) {
            const ids = result[key];
            if (!Array.isArray(ids)) {
                throw new Error(`AI ranking response is missing "${key}".`);
            }

            validated[key] = ids
                .filter(id => typeof id === 'string' && candidateById.has(id) && !usedIds.has(id))
                .slice(0, 8)
                .map(id => {
                    usedIds.add(id);
                    return candidateById.get(id);
                });
        }

        if (Object.values(validated).every(group => group.length === 0)) {
            throw new Error('AI ranking did not return any valid candidate IDs.');
        }

        return validated;
    } catch (error) {
        console.warn('AI ranking failed; using relevance-ranked results:', error.message);
        return fallbackCategories;
    }
}
