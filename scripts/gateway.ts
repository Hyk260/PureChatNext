import { streamText } from 'ai'

import './lib/load-env'

async function main() {
  const result = streamText({
    model: 'stepfun/step-3.7-flash',
    prompt: '创造一个新的节日，并描述它的传统。',
  })

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart)
  }

  console.log('Token usage:', await result.usage)
  console.log('Finish reason:', await result.finishReason)
}

main().catch(console.error)
