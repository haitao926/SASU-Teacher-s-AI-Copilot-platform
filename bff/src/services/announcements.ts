import prisma from '../utils/prisma'

export interface AnnouncementPayload {
  title: string
  content: string
  tag?: string
  tagType?: string
  pinned?: boolean
}

export interface AnnouncementView {
  id: string
  title: string
  content: string
  tag: string | null
  tagType: string
  pinned: boolean
  time: string
}

export async function listAnnouncements(): Promise<AnnouncementView[]> {
  const items = await prisma.announcement.findMany({
    orderBy: [
      { pinned: 'desc' },
      { createdAt: 'desc' }
    ]
  })

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    content: item.content,
    tag: item.tag,
    tagType: item.tagType,
    pinned: item.pinned,
    time: item.createdAt.toISOString()
  }))
}

export async function createAnnouncement(
  payload: AnnouncementPayload,
  authorId: string
) {
  return prisma.announcement.create({
    data: {
      title: payload.title,
      content: payload.content,
      tag: payload.tag,
      tagType: payload.tagType ?? 'info',
      pinned: payload.pinned ?? false,
      authorId
    }
  })
}

export async function deleteAnnouncement(id: string) {
  await prisma.announcement.delete({ where: { id } })
  return { success: true }
}
