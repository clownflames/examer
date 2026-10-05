/**
 * Seed data catalogue — the vocabulary the seed scripts draw from.
 *
 * Kept separate from the scripts so the wording can be edited without
 * touching generation logic.
 */

/* -------------------------------------------------------------------------- */
/*  Demands                                                                    */
/* -------------------------------------------------------------------------- */

export type DemandTemplate = {
  slug: string
  name: string
  description: string
  keyFeatures: string[]
}

export const DEMAND_TEMPLATES: DemandTemplate[] = [
  {
    slug: 'frontend-development',
    name: 'Frontend Development',
    description:
      'Build responsive, accessible user interfaces with React, TypeScript and modern CSS.',
    keyFeatures: [
      'Component-driven architecture',
      'State management',
      'Responsive design',
      'Web performance',
      'Accessibility (WCAG)',
    ],
  },
  {
    slug: 'backend-development',
    name: 'Backend Development',
    description:
      'Design reliable APIs and services with Node.js, PostgreSQL and Redis.',
    keyFeatures: [
      'REST / GraphQL APIs',
      'Database modelling',
      'Authentication & authorisation',
      'Caching strategy',
      'Background jobs',
    ],
  },
  {
    slug: 'full-stack-development',
    name: 'Full Stack Development',
    description:
      'Own features end to end — from database schema to deployed, observable UI.',
    keyFeatures: [
      'API design',
      'Server-side rendering',
      'CI/CD pipelines',
      'Testing strategy',
      'Monitoring',
    ],
  },
  {
    slug: 'data-science',
    name: 'Data Science',
    description:
      'Turn raw data into decisions using statistics, Python and machine learning.',
    keyFeatures: [
      'Data wrangling',
      'Statistical modelling',
      'Machine learning',
      'Data visualisation',
      'Experiment design',
    ],
  },
  {
    slug: 'data-analytics',
    name: 'Data Analytics',
    description:
      'Build dashboards and reports that answer real business questions.',
    keyFeatures: [
      'SQL fluency',
      'KPI design',
      'Dashboarding',
      'Data cleaning',
      'Stakeholder reporting',
    ],
  },
  {
    slug: 'mobile-development',
    name: 'Mobile Development',
    description:
      'Ship cross-platform apps with React Native and native platform APIs.',
    keyFeatures: [
      'React Native',
      'Offline-first design',
      'Push notifications',
      'App store releases',
      'Native modules',
    ],
  },
  {
    slug: 'devops',
    name: 'DevOps & Cloud',
    description:
      'Automate delivery and run infrastructure reliably on AWS and Kubernetes.',
    keyFeatures: [
      'Docker & Kubernetes',
      'Terraform / IaC',
      'CI/CD pipelines',
      'Observability',
      'Incident response',
    ],
  },
  {
    slug: 'ui-ux-design',
    name: 'UI/UX Design',
    description:
      'Research, design and validate interfaces users actually understand.',
    keyFeatures: [
      'User research',
      'Wireframing',
      'Design systems',
      'Prototyping',
      'Usability testing',
    ],
  },
  {
    slug: 'machine-learning',
    name: 'Machine Learning',
    description:
      'Train, evaluate and productionise models that hold up on real data.',
    keyFeatures: [
      'Feature engineering',
      'Model evaluation',
      'MLOps',
      'Prompt engineering',
      'Model deployment',
    ],
  },
  {
    slug: 'cybersecurity',
    name: 'Cybersecurity',
    description:
      'Assess, harden and monitor systems against real-world threats.',
    keyFeatures: [
      'Threat modelling',
      'Penetration testing',
      'Secure code review',
      'Incident detection',
      'Compliance',
    ],
  },
  {
    slug: 'digital-marketing',
    name: 'Digital Marketing',
    description:
      'Grow products through measurable, data-driven campaigns.',
    keyFeatures: [
      'SEO',
      'Paid acquisition',
      'Content strategy',
      'Analytics',
      'A/B testing',
    ],
  },
  {
    slug: 'product-management',
    name: 'Product Management',
    description:
      'Decide what to build, why, and prove that it worked.',
    keyFeatures: [
      'Roadmapping',
      'User discovery',
      'Prioritisation',
      'A/B testing',
      'Stakeholder alignment',
    ],
  },
]

/* -------------------------------------------------------------------------- */
/*  Internships                                                                */
/* -------------------------------------------------------------------------- */

export const INTERNSHIP_ROLES = [
  'Software Engineering Intern',
  'Developer Intern',
  'Graduate Trainee',
  'Technical Intern',
  'Associate Engineer',
  'Engineering Intern',
]

export const INTERNSHIP_VARIANTS = [
  'Remote',
  'Hybrid',
  'On-site',
  'Remote-first',
]

/** Company names live inside the internship title, not a column. */
export const COMPANIES = [
  'Northwind Labs',
  'Vertex Systems',
  'Lumen Analytics',
  'Orbit Software',
  'Cobalt Digital',
  'Harbour Tech',
  'Pinnacle Works',
  'Riverstone',
  'Solstice AI',
  'Trailhead',
  'Nimbus Cloud',
  'Copperline',
]

export const EXAMINERS = [
  'Dr. Ananya Iyer',
  'Rohan Mehta',
  'Sneha Kulkarni',
  'Imran Sheikh',
  'Priya Nair',
  'Aditya Bose',
  'Kavya Reddy',
  'Devansh Gupta',
  'Meera Joshi',
  'Zoya Ahmed',
]

/* -------------------------------------------------------------------------- */
/*  Exams                                                                      */
/* -------------------------------------------------------------------------- */

export const EXAM_NAMES = [
  'Technical Screening',
  'Role Fit Assessment',
  'Final Evaluation',
  'Practical Round',
]

export const EXAM_DESCRIPTIONS = [
  'Covers fundamentals and problem solving relevant to the role.',
  'Assesses how you approach realistic problems and trade-offs.',
  'End-to-end evaluation before the offer conversation.',
  'Hands-on round — build, test and explain your approach.',
]

export const QUESTION_BANK: Record<
  'mcq' | 'text' | 'code',
  { name: string; details: string; options: string[] }[]
> = {
  mcq: [
    {
      name: 'Which HTTP status code indicates a resource was created?',
      details: 'Pick the single best answer.',
      options: ['200 OK', '201 Created', '204 No Content', '301 Moved Permanently'],
    },
    {
      name: 'What does database normalisation primarily reduce?',
      details: 'Think about redundancy.',
      options: [
        'Query latency',
        'Data redundancy',
        'Disk usage',
        'Network calls',
      ],
    },
    {
      name: 'Which time complexity is O(n log n)?',
      details: 'Standard sorting complexity.',
      options: ['Bubble sort', 'Binary search (worst case)', 'Merge sort', 'Linear scan'],
    },
    {
      name: 'What is the purpose of an index in a relational database?',
      details: 'Choose the best description.',
      options: [
        'To enforce uniqueness only',
        'To speed up lookups at a storage cost',
        'To compress data',
        'To replicate data',
      ],
    },
    {
      name: 'Which statement about closures in JavaScript is true?',
      details: 'Pick the accurate one.',
      options: [
        'Closures are only valid inside loops',
        'A closure keeps access to its outer scope after the outer function returns',
        'Closures cannot capture variables',
        'Closures are a browser-only feature',
      ],
    },
  ],
  text: [
    {
      name: 'How would you debug a production incident you were paged for?',
      details:
        'Describe your process. Mention what you would measure before changing anything.',
      options: [],
    },
    {
      name: 'Explain a technical decision you made that you later reversed.',
      details: 'Focus on what changed your mind and what you learned.',
      options: [],
    },
    {
      name: 'How do you decide what to test and what to skip?',
      details: 'Give a concrete prioritisation approach.',
      options: [],
    },
  ],
  code: [
    {
      name: 'Write a function that returns the top N frequent items from an array.',
      details:
        'Aim for a clear, efficient solution. Add a short complexity note.',
      options: [],
    },
    {
      name: 'Implement a debounce function in JavaScript.',
      details: 'Handle cancellation and `this` correctly.',
      options: [],
    },
    {
      name: 'Write a SQL query to find duplicate email addresses per organisation.',
      details: 'Return the organisation and the duplicated email.',
      options: [],
    },
  ],
}

/* -------------------------------------------------------------------------- */
/*  Teams                                                                      */
/* -------------------------------------------------------------------------- */

export const TEAM_PREFIXES = [
  'Falcon',
  'Orbit',
  'Nimbus',
  'Zephyr',
  'Cobalt',
  'Vertex',
  'Aurora',
  'Quartz',
]

export const TEAM_SUFFIXES = [
  'Squad',
  'Crew',
  'Collective',
  'Guild',
  'Lab',
  'Pod',
]
