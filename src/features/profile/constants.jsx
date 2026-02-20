import React from 'react';
import { GraduationCap, MapPin, Edit2, Baby, Briefcase } from 'lucide-react';

export const lookingForOptions = [
  { id: 'hobbies', label: 'Practice Hobbies', icon: '🎨' },
  { id: 'socialize', label: 'Socialize', icon: '💭' },
  { id: 'friends', label: 'Make Friends', icon: '👥' },
  { id: 'network', label: 'Professionally Network', icon: '💼' },
];

export const interestOptions = [
  'Small Business Marketing', 'Group Singing', 'Poker', 'Acoustic Guitar',
  'Photography', 'Hiking', 'Cooking', 'Reading', 'Traveling', 'Yoga',
  'Painting', 'Dancing', 'Writing', 'Coding', 'Gardening', 'Other',
];

export const aboutMeOptions = [
  { id: 'graduate', label: 'Recent Graduate', icon: <GraduationCap size={20} /> },
  { id: 'student', label: 'Student', icon: '🎒' },
  { id: 'newInTown', label: 'New In Town', icon: <MapPin size={20} /> },
  { id: 'emptyNester', label: 'New Empty Nester', icon: '🏠' },
  { id: 'retired', label: 'Newly Retired', icon: <Edit2 size={20} /> },
  { id: 'parent', label: 'New Parent', icon: <Baby size={20} /> },
  { id: 'careerChange', label: 'Career Change', icon: <Briefcase size={20} /> },
];

export const skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
