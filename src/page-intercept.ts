;(() => {
  const CREATE_BOOKMARK = /\/(?:i\/api\/)?graphql\/[^/]+\/(?:BookmarkAdd|CreateBookmark)(?:[/?#]|$)/
  const originalFetch = window.fetch

  function extractTweetId(text: string): string | null {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || !('variables' in parsed)) return null
    const { variables } = parsed
    if (typeof variables !== 'object' || variables === null) return null
    const id = 'tweetId' in variables ? variables.tweetId : 'tweet_id' in variables ? variables.tweet_id : undefined
    return typeof id === 'string' && /^\d+$/.test(id) ? id : null
  }

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
          const tweetId = extractTweetId(text)
          if (tweetId) {
            window.postMessage({ source: 'raindrop-twitter-sync', tweetId }, window.origin)
          }
        })
        .catch(() => {})
    }

    return result
  }
})()
