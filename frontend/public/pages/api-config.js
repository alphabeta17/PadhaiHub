const configuredApiBaseUrl = window.PADHAIHUB_API_BASE_URL?.trim().replace(/\/+$/, '');
const API_BASE_URL = configuredApiBaseUrl || (['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : '');

const USER_PROFILE_CACHE_KEY = 'padhaihubUserProfile';

function cacheUserProfile(user, token) {
    if (!user?.email) {
        throw new Error('Cannot cache a profile without an email address.');
    }

    localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(user));
    localStorage.setItem('userEmail', user.email);
    if (token) {
        localStorage.setItem('authToken', token);
    }
}

function getCachedUserProfile() {
    const cachedProfile = localStorage.getItem(USER_PROFILE_CACHE_KEY);
    if (!cachedProfile) {
        return null;
    }

    try {
        return JSON.parse(cachedProfile);
    } catch (error) {
        console.warn('Saved profile cache is invalid and will be cleared.', error);
        localStorage.removeItem(USER_PROFILE_CACHE_KEY);
        return null;
    }
}

function clearUserProfileCache() {
    localStorage.removeItem(USER_PROFILE_CACHE_KEY);
    localStorage.removeItem('userEmail');
    localStorage.removeItem('authToken');
}
