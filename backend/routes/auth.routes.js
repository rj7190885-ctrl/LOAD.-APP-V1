const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Route for Google Login POST
router.post('/google', authController.googleLogin);

module.exports = router;
