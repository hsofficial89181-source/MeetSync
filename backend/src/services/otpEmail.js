/**
 * OTP Email Service
 * Sends password reset OTP emails via Resend SDK
 */

const { Resend } = require('resend');

const FROM = process.env.EMAIL_FROM || 'MeetSync AI <noreply@meetsyncai.net>';

/**
 * Send a 6-digit OTP to the user's email address
 */
async function sendOtpEmail(to, name, otp) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured in environment');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `${otp} is your MeetSync password reset code`,
    html: buildOtpEmail(name, otp),
  });

  if (error) {
    throw new Error(`Resend error: ${error.name} — ${error.message}`);
  }

  if (!data?.id) {
    throw new Error('Resend did not return a message ID — email may not have been sent');
  }

  console.log(`[OTP Email] Sent OTP to ${to} (Resend ID: ${data.id})`);
  return data;
}

function buildOtpEmail(name, otp) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9FAFB;padding:40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;text-align:left;">
          <tr>
            <td style="padding:32px;">
              <!-- Header -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td width="32" height="32" style="background-color:#5B6AF0;border-radius:8px;text-align:center;font-size:16px;color:#FFFFFF;line-height:32px;">
                    ⚡
                  </td>
                  <td style="padding-left:12px;font-size:18px;font-weight:600;color:#111827;">
                    MeetSync
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">Password Reset Code</h2>
              
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4B5563;">
                Hi ${name || 'there'},<br><br>
                We received a request to reset your password. Enter the verification code below to securely complete the process:
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center" style="background-color:#F3F4F6;border-radius:8px;padding:24px;">
                    <div style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:#111827;margin-left:12px;">${otp}</div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;color:#6B7280;">
                This code will expire in <strong>10 minutes</strong>.
              </p>

              <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">

              <p style="margin:0;font-size:13px;line-height:1.6;color:#9CA3AF;">
                If you didn't request a password reset, you can safely ignore this email. Your account remains secure.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-top:24px;color:#9CA3AF;font-size:12px;">
              &copy; ${new Date().getFullYear()} MeetSync AI. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { sendOtpEmail };
