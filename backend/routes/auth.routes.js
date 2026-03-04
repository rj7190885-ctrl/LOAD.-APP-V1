const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Route for Google Login POST (API/Fetch)
router.post('/google', authController.googleLogin);

// Route for Google Login POST (Form Redirect)
router.post('/google/callback', express.urlencoded({ extended: true }), authController.googleLoginCallback);

module.exports = router;
