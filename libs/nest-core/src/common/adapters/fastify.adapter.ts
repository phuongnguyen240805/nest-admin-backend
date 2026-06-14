import FastifyCookie from '@fastify/cookie'
import FastifyMultipart from '@fastify/multipart'
import { FastifyAdapter } from '@nestjs/platform-fastify'

const app: FastifyAdapter = new FastifyAdapter({
  // @see https://www.fastify.io/docs/latest/Reference/Server/#trustproxy
  trustProxy: true,
  logger: false,
  // forceCloseConnections: true,
})
export { app as fastifyApp }

app.register(FastifyMultipart as any, {
  limits: {
    fields: 10, // Max number of non-file fields
    fileSize: 1024 * 1024 * 6, // limit size 6M
    files: 5, // Max number of file fields
  },
})

app.register(FastifyCookie as any, {
  secret: 'cookie-secret', // 这个 secret 不太重要，不存鉴权相关，无关紧要
})

// Raw body support for Stripe webhooks (must be Buffer for signature verification).
// The webhook controller (billing/stripe) expects request.rawBody to be present.
app.getInstance().addHook('preParsing', async (request, reply, payload) => {
  const url = request.url || ''
  if (url.includes('/webhooks/stripe')) {
    // Collect the raw body into a Buffer and expose as rawBody (similar to express verify fn).
    const chunks: Buffer[] = []
    for await (const chunk of payload) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
    const raw = Buffer.concat(chunks)
    ;(request as any).rawBody = raw
    // Return a fresh stream with the same data so the normal JSON parser can still run
    const { Readable } = require('stream')
    const stream = new Readable()
    stream.push(raw)
    stream.push(null)
    return stream
  }
})

app.getInstance().addHook('onRequest', async (request, reply): Promise<void> => {
  // set undefined origin
  const { origin } = request.headers
  if (!origin) {
    request.headers.origin = request.headers.host as string
  }

  // forbidden php
  const { url } = request
  if (url.endsWith('.php')) {
    reply.raw.statusMessage =
      'Eh. PHP is not support on this machine. Yep, I also think PHP is bestest programming language. But for me it is beyond my reach.'

    return reply.code(418).send()   // early return OK
  }

  // skip favicon request
  if (url.match(/favicon.ico$/) || url.match(/manifest.json$/)) {
    return reply.code(204).send()   // early return OK
  }

})

// app.getInstance().addHook('onRequest', (request, reply, done) => {
//   // set undefined origin
//   const { origin } = request.headers
//   if (!origin)
//     request.headers.origin = request.headers.host

//   // forbidden php

//   const { url } = request

//   if (url.endsWith('.php')) {
//     reply.raw.statusMessage
//       = 'Eh. PHP is not support on this machine. Yep, I also think PHP is bestest programming language. But for me it is beyond my reach.'

//     return reply.code(418).send()
//   }

//   // skip favicon request
//   if (url.match(/favicon.ico$/) || url.match(/manifest.json$/))
//     return reply.code(204).send()

//   done()
// })
