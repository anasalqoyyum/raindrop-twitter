;(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome

  function report(tweetId: string, url: string) {
    const message: BookmarkMessage = { type: 'bookmark', tweetId, url }
    void Promise.resolve(api.runtime.sendMessage(message)).catch(() => {})
  }

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
