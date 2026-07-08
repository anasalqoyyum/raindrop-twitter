declare const browser: typeof chrome | undefined

interface Settings {
  token?: string
  collectionId?: number
  collectionName?: string
  tags?: string[]
}

interface BookmarkMessage {
  type: 'bookmark'
  tweetId: string
  url: string
}

interface SyncResultMessage {
  type: 'sync-result'
  ok: boolean
  message: string
}

interface QueueItem {
  tweetId: string
  url: string
  attempts: number
}

interface ErrorEntry {
  time: number
  message: string
}

interface RaindropCollection {
  _id: number
  title: string
}
