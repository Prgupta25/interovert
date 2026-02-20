import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  whatsappNumber: { type: String },
  dateOfBirth: { type: Date },
  profile: {
    avatar: { type: String, default: null },
    lookingFor: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    customInterests: { type: [String], default: [] },
    aboutMe: { type: [String], default: [] },
    customAboutMe: { type: [String], default: [] },
    bio: { type: String, default: '' },
    skills: { type: Object, default: {} },
    socialLinks: {
      github: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' },
      instagram: { type: String, default: '' },
      facebook: { type: String, default: '' },
      website: { type: String, default: '' },
    },
  },
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpiry: { type: Date }
}, { timestamps: true });

export default mongoose.model('User', userSchema);