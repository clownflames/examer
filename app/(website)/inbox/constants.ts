export type MessageKind = "text" | "code";

export type MessageCursor = {
  createdAt: string;
  id: string;
} | null;

export type TeamMessage = {
  id: string;
  text: string | null;
  code: string | null;
  codeLanguage: string | null;
  isEdited: boolean;
  byAdmin: boolean;
  createdAt: string;
  userId: string;
  authorName: string;
  authorImage: string | null;
};

export type TeamMemberSummary = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
};

export type TeamHeader = {
  id: string;
  name: string;
  internshipName: string;
  demandName: string;
  memberCount: number;
  score: number;
};

export type UserTeam = {
  id: string;
  name: string;
  internshipName: string;
  demandName: string;
  iconUrl: string | null;
  memberCount: number;
  score: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
};