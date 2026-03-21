import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import env from '../config/env.js';

const OTP_HTML = (otp) => `<p>Your OTP for Introvert is: <strong>${otp}</strong></p><p>It expires in 10 minutes.</p>`;

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
