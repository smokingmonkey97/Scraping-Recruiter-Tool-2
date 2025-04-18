// testAutomation.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Job = require('./models/Job');
const processAutomationJob = require('./routes/webhook').__getAutomationJob; // see note below

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const jobId = '67ffd9dc3edd54d8c3929741';
  const job = await Job.findById(jobId);
  if (!job) {
    console.error('❌ Job not found');
    return;
  }

  await require('./routes/webhook').processAutomationJob(job, 'manual_test_invoice');
  console.log('✅ Manual automation test complete');
}

main();
