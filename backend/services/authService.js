import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import env from '../config/env.js';

const OTP_HTML = (otp) => `<p>Your OTP for Introvert is: <strong>${otp}</strong></p><p>It expires in 10 minutes.</p>`;

const RESET_HTML = (resetUrl) => `
  <p>You asked to reset your password for Introvert.</p>
  <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;">Reset password</a></p>
  <p style="color:#666;font-size:14px;">Or copy this link:<br/><span style="word-break:break-all;">${resetUrl}</span></p>
  <p style="color:#666;font-size:14px;">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
`;

async function sendViaNodemailer(email, otp) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: env.emailUser,
      pass: env.emailPass,
    },
  });

  await transporter.sendMail({
    from: { name: 'Introvert - Login OTP', address: env.emailUser },
    to: email,
    subject: 'LOGIN OTP',
    html: OTP_HTML(otp),
  });
}

export async function sendOtpEmail(email, otp) {
  if (env.resendApiKey) {
    try {
      const resend = new Resend(env.resendApiKey);
      const { error } = await resend.emails.send({
        from: env.emailFrom,
        to: email,
        subject: 'Introvert – Login OTP',
        html: OTP_HTML(otp),
      });
      if (!error) return true;
      console.error('Resend email failed, falling back to nodemailer:', error.message);
    } catch (err) {
      console.error('Resend send threw, falling back to nodemailer:', err.message);
    }
  }

  try {
    await sendViaNodemailer(email, otp);
    return true;
  } catch (error) {
    console.error('Nodemailer send failed:', error.message);
    return false;
  }
}

export function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendPasswordResetEmail(email, resetUrl) {
  if (env.resendApiKey) {
    try {
      const resend = new Resend(env.resendApiKey);
      const { error } = await resend.emails.send({
        from: env.emailFrom,
        to: email,
        subject: 'Introvert – Reset your password',
        html: RESET_HTML(resetUrl),
      });
      if (!error) return true;
      console.error('Resend reset email failed, falling back to nodemailer:', error.message);
    } catch (err) {
      console.error('Resend reset threw, falling back to nodemailer:', err.message);
    }
  }

  if (!env.emailUser || !env.emailPass) {
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: env.emailUser,
        pass: env.emailPass,
      },
    });
    await transporter.sendMail({
      from: { name: 'Introvert', address: env.emailUser },
      to: email,
      subject: 'Introvert – Reset your password',
      html: RESET_HTML(resetUrl),
    });
    return true;
  } catch (error) {
    console.error('Nodemailer reset email failed:', error.message);
    return false;
  }
}
