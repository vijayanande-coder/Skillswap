const mongoose = require('mongoose');
require('dotenv').config();

const Service = require('../models/Service');
const { initialServices } = require('../data/seedData');

const seedDatabase = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillswap';

  console.log(`[Seed Script] Connecting to database: ${uri}...`);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('[Seed Script] Connected successfully.');

    // Clear existing services
    await Service.deleteMany({});
    console.log('[Seed Script] Cleared old services.');

    // Insert initial seed set
    const docs = await Service.insertMany(initialServices);
    console.log(`[Seed Script] Successfully inserted ${docs.length} student services!`);

    await mongoose.disconnect();
    console.log('[Seed Script] Database disconnected cleanly.');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Script Error]:', error.message);
    process.exit(1);
  }
};

seedDatabase();
