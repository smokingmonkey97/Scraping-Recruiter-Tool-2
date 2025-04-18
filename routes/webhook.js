// routes/webhook.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const scrapeCandidates = require('../utils/scrapeApollo');
const rankCandidates = require('../utils/rankCandidates');
const sendEmail = require('../utils/sendEmail');
const Job = require('../models/Job');

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Process automation job after payment is confirmed
 * @param {Object} jobData - Job details from MongoDB
 * @param {string} invoiceId - The Stripe invoice ID
 */
async function processAutomationJob(jobData, invoiceId) {
  try {
    console.log(`🚀 Starting automation job for role: ${jobData.roleTitle}`);
    
    // Update job status to processing
    jobData.status = 'processing';
    await jobData.save();
    
    // Step 1: Scrape candidates from Apollo
    console.log(`🔍 Scraping candidates for ${jobData.roleTitle} in ${jobData.jobLocation || 'any location'}`);
    
    const candidates = await scrapeCandidates(
      jobData.roleTitle, 
      jobData.jobLocation || 'London'
    );
    
    if (!candidates || candidates.length === 0) {
      throw new Error('No candidates found. Please check search criteria.');
    }
    
    console.log(`✅ Found ${candidates.length} candidates`);
    
    // Step 2: Rank and score candidates
    console.log(`🔢 Ranking candidates...`);
    
    const rankedCandidates = await rankCandidates(candidates, {
      jobDescription: jobData.jobDescription,
      requiredSkills: jobData.requiredSkills,
      requiredExperience: 0 // Default to 0 if not specified
    });
    
    console.log(`✅ Ranked ${rankedCandidates.length} candidates`);
    
    // Step 3: Create CSV file
    console.log(`📊 Generating CSV report...`);
    
    // Ensure the 'tmp' directory exists
    const tmpDir = path.join(__dirname, '..', 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const csvFilePath = path.join(tmpDir, `candidates_${invoiceId}.csv`);
    
    // Create a CSV writer
    const csvWriter = createObjectCsvWriter({
      path: csvFilePath,
      header: [
        { id: 'name', title: 'Name' },
        { id: 'score', title: 'Match Score' },
        { id: 'confidenceLevel.label', title: 'Confidence' },
        { id: 'title', title: 'Title' },
        { id: 'company', title: 'Company' },
        { id: 'location', title: 'Location' },
        { id: 'experience', title: 'Years of Experience' },
        { id: 'email', title: 'Email' },
        { id: 'linkedin', title: 'LinkedIn' },
        { id: 'skills', title: 'Skills' },
        { id: 'summary', title: 'Summary' },
        { id: 'tags', title: 'Tags' },
        { id: 'source', title: 'Source' }
      ]
    });
    
    // Format candidate data for CSV
    const formattedCandidates = rankedCandidates.map(candidate => ({
      ...candidate,
      skills: Array.isArray(candidate.skills) ? candidate.skills.join(', ') : candidate.skills,
      tags: Array.isArray(candidate.tags) ? candidate.tags.join(', ') : candidate.tags,
      'confidenceLevel.label': candidate.confidenceLevel?.label || 'Unknown'
    }));
    
    // Write to CSV
    await csvWriter.writeRecords(formattedCandidates);
    
    console.log(`✅ CSV created at ${csvFilePath}`);
    
    // Step 4: Send email with CSV attachment
    console.log(`📧 Sending email to ${jobData.companyEmail}...`);
    
    await sendEmail({
      to: jobData.companyEmail,
      subject: `Candidate Shortlist for ${jobData.roleTitle}`,
      body: `
        <p>Hello ${jobData.companyName},</p>
        <p>Thank you for your payment. We've completed the automated candidate search for your <strong>${jobData.roleTitle}</strong> position.</p>
        <p>Attached is a CSV file containing ${rankedCandidates.length} potential candidates ranked by match score.</p>
        <p>The candidates were found based on the following criteria:</p>
        <ul>
          <li><strong>Role:</strong> ${jobData.roleTitle}</li>
          <li><strong>Location:</strong> ${jobData.jobLocation || 'Not specified'}</li>
          <li><strong>Required Skills:</strong> ${jobData.requiredSkills.join(', ') || 'Not specified'}</li>
        </ul>
        <p>The top 3 candidates are:</p>
        <ol>
          ${rankedCandidates.slice(0, 3).map(candidate => `
            <li><strong>${candidate.name}</strong> (${candidate.score}/100) - ${candidate.title} at ${candidate.company}</li>
          `).join('')}
        </ol>
        <p>For each candidate, the CSV includes their match score, contact details (when available), experience, and a detailed summary.</p>
        <p>We hope this helps with your recruitment process!</p>
        <p>Best regards,<br>Automated Recruiter</p>
      `,
      attachments: [
        {
          filename: `${jobData.roleTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_candidates.csv`,
          path: csvFilePath
        }
      ]
    });
    
    console.log(`✅ Email sent to ${jobData.companyEmail}`);
    
    // Update job status
    console.log(`✅ Automation job completed for ${jobData.roleTitle}`);
    return true;
  } catch (error) {
    console.error(`❌ Error processing automation job:`, error);
    
    // Send error notification email to company
    try {
      await sendEmail({
        to: jobData.companyEmail,
        subject: `Issue with Candidate Search for ${jobData.roleTitle}`,
        body: `
          <p>Hello ${jobData.companyName},</p>
          <p>We encountered a technical issue while processing your candidate search for the <strong>${jobData.roleTitle}</strong> position.</p>
          <p>Our team has been notified and we'll resolve this as soon as possible.</p>
          <p>If you have any questions, please reply to this email.</p>
          <p>We apologize for the inconvenience.</p>
          <p>Best regards,<br>Automated Recruiter</p>
        `
      });
    } catch (emailError) {
      console.error('❌ Failed to send error notification email:', emailError);
    }
    
    return false;
  }
}

/**
 * Webhook endpoint to handle Stripe events
 */
router.post('/', async (req, res) => {
  // Verify the webhook signature
  let event;
  try {
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  try {
    // We're only interested in invoice.paid events
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const { jobId } = invoice.metadata || {};
      
      console.log(`💰 Received payment confirmation for invoice ${invoice.id}`);
      
      if (!jobId) {
        console.error(`❌ Cannot find jobId in invoice metadata`);
        return res.status(200).send('No job ID in metadata');
      }
      
      // Find the job in MongoDB
      const job = await Job.findById(jobId);
      
      if (!job) {
        console.error(`❌ Cannot find job with ID: ${jobId}`);
        return res.status(200).send('No matching job found');
      }
      
      // Update job status
      job.status = 'paid';
      job.paidAt = new Date();
      await job.save();
      
      // Process the automation job asynchronously
      // We respond to Stripe before processing is complete to avoid timeout
      processAutomationJob(job, invoice.id)
        .then(async (success) => {
          if (success) {
            // Update job status
            job.status = 'completed';
            job.completedAt = new Date();
            await job.save();
            console.log(`✅ Automation completed for job ${jobId}`);
          } else {
            // Mark job as failed
            job.status = 'failed';
            await job.save();
            console.error(`❌ Automation failed for job ${jobId}`);
          }
        })
        .catch(async (error) => {
          console.error(`❌ Unexpected error in processAutomationJob:`, error);
          job.status = 'error';
          job.error = error.message;
          await job.save();
        });
      
    } else {
      console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }
    
    // Return a 200 response to acknowledge receipt of the event
    res.status(200).json({ received: true });
  } catch (err) {
    console.error(`❌ Error processing webhook:`, err);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

module.exports = router;