import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
  preset: 'cloudflare-module',
  cloudflare: {
    pages: {
      routes: {
        exclude: ['/assets/*', '/_build/*'],
      },
    }
  },
})
