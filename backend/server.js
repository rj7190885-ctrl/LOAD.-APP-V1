require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the LOAD API', status: 'Active' });
});

// Basic Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Routes API
app.use('/api/auth', require('./routes/auth.routes'));
// app.use('/api/user', require('./routes/user.routes'));

// Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
