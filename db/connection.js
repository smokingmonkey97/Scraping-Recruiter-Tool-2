// db/connection.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Get MongoDB connection string from environment variable
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MongoDB connection string (MONGO_URI) is not defined in environment variables');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Connected to MongoDB Atlas');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

module.exports = mongoose.connection;