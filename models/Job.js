// models/Job.js
const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  // Company and role information
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  roleTitle: {
    type: String,
    required: true,
    trim: true
  },
  jobLocation: {
    type: String,
    trim: true
  },
  salary: {
    type: Number,
    required: true
  },
  jobDescription: {
    type: String
  },
  requiredSkills: {
    type: [String]
  },
  companyEmail: {
    type: String,
    required: true,
    trim: true
  },
  
  // Stripe information
  invoiceId: {
    type: String,
    sparse: true
  },
  customerId: {
    type: String,
    sparse: true
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'paid', 'processing', 'completed', 'failed', 'error'],
    default: 'pending'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  paidAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  
  // Error information
  error: {
    type: String
  }
});

// Create an index for faster lookups
JobSchema.index({ invoiceId: 1 });
JobSchema.index({ customerId: 1 });

module.exports = mongoose.model('Job', JobSchema);