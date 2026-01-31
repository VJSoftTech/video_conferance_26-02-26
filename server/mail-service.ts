import nodemailer from 'nodemailer';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getEncryptionKey(): string {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 16) {
    throw new Error('SESSION_SECRET must be set and at least 16 characters for SMTP password encryption');
  }
  return key;
}

function getKey(): Buffer {
  return crypto.createHash('sha256').update(getEncryptionKey()).digest();
}

export function encryptPassword(password: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptPassword(encryptedPassword: string): string {
  try {
    const [ivHex, encrypted] = encryptedPassword.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt password:', error);
    return '';
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName?: string;
}

export async function sendMeetingInvite(
  smtpConfig: SmtpConfig,
  recipientEmail: string,
  recipientName: string | undefined,
  meetingTitle: string,
  meetingDate: Date,
  meetingDuration: number,
  roomId: string,
  meetingLink: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password,
      },
    });

    const formattedDate = meetingDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .meeting-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .btn { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
          .footer { text-align: center; padding: 15px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">You're Invited to a Meeting</h1>
          </div>
          <div class="content">
            <p>Hello${recipientName ? ` ${recipientName}` : ''},</p>
            <p>You have been invited to join a meeting on பேசு தமிழ்.</p>
            
            <div class="meeting-details">
              <h3 style="margin-top: 0;">${meetingTitle}</h3>
              <p><strong>Date & Time:</strong> ${formattedDate}</p>
              <p><strong>Duration:</strong> ${meetingDuration} minutes</p>
              <p><strong>Meeting ID:</strong> ${roomId}</p>
            </div>
            
            <p>Click the button below to join the meeting:</p>
            <a href="${meetingLink}" class="btn">Join Meeting</a>
            
            <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
              Or copy this link: ${meetingLink}
            </p>
          </div>
          <div class="footer">
            <p>Sent via பேசு தமிழ் - Video Conferencing</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const fromAddress = smtpConfig.fromName 
      ? `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`
      : smtpConfig.fromEmail;

    await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: `Meeting Invite: ${meetingTitle}`,
      html,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

export async function testSmtpConnection(smtpConfig: SmtpConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password,
      },
    });

    await transporter.verify();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
