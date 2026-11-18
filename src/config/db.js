const mongoose = require('mongoose');

let isConnected = false;

// Helper to mask credentials in connection URI
const sanitizeUri = (rawUri) => {
  if (!rawUri) return '';
  return rawUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

/**
 * Connect to MongoDB database
 * Supports both local MongoDB and MongoDB Atlas
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('[Database Notice] MONGODB_URI is not set in environment variables.');
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    isConnected = true;
    console.log(`[Database] MongoDB Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    isConnected = false;
    console.error(`[Database Error] Could not connect to MongoDB Atlas.`);
    console.error(`[Database Error] Details: ${error.message}`);

    if (error.message.includes('alert internal error') || error.message.includes('whitelist') || error.message.includes('Could not connect to any servers')) {
      console.warn(`\n[Atlas IP Whitelist Required]:`);
      console.warn(`MongoDB Atlas is actively terminating the connection.`);
      console.warn(`Please ensure your current public IP is added to the MongoDB Atlas Network Access IP Access List:`);
      console.warn(`1. Open https://cloud.mongodb.com`);
      console.warn(`2. Go to Security -> Network Access`);
      console.warn(`3. Click 'Add IP Address' -> 'Add Current IP Address' or 'Allow Access from Anywhere' (0.0.0.0/0)\n`);
    }
  }
};

// Event Listeners for MongoDB connection
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[Database] MongoDB connection disconnected.');
});

mongoose.connection.on('error', (err) => {
  console.error('[Database Error] Runtime error:', err.message);
});

const isMongoConnected = () => isConnected;

module.exports = {
  connectDB,
  isMongoConnected,
};
