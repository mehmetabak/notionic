/**
 * Retries an async function up to `maxRetries` times when it encounters a
 * Notion API 429 (Too Many Requests) response. Other errors are re-thrown
 * immediately without retrying.
 *
 * @param {() => Promise<any>} fn - The async function to call.
 * @param {number} [maxRetries=8] - Maximum number of retry attempts.
 * @param {number} [baseDelayMs=1500] - Starting delay in milliseconds (doubles each attempt).
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(fn, maxRetries = 8, baseDelayMs = 1500) {
  let attempt = 0

  while (true) {
    try {
      return await fn()
    } catch (error) {
      const statusCode =
        error?.status ||
        error?.statusCode ||
        error?.response?.status ||
        error?.response?.statusCode

      if (statusCode === 429 && attempt < maxRetries) {
        attempt++
        // Exponential backoff + small random jitter to avoid thundering herd
        const jitter = Math.floor(Math.random() * 500)
        const delayMs = Math.min(
          baseDelayMs * Math.pow(2, attempt - 1) + jitter,
          60000
        )
        const delaySeconds = (delayMs / 1000).toFixed(1)
        console.log(
          `[notion] 429 Rate Limit, retrying in ${delaySeconds}s... (attempt ${attempt}/${maxRetries})`
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      } else if (statusCode === 429) {
        const exhaustedError = new Error(
          `[notion] 429 Too Many Requests — all ${maxRetries} retries exhausted`
        )
        exhaustedError.cause = error
        throw exhaustedError
      } else {
        throw error
      }
    }
  }
}
