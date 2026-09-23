import type { IconName } from '../shared/icon';

export interface SocialLink {
  label: string;
  href: string;
  icon: IconName;
}

export interface NavLink {
  label: string;
  fragment?: string;
  path?: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Home', fragment: 'home' },
  { label: 'About', fragment: 'about' },
  { label: 'Impact', fragment: 'impact' },
  { label: 'Research', fragment: 'research' },
  { label: 'Blog', path: '/blog' },
  { label: 'Contact', fragment: 'contact' },
];

export const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@InnovativeSTEMPendagogyHub',
    icon: 'play',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/rose-mutende-5a27aa226/',
    icon: 'network',
  },
  {
    label: 'Google Scholar',
    href: 'https://scholar.google.com/citations?user=02BHQKMAAAAJ&hl=en',
    icon: 'cap',
  },
];

export const PROFILE = {
  name: 'Dr. Rose Atieno Mutende',
  credential: 'Doctor of Education, Curriculum Studies',
  affiliation: 'Kibabii University',
  roles: [
    'Curriculum Specialist',
    'STEM Educator',
    'Science Teacher Educator',
    'STEM Center Coordinator',
    'PhET Fellow',
    'LabXchange Ambassador',
    'Researcher',
  ],
  heroSummary:
    'Experienced STEM educator and curriculum specialist with a passion for transforming teaching practices through innovative pedagogy, technology integration, and impactful research. Dedicated to empowering educators and learners by developing user-friendly STEM resources and promoting quality, equity, and inclusivity in education.',
  bio: "Dr. Rose Atieno Mutende holds a Doctor of Education (Curriculum Studies) from the University of Nairobi, a Master of Education (Science Teacher Education) from Aga Khan University, and a Bachelor of Education (Science) from Moi University. She is a dedicated STEM educator and curriculum specialist with over two decades of experience in transforming instructional practices through innovative pedagogy and technology integration.",
  degrees: [
    { level: 'Doctor of Education', field: 'Curriculum Studies', school: 'University of Nairobi' },
    { level: 'Master of Education', field: 'Science Teacher Education', school: 'Aga Khan University' },
    { level: 'Bachelor of Education', field: 'Science', school: 'Moi University' },
  ],
  expertise: [
    'Curriculum Design & Implementation',
    'STEM Pedagogy',
    'Teacher Training & Professional Development',
    'Technology Integration in Education',
    'Quality Assurance & Auditing',
    'Research & Publication',
    'Workshop Facilitation',
    'Open Education Resources (OER)',
    'Blended Learning & Moodle Platform',
  ],
  cvUrl: 'documents/dr-rose-atieno-mutende-cv.pdf',
  portraitUrl: 'images/rose-mutende.png',
  contact: {
    emails: ['rmutende@kibu.ac.ke', 'rose.oranga89@gmail.com'],
    phone: '+254 724 400 442',
    address: 'P.O. Box 1699-50200, Bungoma, Kenya',
  },
};

export interface Stat {
  value: string;
  label: string;
}

export const STATS: Stat[] = [
  { value: '500+', label: 'Educators trained' },
  { value: '10+', label: 'Research papers published' },
  { value: '15+', label: 'Workshops facilitated' },
  { value: '20+', label: 'Years in STEM education' },
];

export interface Milestone {
  title: string;
  detail: string;
}

export const MILESTONES: Milestone[] = [
  {
    title: 'Curriculum reform leadership',
    detail: 'Held key leadership roles in national curriculum reform, shaping how STEM subjects are taught across schools.',
  },
  {
    title: 'Teacher training at scale',
    detail: 'Trained 500+ educators in STEM teaching methodologies through workshops and professional development programmes.',
  },
  {
    title: 'Open educational resources',
    detail: 'Designed and published Open Educational Resources (OER), widening free access to quality STEM teaching materials.',
  },
  {
    title: 'STEM advocacy',
    detail: 'Promoted STEM education through outreach, mentorship, and public initiatives aimed at learners and educators alike.',
  },
  {
    title: 'Awards & recognition',
    detail: 'Recipient of multiple STEM education awards recognising contributions to curriculum and pedagogy.',
  },
];

export interface ProfileLink {
  label: string;
  href: string;
}

export const RESEARCH = {
  stats: [
    { value: '10+', label: 'Peer-reviewed research papers' },
    { value: '5+', label: 'International conference presentations' },
  ] as Stat[],
  profiles: [
    { label: 'ORCID Profile', href: 'https://orcid.org/0000-0003-0030-1113' },
    { label: 'Google Scholar', href: 'https://scholar.google.com/citations?user=02BHQKMAAAAJ&hl=en' },
  ] as ProfileLink[],
};

export const CERTIFICATIONS: string[] = ['ISO 9001:2008 Internal Quality Auditor', 'Corporate Governance Training'];

export const CONFERENCES: string[] = ['STEM Education Conference, 2021', '15+ professional development workshops attended'];
