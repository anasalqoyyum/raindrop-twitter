;(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome
  const API_BASE = 'https://api.raindrop.io/rest/v1'
  const DEFAULT_COLLECTION = 'Twitter Bookmark'
  const ORIGINS = ['https://api.raindrop.io/*', 'https://x.com/*', 'https://twitter.com/*']

  const els = {
    token: document.getElementById('token') as HTMLInputElement,
    collection: document.getElementById('collection') as HTMLSelectElement,
    tags: document.getElementById('tags') as HTMLInputElement,
    save: document.getElementById('save') as HTMLButtonElement,
    status: document.getElementById('status') as HTMLParagraphElement,
    errors: document.getElementById('errors') as HTMLUListElement,
    clearErrors: document.getElementById('clear-errors') as HTMLButtonElement
  }

  async function init() {
    const settings = await getSettings()
    els.token.value = settings.token ?? ''
    els.tags.value = (settings.tags ?? ['twitter']).join(', ')
    if (settings.collectionId && settings.collectionName) {
      renderCollections([{ _id: settings.collectionId, title: settings.collectionName }], settings.collectionId)
    }
    await renderErrors()

    els.save.addEventListener('click', () => void saveAndTest())
    els.collection.addEventListener('change', async () => {
      const title = els.collection.selectedOptions[0]?.textContent ?? ''
      await patchSettings({ collectionId: Number(els.collection.value), collectionName: title })
      setStatus(`Saving to "${title}"`, 'ok')
    })
    els.tags.addEventListener('change', async () => {
      await patchSettings({ tags: parseTags() })
      setStatus('Tags saved', 'ok')
    })
    els.clearErrors.addEventListener('click', async () => {
      await api.storage.local.set({ errors: [] })
      await renderErrors()
    })
  }

  async function saveAndTest() {
    const token = els.token.value.trim()
    if (!token) return setStatus('Paste your test token first', 'error')

    const granted = await api.permissions.request({ origins: ORIGINS })
    if (!granted) return setStatus('Host permissions were not granted', 'error')

    setStatus('Testing…')
    let user: { fullName?: string; email?: string }
    try {
      user = (await raindropFetch<{ user: { fullName?: string; email?: string } }>('/user', token)).user
    } catch (error) {
      return setStatus(`Token rejected: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }

    try {
      const collections = await loadCollections(token)
      const settings = await getSettings()
      let target = collections.find(c => c._id === settings.collectionId)
      if (!target) {
        target = collections.find(c => c.title === DEFAULT_COLLECTION) ?? (await createCollection(token))
        if (!collections.includes(target)) collections.push(target)
      }
      await patchSettings({ token, collectionId: target._id, collectionName: target.title, tags: parseTags() })
      renderCollections(collections, target._id)
      setStatus(`Connected as ${user.fullName ?? user.email ?? 'your account'} — saving to "${target.title}"`, 'ok')
    } catch (error) {
      setStatus(`Connected, but collection setup failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  async function loadCollections(token: string) {
    const [root, children] = await Promise.all([
      raindropFetch<{ items?: RaindropCollection[] }>('/collections', token),
      raindropFetch<{ items?: RaindropCollection[] }>('/collections/childrens', token)
    ])
    return [...(root.items ?? []), ...(children.items ?? [])]
  }

  async function createCollection(token: string) {
    const data = await raindropFetch<{ item: RaindropCollection }>('/collection', token, {
      method: 'POST',
      body: JSON.stringify({ title: DEFAULT_COLLECTION })
    })
    return data.item
  }

  function renderCollections(collections: RaindropCollection[], selectedId: number) {
    els.collection.replaceChildren(
      ...collections.map(c => {
        const option = document.createElement('option')
        option.value = String(c._id)
        option.textContent = c.title
        option.selected = c._id === selectedId
        return option
      })
    )
    els.collection.disabled = false
  }

  async function renderErrors() {
    const { errors = [] } = (await api.storage.local.get('errors')) as { errors?: ErrorEntry[] }
    const items = errors.length ? errors.map(e => `${new Date(e.time).toLocaleString()} — ${e.message}`) : ['None']
    els.errors.replaceChildren(...items.map(text => Object.assign(document.createElement('li'), { textContent: text })))
  }

  function parseTags() {
    return els.tags.value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
  }

  function setStatus(message: string, kind: '' | 'ok' | 'error' = '') {
    els.status.textContent = message
    els.status.className = kind
  }

  async function getSettings(): Promise<Settings> {
    const { settings = {} } = (await api.storage.local.get('settings')) as { settings?: Settings }
    return settings
  }

  async function patchSettings(patch: Partial<Settings>) {
    const settings = await getSettings()
    await api.storage.local.set({ settings: { ...settings, ...patch } })
  }

  async function raindropFetch<T = unknown>(path: string, token: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json() as Promise<T>
  }

  void init()
})()
