const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send an email using Resend
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.body - HTML content of the email
 * @param {Array} [options.attachments] - Array of { filename, path }
 */
async function sendEmail({ to, subject, body, attachments = [] }) {
  try {
    // Format attachments to Resend-compatible format
    const formattedAttachments = attachments.map(file => ({
      filename: file.filename,
      content: fs.readFileSync(path.resolve(file.path)).toString('base64'),
      type: 'text/csv' // or application/pdf etc.
    }));

    // Send the email via Resend
    const response = await resend.emails.send({
      from: process.env.SENDER_EMAIL, // Must match a verified sender in Resend
      to,
      subject,
      html: body,
      attachments: formattedAttachments
    });

    console.log(`✅ Email sent to ${to}`);
    return response;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

module.exports = sendEmail;
