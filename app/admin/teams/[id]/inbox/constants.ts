import { z } from 'zod'

export const MESSAGE_KINDS = ['text', 'code'] as const
export type MessageKind = (typeof MESSAGE_KINDS)[number]

export const MESSAGE_PAGE_SIZE = 20

export const sendMessageSchema = z
  .object({
    kind: z.enum(MESSAGE_KINDS),
    text: z.string().max(50_000).optional().nullable(),
    code: z.string().max(50_000).optional().nullable(),
    codeLanguage: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'text') {
      const stripped = (data.text ?? '').replace(/<[^>]*>/g, '').trim()
      if (stripped.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Message cannot be empty.',
          path: ['text'],
        })
      }
    } else if (data.kind === 'code') {
      if (!data.code || data.code.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Code cannot be empty.',
          path: ['code'],
        })
      }
    }
  })

export type SendMessageInput = z.infer<typeof sendMessageSchema>

export type TeamMessage = {
  id: string
  teamId: string
  userId: string
  authorName: string
  authorEmail: string
  authorImage: string | null
  authorRole: 'user' | 'admin'
  text: string | null
  code: string | null
  codeLanguage: string | null
  isEdited: boolean
  byAdmin: boolean
  createdAt: string // serialize as ISO string across RSC boundary
}

export type TeamMemberSummary = {
  userId: string
  name: string
  email: string
  image: string | null
  role: 'user' | 'admin'
  isAdmin: boolean
}

export type TeamHeader = {
  id: string
  name: string
  internshipName: string
  demandName: string
  memberCount: number
  score: number
}

/** Cursor for pagination — oldest message currently loaded */
export type MessageCursor = {
  createdAt: string
  id: string
} | null