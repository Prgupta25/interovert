import nodemailer from 'nodemailer';
import env from '../config/env.js';

export async function sendOtpEmail(email, otp) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: env.emailUser,
      pass: env.emailPass,
    },
  });

  try {
    await transporter.sendMail({
      from: { name: 'Introvert - Login OTP', address: env.emailUser },
      to: email,
      subject: 'LOGIN OTP',
      html: `<pre>Your OTP is : ${otp}</pre>`,
    });
    return true;
  } catch (error) {
    console.error('Email send failed:', error.message);
    return false;
  }
}

export function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
