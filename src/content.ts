;(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome

  function report(tweetId: string, url: string) {
    const message: BookmarkMessage = { type: 'bookmark', tweetId, url }
    void Promise.resolve(api.runtime.sendMessage(message)).catch(() => {})
  }

  function showToast(ok: boolean, text: string) {
    const toast = document.createElement('div')
    toast.textContent = text
    toast.style.cssText =
      'position:fixed;bottom:48px;left:50%;transform:translateX(-50%) translateY(8px);' +
      `background:${ok ? '#1d9bf0' : '#c62828'};color:#fff;padding:8px 16px;border-radius:9999px;` +
      'font:600 13px system-ui,sans-serif;z-index:2147483647;opacity:0;' +
      'transition:opacity .2s,transform .2s;pointer-events:none;max-width:80vw'
    document.body.append(toast)
    requestAnimationFrame(() => {
      toast.style.opacity = '1'
      toast.style.transform = 'translateX(-50%)'
    })
    setTimeout(() => {
      toast.style.opacity = '0'
      setTimeout(() => toast.remove(), 300)
    }, 2500)
  }

  api.runtime.onMessage.addListener((message: unknown) => {
    const m = message as SyncResultMessage | null
    if (m?.type === 'sync-result') showToast(m.ok, m.message)
  })

  window.addEventListener('message', event => {
    const data = event.data as { source?: unknown; tweetId?: unknown } | null
    if (event.source !== window || data?.source !== 'raindrop-twitter-sync') return
    if (typeof data.tweetId === 'string' && /^\d+$/.test(data.tweetId)) {
      report(data.tweetId, `https://x.com/i/status/${data.tweetId}`)
    }
  })

  document.addEventListener(
    'click',
    event => {
      if (!(event.target instanceof Element)) return
      const button = event.target.closest('button[data-testid="bookmark"]')
      if (!button) return

      const article = button.closest('article[data-testid="tweet"]')
      const permalink = article && [...article.querySelectorAll('a[href*="/status/"]')].find(a => a.querySelector('time'))
      const path = permalink?.getAttribute('href') ?? location.pathname
      const match = path.match(/^\/[^/]+\/status\/(\d+)/)
      const tweetId = match?.[1]
      if (!match || !tweetId) return

      report(tweetId, `https://x.com${match[0]}`)
    },
    true
  )
})()
