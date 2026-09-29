import { relations } from "drizzle-orm/_relations";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  integer,
  numeric,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// =====================================================
// BETTER AUTH
// =====================================================
export const userRoleEnum = pgEnum("user_role", [
  "user",
  "admin",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),

  name: text("name").notNull(),

  email: text("email").notNull().unique(),

  emailVerified: boolean("email_verified")
    .default(false)
    .notNull(),

  image: text("image"),

  role: userRoleEnum("role")
    .default("user")
    .notNull(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// =====================================================
// EMPLOYEE DEMAND
// =====================================================

export const employeeDemand = pgTable("employee_demand", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  iconUrl: text("icon_url"),
  description: text("description"),
  keyFeatures: jsonb("key_features"),
});

// =====================================================
// INTERNSHIPS
// =====================================================

export const internships = pgTable(
  "internships",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),

    demandId: text("demand_id")
      .notNull()
      .references(() => employeeDemand.id, {
        onDelete: "restrict",
      }),

    description: text("description"),

    lastSubmissionDate: timestamp("last_submission_date"),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),

    jdUrl: text("jd_url"),

    price: numeric("price", {
      precision: 10,
      scale: 2,
    }),

    sellingPrice: numeric("selling_price", {
      precision: 10,
      scale: 2,
    }),

    examinerName: text("examiner_name"),
    examinerPhotoUrl: text("examiner_photo_url"),

    totalScore: integer("total_score").default(100).notNull(),

    isPublic: boolean("is_public").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("internships_demand_id_idx").on(table.demandId),
  ],
);
// =====================================================
// INTERNSHIP REGISTRATION
// =====================================================

export const internshipRegistration = pgTable(
  "internship_registration",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    internshipId: text("internship_id")
      .notNull()
      .references(() => internships.id, {
        onDelete: "cascade",
      }),

    coverLetter: text("cover_letter"),
    resumeUrl: text("resume_url"),

    gainScore: integer("gain_score").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("internship_registration_user_id_idx").on(table.userId),
    index("internship_registration_internship_id_idx").on(
      table.internshipId,
    ),
  ],
);

// =====================================================
// EXAMS
// =====================================================

export const exams = pgTable(
  "exams",
  {
    id: text("id").primaryKey(),

    internshipId: text("internship_id")
      .notNull()
      .references(() => internships.id, {
        onDelete: "cascade",
      }),

    orderNo: integer("order_no").notNull(),

    name: text("name").notNull(),

    description: text("description"),

    // Duration in minutes
    duration: integer("duration").notNull(),

    totalMarks: integer("total_marks").default(100).notNull(),

    passingMarks: integer("passing_marks"),

    isPublic: boolean("is_public").default(false).notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("exams_internship_id_idx").on(table.internshipId),
  ],
);

// =====================================================
// EXAM QUESTIONS
// =====================================================

export const examQuestions = pgTable(
  "exam_questions",
  {
    id: text("id").primaryKey(),

    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, {
        onDelete: "cascade",
      }),

    name: text("name").notNull(),

    marks: integer("marks").default(1).notNull(),

    details: text("details"),

    // mcq | text | code | voice
    type: text("type").notNull(),

    defaultText: text("default_text"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("exam_questions_exam_id_idx").on(table.examId),
  ],
);

// =====================================================
// QUESTION MCQs
// =====================================================

export const questionMcqs = pgTable(
  "question_mcqs",
  {
    id: text("id").primaryKey(),

    questionId: text("question_id")
      .notNull()
      .references(() => examQuestions.id, {
        onDelete: "cascade",
      }),

    labelText: text("label_text").notNull(),

    isCorrect: boolean("is_correct").default(false).notNull(),
  },
  (table) => [
    index("question_mcqs_question_id_idx").on(table.questionId),
  ],
);

// =====================================================
// EXAM SUBMISSION
// =====================================================

export const examSubmission = pgTable(
  "exam_submission",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, {
        onDelete: "cascade",
      }),

    answers: jsonb("answers"),

    signature: text("signature"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    submittedAt: timestamp("submitted_at"),
  },
  (table) => [
    index("exam_submission_user_id_idx").on(table.userId),
    index("exam_submission_exam_id_idx").on(table.examId),
  ],
);

// =====================================================
// QUESTION SUBMISSION
// =====================================================

export const questionSubmission = pgTable(
  "question_submission",
  {
    id: text("id").primaryKey(),

    questionId: text("question_id")
      .notNull()
      .references(() => examQuestions.id, {
        onDelete: "cascade",
      }),

    examSubmissionId: text("exam_submission_id")
      .notNull()
      .references(() => examSubmission.id, {
        onDelete: "cascade",
      }),

    optionId: text("option_id").references(() => questionMcqs.id, {
      onDelete: "set null",
    }),

    // Used for text/code/voice answers
    text: text("text"),

    isCorrect: boolean("is_correct"),
  },
  (table) => [
    index("question_submission_question_id_idx").on(
      table.questionId,
    ),
    index("question_submission_exam_submission_id_idx").on(
      table.examSubmissionId,
    ),
  ],
);

// =====================================================
// TEAM
// =====================================================

export const team = pgTable(
  "team",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    demandId: text("demand_id")
      .notNull()
      .references(() => employeeDemand.id, {
        onDelete: "restrict",
      }),

    internshipId: text("internship_id")
      .notNull()
      .references(() => internships.id, {
        onDelete: "cascade",
      }),

    score: integer("score").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("team_demand_id_idx").on(table.demandId),
    index("team_internship_id_idx").on(table.internshipId),
  ],
);

// =====================================================
// TEAM GOALS
// =====================================================

export const teamGoals = pgTable(
  "team_goals",
  {
    id: text("id").primaryKey(),

    teamId: text("team_id")
      .notNull()
      .references(() => team.id, {
        onDelete: "cascade",
      }),

    text: text("text").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("team_goals_team_id_idx").on(table.teamId),
  ],
);

// =====================================================
// TEAM FINAL RESULT
// =====================================================

export const teamFinalResult = pgTable(
  "team_final_result",
  {
    id: text("id").primaryKey(),

    teamId: text("team_id")
      .notNull()
      .references(() => team.id, {
        onDelete: "cascade",
      }),

    score: integer("score").notNull(),

    result: text("result").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("team_final_result_team_id_idx").on(table.teamId),
  ],
);

// =====================================================
// RELATIONS
// =====================================================

// ---------- AUTH ----------

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  internshipRegistrations: many(internshipRegistration),
  examSubmissions: many(examSubmission),
  teamMemberships: many(teamMember),
  payments: many(payments),
  messages: many(messages),
  profile: one(profile), // ← add
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// ---------- EMPLOYEE DEMAND ----------

export const employeeDemandRelations = relations(
  employeeDemand,
  ({ many }) => ({
    internships: many(internships),
    teams: many(team),
  }),
);

// ---------- INTERNSHIPS ----------

export const internshipsRelations = relations(
  internships,
  ({ one, many }) => ({
    demand: one(employeeDemand, {
      fields: [internships.demandId],
      references: [employeeDemand.id],
    }),

    registrations: many(internshipRegistration),
    exams: many(exams),
    teams: many(team),
  }),
);

// ---------- INTERNSHIP REGISTRATION ----------

export const internshipRegistrationRelations = relations(
  internshipRegistration,
  
  ({ one }) => ({
    user: one(user, {
      fields: [internshipRegistration.userId],
      references: [user.id],
    }),

    

    internship: one(internships, {
      fields: [internshipRegistration.internshipId],
      references: [internships.id],
    }),
  }),


  
);

// ---------- EXAMS ----------

export const examsRelations = relations(exams, ({ one, many }) => ({
  internship: one(internships, {
    fields: [exams.internshipId],
    references: [internships.id],
  }),

  questions: many(examQuestions),
  submissions: many(examSubmission),
}));

// ---------- EXAM QUESTIONS ----------

export const examQuestionsRelations = relations(
  examQuestions,
  ({ one, many }) => ({
    exam: one(exams, {
      fields: [examQuestions.examId],
      references: [exams.id],
    }),

    mcqs: many(questionMcqs),
    submissions: many(questionSubmission),
  }),
);

// ---------- QUESTION MCQS ----------

export const questionMcqsRelations = relations(
  questionMcqs,
  ({ one, many }) => ({
    question: one(examQuestions, {
      fields: [questionMcqs.questionId],
      references: [examQuestions.id],
    }),

    submissions: many(questionSubmission),
  }),
);

// ---------- EXAM SUBMISSION ----------

export const examSubmissionRelations = relations(
  examSubmission,
  ({ one, many }) => ({
    user: one(user, {
      fields: [examSubmission.userId],
      references: [user.id],
    }),

    exam: one(exams, {
      fields: [examSubmission.examId],
      references: [exams.id],
    }),

    questionSubmissions: many(questionSubmission),
  }),
);

// ---------- QUESTION SUBMISSION ----------

export const questionSubmissionRelations = relations(
  questionSubmission,
  ({ one }) => ({
    question: one(examQuestions, {
      fields: [questionSubmission.questionId],
      references: [examQuestions.id],
    }),

    examSubmission: one(examSubmission, {
      fields: [questionSubmission.examSubmissionId],
      references: [examSubmission.id],
    }),

    option: one(questionMcqs, {
      fields: [questionSubmission.optionId],
      references: [questionMcqs.id],
    }),
  }),
);

// ---------- TEAM ----------

export const teamRelations = relations(team, ({ one, many }) => ({
  demand: one(employeeDemand, {
    fields: [team.demandId],
    references: [employeeDemand.id],
  }),
  messages: many(messages),
  internship: one(internships, {
    fields: [team.internshipId],
    references: [internships.id],
  }),
  goals: many(teamGoals),
  finalResults: many(teamFinalResult),
  members: many(teamMember), // NEW
}));

// ---------- TEAM GOALS ----------

export const teamGoalsRelations = relations(teamGoals, ({ one }) => ({
  team: one(team, {
    fields: [teamGoals.teamId],
    references: [team.id],
  }),
}));

// ---------- TEAM FINAL RESULT ----------

export const teamFinalResultRelations = relations(
  teamFinalResult,
  ({ one }) => ({
    team: one(team, {
      fields: [teamFinalResult.teamId],
      references: [team.id],
    }),
  }),
);


export const teamMember = pgTable(
  "team_member",
  {
    id: text("id").primaryKey(),

    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Denormalized so we can enforce "one team per student per internship"
    internshipId: text("internship_id")
      .notNull()
      .references(() => internships.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("team_member_team_id_idx").on(table.teamId),
    index("team_member_user_id_idx").on(table.userId),
    index("team_member_internship_id_idx").on(table.internshipId),
    uniqueIndex("team_member_user_internship_unique").on(
      table.userId,
      table.internshipId
    ),
  ]
);

// Relations me bhi add karo:

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, {
    fields: [teamMember.teamId],
    references: [team.id],
  }),
  user: one(user, {
    fields: [teamMember.userId],
    references: [user.id],
  }),
}));







export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),

    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Rich text (Tiptap HTML) — null when the message is a code message
    text: text("text"),

    // Code content + language — null when the message is a text message
    code: text("code"),
    codeLanguage: text("code_language"),

    isEdited: boolean("is_edited").default(false).notNull(),

    // true when the message was sent by an admin
    byAdmin: boolean("by_admin").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("messages_team_id_idx").on(table.teamId),
    index("messages_user_id_idx").on(table.userId),
  ]
);


export const messagesRelations = relations(messages, ({ one }) => ({
  team: one(team, {
    fields: [messages.teamId],
    references: [team.id],
  }),
  user: one(user, {
    fields: [messages.userId],
    references: [user.id],
  }),
}));



export const profile = pgTable(
  "profile",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Basic
    headline: text("headline"), // e.g. "Full Stack Developer | Final year CSE"
    bio: text("bio"),
    phone: text("phone"),

    // Education
    collegeName: text("college_name"),
    universityName: text("university_name"),
    degree: text("degree"), // e.g. "B.Tech Computer Science"
    branch: text("branch"), // e.g. "CSE"
    rollNumber: text("roll_number"),
    graduationYear: integer("graduation_year"),
    cgpa: numeric("cgpa", { precision: 4, scale: 2 }),

    // Address / Location
    city: text("city"),
    state: text("state"),
    country: text("country").default("India"),
    pincode: text("pincode"),

    // Links
    githubUrl: text("github_url"),
    linkedinUrl: text("linkedin_url"),
    portfolioUrl: text("portfolio_url"),
    twitterUrl: text("twitter_url"),

    // Skills — jsonb array of strings
    skills: jsonb("skills").$type<string[]>().default([]),

    // Languages known — jsonb array
    languages: jsonb("languages").$type<string[]>().default([]),

    // Experience — jsonb array of objects
    // [{ company, role, duration, description }]
    experience: jsonb("experience")
      .$type<
        {
          company: string;
          role: string;
          duration: string;
          description?: string;
        }[]
      >()
      .default([]),

    // Projects — jsonb array of objects
    // [{ name, description, link, techStack }]
    projects: jsonb("projects")
      .$type<
        {
          name: string;
          description?: string;
          link?: string;
          techStack?: string[];
        }[]
      >()
      .default([]),

    // Achievements / Certifications — jsonb array
    achievements: jsonb("achievements").$type<string[]>().default([]),

    // Resume
    resumeUrl: text("resume_url"),

    // Meta
    isPublic: boolean("is_public").default(true).notNull(),
    profileCompletion: integer("profile_completion").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("profile_user_id_idx").on(table.userId)]
);

// Relations
export const profileRelations = relations(profile, ({ one }) => ({
  user: one(user, {
    fields: [profile.userId],
    references: [user.id],
  }),
}));




export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
]);

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  
  registrationId: text("registration_id")
    .notNull()
    .references(() => internshipRegistration.id, { onDelete: "cascade" }),
  
  internshipId: text("internship_id")
    .notNull()
    .references(() => internships.id, { onDelete: "cascade" }),
  
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("INR").notNull(),
  
  status: paymentStatusEnum("status").default("pending").notNull(),
  
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySignature: text("razorpay_signature"),
  
  failureReason: text("failure_reason"),
  
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("payments_user_id_idx").on(table.userId),
  index("payments_registration_id_idx").on(table.registrationId),
  index("payments_internship_id_idx").on(table.internshipId),
  index("payments_razorpay_order_id_idx").on(table.razorpayOrderId),
]);