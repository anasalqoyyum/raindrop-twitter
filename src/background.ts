;(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome
  const API_BASE = 'https://api.raindrop.io/rest/v1'
  const MAX_ATTEMPTS = 8
  const pending = new Set<string>()

  class SyncError extends Error {
    constructor(
      message: string,
      readonly status?: number,
      readonly permanent = false
    ) {
      super(message)
    }
  }

  api.runtime.onMessage.addListener((message: unknown, sender) => {
    if (isBookmarkMessage(message)) void handleBookmark(message.tweetId, message.url, sender.tab?.id)
  })

  api.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'retry-queue') void processQueue()
  })

  void (async () => {
    const queue = await storageGet<QueueItem[]>('queue', [])
    if (queue.length) void api.alarms.create('retry-queue', { delayInMinutes: 1 })
  })()

  function isBookmarkMessage(message: unknown): message is BookmarkMessage {
    const m = message as BookmarkMessage | null
    return m?.type === 'bookmark' && typeof m.tweetId === 'string' && typeof m.url === 'string'
  }

  async function handleBookmark(tweetId: string, url: string, tabId?: number) {
    if (pending.has(tweetId)) return
    pending.add(tweetId)
    try {
      const syncedIds = await storageGet<Record<string, number>>('syncedIds', {})
      if (syncedIds[tweetId]) return
      await syncTweet(tweetId, url)
      flashBadge('✓')
      notifyTab(tabId, true, 'Saved to Raindrop')
    } catch (error) {
      await handleFailure({ tweetId, url, attempts: 0 }, error, tabId)
    } finally {
      pending.delete(tweetId)
    }
  }

  async function syncTweet(tweetId: string, url: string) {
    const { token, collectionId, tags } = await getSettings()
    if (!token || !collectionId) {
      throw new SyncError('Not configured: set your Raindrop test token in the options page', undefined, true)
    }
    if (!(await existsInCollection(tweetId, collectionId, token))) {
      await raindropFetch('/raindrop', token, {
        method: 'POST',
        body: JSON.stringify({ link: url, collection: { $id: collectionId }, tags, pleaseParse: {} })
      })
    }
    const syncedIds = await storageGet<Record<string, number>>('syncedIds', {})
    syncedIds[tweetId] = Date.now()
    await api.storage.local.set({ syncedIds })
  }

  async function existsInCollection(tweetId: string, collectionId: number, token: string) {
    try {
      const data = await raindropFetch<{ items?: { link?: string }[] }>(`/raindrops/${collectionId}?search=${tweetId}&perpage=10`, token)
      return (data.items ?? []).some(item => item.link?.includes(`/status/${tweetId}`))
    } catch {
      return false
    }
  }

  async function processQueue() {
    const queue = await storageGet<QueueItem[]>('queue', [])
    if (!queue.length) return
    await api.storage.local.set({ queue: [] })

    for (const item of queue) {
      try {
        const syncedIds = await storageGet<Record<string, number>>('syncedIds', {})
        if (syncedIds[item.tweetId]) continue
        await syncTweet(item.tweetId, item.url)
        flashBadge('✓')
      } catch (error) {
        await handleFailure(item, error)
      }
    }
  }

  async function handleFailure(item: QueueItem, error: unknown, tabId?: number) {
    const status = error instanceof SyncError ? error.status : undefined
    const permanent = error instanceof SyncError && error.permanent
    const retryable = !permanent && (status === undefined || status === 429 || status >= 500)

    if (!retryable || item.attempts + 1 >= MAX_ATTEMPTS) {
      const message = error instanceof Error ? error.message : String(error)
      await logError(`Tweet ${item.tweetId}: ${message}`)
      flashBadge('!')
      notifyTab(tabId, false, message)
      return
    }
    notifyTab(tabId, false, 'Raindrop sync failed — will retry')

    const queue = await storageGet<QueueItem[]>('queue', [])
    if (!queue.some(q => q.tweetId === item.tweetId)) {
      queue.push({ tweetId: item.tweetId, url: item.url, attempts: item.attempts + 1 })
      await api.storage.local.set({ queue })
    }
    void api.alarms.create('retry-queue', { delayInMinutes: Math.min(60, 2 ** item.attempts) })
  }

  async function getSettings(): Promise<Settings & { tags: string[] }> {
    const settings = await storageGet<Settings>('settings', {})
    return { ...settings, tags: settings.tags ?? ['twitter'] }
  }

  async function logError(message: string) {
    const errors = await storageGet<ErrorEntry[]>('errors', [])
    errors.unshift({ time: Date.now(), message })
    await api.storage.local.set({ errors: errors.slice(0, 20) })
  }

  async function storageGet<T>(key: string, fallback: T): Promise<T> {
    const data = await api.storage.local.get(key)
    return (data[key] as T | undefined) ?? fallback
  }

  async function raindropFetch<T = unknown>(path: string, token: string, options: RequestInit = {}): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      })
    } catch (cause) {
      throw new SyncError(`Network error calling ${path}: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
    if (!response.ok) {
      throw new SyncError(`Raindrop API ${path} returned HTTP ${response.status}`, response.status)
    }
    return response.json() as Promise<T>
  }

  function notifyTab(tabId: number | undefined, ok: boolean, message: string) {
    if (tabId === undefined) return
    const payload: SyncResultMessage = { type: 'sync-result', ok, message }
    void Promise.resolve(api.tabs.sendMessage(tabId, payload)).catch(() => {})
  }

  function flashBadge(text: '✓' | '!') {
    void api.action.setBadgeText({ text })
    void api.action.setBadgeBackgroundColor({ color: text === '✓' ? '#2e7d32' : '#c62828' })
    setTimeout(() => void api.action.setBadgeText({ text: '' }), 3000)
  }
})()
