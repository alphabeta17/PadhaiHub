import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

function getSessionSecret() {
    const secret = process.env.SESSION_SECRET || process.env.DB_PASSWORD;
    if (!secret) {
        throw new Error('SESSION_SECRET must be set to issue authentication tokens.');
    }

    return secret;
}

function sign(payload) {
    return createHmac('sha256', getSessionSecret())
        .update(payload)
        .digest('base64url');
}

export function createSessionToken(email) {
    const payload = Buffer.from(JSON.stringify({
        email,
        expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
    })).toString('base64url');

    return `${payload}.${sign(payload)}`;
}

export function requireSession(req, res, next) {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer ([\w.-]+)$/);

    if (!match) {
        return res.status(401).json({ success: false, message: 'Please log in to access your profile.' });
    }

    try {
        const [payload, providedSignature] = match[1].split('.');
        if (!payload || !providedSignature) {
            return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
        }

        const expectedSignature = sign(payload);
        const provided = Buffer.from(providedSignature, 'base64url');
        const expected = Buffer.from(expectedSignature, 'base64url');
        if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
            return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
        }

        const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (typeof session.email !== 'string' || session.expiresAt <= Math.floor(Date.now() / 1000)) {
            return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
        }

        req.user = { email: session.email };
        next();
    } catch (error) {
        if (error.message === 'SESSION_SECRET must be set to issue authentication tokens.') {
            return next(error);
        }
        return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
    }
}
