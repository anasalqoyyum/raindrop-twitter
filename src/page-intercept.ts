;(() => {
  const CREATE_BOOKMARK = /\/i\/api\/graphql\/[^/]+\/CreateBookmark/
  const originalFetch = window.fetch

  window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    let body: string | Request | null = null
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (CREATE_BOOKMARK.test(url)) {
      body = typeof init?.body === 'string' ? init.body : input instanceof Request ? input.clone() : null
    }

    const result = originalFetch.call(this, input, init)

    if (body !== null) {
      const captured = body
      result
        .then(async response => {
          if (!response.ok) return
          const text = typeof captured === 'string' ? captured : await captured.text()
          const tweetId: unknown = JSON.parse(text)?.variables?.tweet_id
          if (typeof tweetId === 'string' && tweetId) {
            window.postMessage({ source: 'raindrop-twitter-sync', tweetId }, window.origin)
          }
        })
        .catch(() => {})
    }

    return result
  }
})()
