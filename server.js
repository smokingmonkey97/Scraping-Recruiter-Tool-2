// Main server file
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const submitRoute = require('./routes/submit');
const webhookRoute = require('./routes/webhook');

// Load environment variables
dotenv.config();

// Connect to MongoDB (this needs to be before route imports)
require('./db/connection');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

// Stripe webhook (needs to come BEFORE bodyParser.json)
app.use('/api/webhook', bodyParser.raw({ type: 'application/json' }), webhookRoute);

// Regular parsers and routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/submit', submitRoute);

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`💻 View the app at http://localhost:${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

function shutDown() {
  console.log('Received kill signal, shutting down gracefully');
  
  // Close MongoDB connection
  const mongoose = require('mongoose');
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
  
  // If MongoDB doesn't close in time, force exit
  setTimeout(() => {
    console.error('Could not close MongoDB connection in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
}

module.exports = app; // For testing purposes