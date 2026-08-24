import { NotionAPI as BaseNotionAPI } from 'notion-client'

export class NotionAPI extends BaseNotionAPI {
  async fetch({ endpoint, body, gotOptions, headers }) {
    const customHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      ...headers
    }
    return super.fetch({
      endpoint,
      body,
      gotOptions,
      headers: customHeaders
    })
  }
}
