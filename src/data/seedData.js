/**
 * SkillSwap - Categories & Configuration
 * NOTE: Absolutely NO fake users, fake student profiles, or fake reviews are stored here.
 * SkillSwap is 100% user-driven.
 */

// Platform categories taxonomy
const categories = [
  {
    id: 'cat-1',
    name: 'Web & Programming',
    icon: 'code',
    description: 'Web development, debugging, algorithms & coding help',
    count: 0,
  },
  {
    id: 'cat-2',
    name: 'Academic Tutoring',
    icon: 'book-open',
    description: 'Math, Physics, Chemistry, CS & Exam prep',
    count: 0,
  },
  {
    id: 'cat-3',
    name: 'Design & Creative',
    icon: 'palette',
    description: 'UI/UX design, Figma, logos & poster graphics',
    count: 0,
  },
  {
    id: 'cat-4',
    name: 'Writing & Translation',
    icon: 'feather',
    description: 'Essay editing, resume reviews & foreign languages',
    count: 0,
  },
  {
    id: 'cat-5',
    name: 'AI & Data Science',
    icon: 'cpu',
    description: 'Python, ML models, data visualization & analytics',
    count: 0,
  },
  {
    id: 'cat-6',
    name: 'Video & Audio',
    icon: 'video',
    description: 'Shorts editing, podcast audio & motion graphics',
    count: 0,
  },
  {
    id: 'cat-7',
    name: 'Business & Marketing',
    icon: 'trending-up',
    description: 'Social media, pitch decks & market research',
    count: 0,
  },
];

// Initial services is strictly EMPTY. Only real registered students populate this.
const initialServices = [];

module.exports = {
  initialServices,
  categories,
};
