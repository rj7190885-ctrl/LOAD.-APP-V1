const express = require('express');
const router = express.Router();
const fitController = require('../controllers/fit.controller');

// Trigger the OAuth flow (Returns redirect URL to Google)
router.get('/auth-url', fitController.getAuthUrl);

// The callback URL registered in Google Cloud Console
router.get('/callback', fitController.oauthCallback);

// Endpoint to trigger a data sync (Frontend can call this periodically)
router.get('/sync', fitController.syncData);

module.exports = router;
