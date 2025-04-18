// routes/submit.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const dotenv = require('dotenv');
const Job = require('../models/Job');

dotenv.config();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Handle job submission and create Stripe invoice
 */
router.post('/', async (req, res) => {
  try {
    // Extract data from request
    const {
      companyName,
      roleTitle,
      jobLocation,
      salary,
      jobDescription,
      requiredSkills,
      companyEmail
    } = req.body;
    
    // Validate required fields
    if (!companyName || !roleTitle || !salary || !companyEmail) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields. Please provide company name, role title, salary, and company email.'
      });
    }
    
    // Validate salary
    const salaryNumber = parseFloat(salary);
    if (isNaN(salaryNumber) || salaryNumber <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid salary amount.'
      });
    }
    
    // Calculate 1% fee
    const feeAmount = Math.round(salaryNumber * 0.01 * 100); // Convert to cents for Stripe
    
    // Create a new job in MongoDB
    const job = new Job({
      companyName,
      roleTitle,
      jobLocation,
      salary: salaryNumber,
      jobDescription,
      requiredSkills: requiredSkills ? requiredSkills.split(',').map(skill => skill.trim()) : [],
      companyEmail,
      status: 'pending'
    });
    
    // Save the job to get its MongoDB ID
    await job.save();
    
    console.log(`📝 Job submission received for ${roleTitle} at ${companyName}`);
    
    // Create Stripe customer for this company
    const customer = await stripe.customers.create({
      email: companyEmail,
      name: companyName,
      metadata: {
        jobId: job._id.toString(), // Use MongoDB ObjectId as jobId
        roleTitle
      }
    });

    // First, create the invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 7, // Pay within 7 days
      metadata: {
        jobId: job._id.toString(), // Use MongoDB ObjectId as jobId
        roleTitle,
        jobLocation,
        companyEmail
      }
    });

    // Next, add the invoice item to the existing invoice
    await stripe.invoiceItems.create({
      customer: customer.id,
      amount: feeAmount,
      currency: 'gbp',
      description: `Automated candidate shortlist for ${roleTitle}`,
      invoice: invoice.id  // Reference to the invoice we just created
    });

    // Just before finalizing, reinforce metadata on invoice
await stripe.invoices.update(invoice.id, {
  metadata: {
    jobId: job._id.toString(),
    roleTitle,
    jobLocation,
    companyEmail
  }
});

// Now finalize the invoice
await stripe.invoices.finalizeInvoice(invoice.id);

    // Wait a short time to ensure everything is processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Finally, send the invoice
    await stripe.invoices.sendInvoice(invoice.id);
    
    // Update job record with Stripe data
    job.invoiceId = invoice.id;
    job.customerId = customer.id;
    await job.save();
    
    console.log(`💰 Invoice created for ${companyName}: £${(feeAmount / 100).toFixed(2)}`);
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Job submitted successfully. Invoice has been sent to your email.',
      jobId: job._id,
      invoice: {
        id: invoice.id,
        amount: feeAmount / 100, // Convert back to pounds for display
        url: invoice.hosted_invoice_url
      }
    });
    
  } catch (error) {
    console.error('❌ Error in job submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process your submission. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;