const fitService = require('../services/googleFit.service');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

// In a real app, you'd extract userId from headers via a middleware
// But for this controller snippet we'll do it manually to keep things simple
const getUserIdFromHeader = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded.userId;
    } catch (err) {
        return null;
    }
}

/**
 * Endpoint to get the OAuth URL that user needs to click
 * GET /api/fit/auth-url
 */
exports.getAuthUrl = (req, res) => {
    // 1. Authenticate user from JWT
    const userId = getUserIdFromHeader(req);

    // Fallback: If no JWT, maybe pass userId via query param for testing?
    const actualUserId = userId || req.query.userId;

    if (!actualUserId) {
        return res.status(401).json({ error: 'Unauthorized: User ID required.' });
    }

    try {
        const url = fitService.getAuthUrl(actualUserId);
        res.json({ url });
    } catch (error) {
        console.error('Error generating Google Fit auth url:', error);
        res.status(500).json({ error: 'Failed to generate auth url.' });
    }
};

/**
 * Callback from Google after user grants permission
 * GET /api/fit/callback
 */
exports.oauthCallback = async (req, res) => {
    const { code, state: userId, error } = req.query;

    if (error) {
        console.error("Google Fit OAuth Error:", error);
        return res.redirect('https://load-app-v1.vercel.app/pages/connect-googlefit.html?error=access_denied');
    }

    try {
        if (!userId) throw new Error("Missing user ID state.");

        // Exchange code for tokens and save to DB
        await fitService.handleCallback(code, userId);

        // Redirect user back to frontend
        res.redirect('https://load-app-v1.vercel.app/pages/dashboard.html?fit_connected=true');

    } catch (err) {
        console.error("Error handling Google Fit callback:", err);
        res.redirect('https://load-app-v1.vercel.app/pages/connect-googlefit.html?error=callback_failed');
    }
};

/**
 * Trigger explicit sync of data
 * GET /api/fit/sync
 */
exports.syncData = async (req, res) => {
    const userId = getUserIdFromHeader(req) || req.query.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User ID required.' });
    }

    try {
        // You could pass req.query.date here to sync specific historical days
        const summary = await fitService.syncUserData(userId);
        res.json({ message: 'Sync successful', data: summary });
    } catch (error) {
        console.error('Error syncing Google Fit data:', error);
        res.status(500).json({ error: 'Failed to sync Google Fit data.', details: error.message });
    }
};
