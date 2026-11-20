const mongoose = require('mongoose');

// Helper to mask credentials in connection URI
const sanitizeUri = (rawUri) => {
  if (!rawUri) return '';
  return rawUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

/**
 * Robust URI resolver that checks environment variables and handles common typos/quotes
 */
const getMongoUri = () => {
  const direct = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.MONGO_URI || process.env.DATABASE_URL;
  if (direct) {
    return direct.trim().replace(/^["']|["']$/g, '');
  }

  // Scan process.env for any key with mongo or uri in case of leading/trailing spaces or variations
  for (const key of Object.keys(process.env)) {
    const trimmedKey = key.trim().toUpperCase();
    if (trimmedKey === 'MONGODB_URI' || trimmedKey === 'MONGODB_URL' || trimmedKey === 'MONGO_URI' || trimmedKey === 'DATABASE_URL') {
      const val = process.env[key];
      if (val) {
        return val.trim().replace(/^["']|["']$/g, '');
      }
    }
  }

  return null;
};

/**
 * Check if MongoDB connection is active (1 = connected)
 */
const isMongoConnected = () => {
  return mongoose.connection.readyState === 1;
};

let connectPromise = null;

/**
 * Connect to MongoDB Atlas / Database
 */
const connectDB = async () => {
  const uri = getMongoUri();

  if (!uri) {
    console.warn('[Database Notice] MONGODB_URI is not set in environment variables.');
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (mongoose.connection.readyState === 2 && connectPromise) {
    return await connectPromise;
  }

  connectPromise = (async () => {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
      });

      console.log(`[Database] MongoDB Connected successfully to host: ${conn.connection.host}`);
      return true;
    } catch (error) {
      console.error(`[Database Error] Could not connect to MongoDB Atlas.`);
      console.error(`[Database Error] Details: ${error.message}`);

      if (
        error.message.includes('alert internal error') ||
        error.message.includes('whitelist') ||
        error.message.includes('Could not connect to any servers')
      ) {
        console.warn(`\n[Atlas IP Whitelist Required]:`);
        console.warn(`MongoDB Atlas is actively terminating the connection.`);
        console.warn(`Please ensure 0.0.0.0/0 (Allow from anywhere) is enabled in MongoDB Atlas Network Access:`);
        console.warn(`1. Open https://cloud.mongodb.com`);
        console.warn(`2. Go to Security -> Network Access`);
        console.warn(`3. Click 'Add IP Address' -> 'Allow Access from Anywhere' (0.0.0.0/0)\n`);
      }
      return false;
    } finally {
      connectPromise = null;
    }
  })();

  return await connectPromise;
};

/**
 * Ensure MongoDB is connected before running a critical database operation.
 * If currently connecting, waits up to timeoutMs for the handshake to finish.
 */
const ensureMongoConnected = async (timeoutMs = 8000) => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (mongoose.connection.readyState === 2) {
    const start = Date.now();
    while (mongoose.connection.readyState === 2 && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return mongoose.connection.readyState === 1;
  }

  return await connectDB();
};

// Event Listeners for MongoDB connection lifecycle
mongoose.connection.on('connected', () => {
  console.log('[Database Event] MongoDB connection established.');
});

mongoose.connection.on('reconnected', () => {
  console.log('[Database Event] MongoDB connection reconnected.');
});

mongoose.connection.on('disconnected', () => {
  console.warn('[Database Event] MongoDB connection disconnected.');
});

mongoose.connection.on('error', (err) => {
  console.error('[Database Event] MongoDB runtime error:', err.message);
});

module.exports = {
  connectDB,
  isMongoConnected,
  ensureMongoConnected,
  getMongoUri,
  sanitizeUri,
};
