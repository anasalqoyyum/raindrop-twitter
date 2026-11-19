;(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome
  const BOOKMARK_BUTTON =
    'button[data-testid="bookmark"], button[data-engagement-action="bookmark"], [data-engagement-action="bookmark"] button'

  function report(tweetId: string, url: string) {
    const message: BookmarkMessage = { type: 'bookmark', tweetId, url }
    void Promise.resolve(api.runtime.sendMessage(message)).catch(() => {})
  }

  function showToast(ok: boolean, text: string) {
    const toast = document.createElement('div')
    toast.textContent = text
    toast.style.cssText =
      'position:fixed;bottom:84px;left:50%;transform:translateX(-50%) translateY(8px);' +
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

  function resolveTweetPath(button: Element): string {
    const cardHref = button.closest('[data-href*="/status/"]')?.getAttribute('data-href')
    if (cardHref) return cardHref

    const article = button.closest('article')
    if (article) {
      const ownLinks = [...article.querySelectorAll('a[href*="/status/"]')].filter(
        a => a.closest('article') === article && !a.closest('[data-slot="embedded-tweet-frame"]')
      )
      const permalink =
        ownLinks.find(a => a.querySelector('time')) ??
        ownLinks.find(a => /^\/[^/]+\/status\/\d+$/.test(a.getAttribute('href') ?? '')) ??
        ownLinks[0]
      const href = permalink?.getAttribute('href')
      if (href) return href
    }

    return location.pathname
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
      const button = event.target.closest(BOOKMARK_BUTTON)
      if (!button || button.getAttribute('aria-pressed') === 'true') return

      const match = resolveTweetPath(button).match(/^\/[^/]+\/status\/(\d+)/)
      const tweetId = match?.[1]
      if (!match || !tweetId) return

      report(tweetId, `https://x.com${match[0]}`)
    },
    true
  )
})()
