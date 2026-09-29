export const PAGE_SIZE = 24

export type MediaAssetRow = {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  size: number
  url: string
  key: string
  width: number | null
  height: number | null
  uploadedBy: string | null
  uploadedByName: string | null
  uploadedByRole: 'user' | 'admin'
  createdAt: string
}

export type MediaFilter = 'all' | 'mine' | 'admin' | 'user'