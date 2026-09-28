export const PAGE_SIZE = 15

export type UserRow = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: 'user' | 'admin'
  createdAt: Date
  totalRegistrations: number
}