export async function sendWithValidWechatEventLease(params: {
  eventId: string
  hasValidLease: (eventId: string, owner: string) => Promise<boolean>
  owner: string
  send: () => Promise<unknown>
}) {
  if (!(await params.hasValidLease(params.eventId, params.owner))) throw new Error('Event lease lost')
  await params.send()
}
