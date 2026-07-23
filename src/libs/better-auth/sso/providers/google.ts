import { checkProviderEnvs } from '../helpers'
import { type BuiltinProviderDefinition } from '../types'

const provider: BuiltinProviderDefinition<
  {
    AUTH_GOOGLE_ID: string
    AUTH_GOOGLE_SECRET: string
  },
  'google'
> = {
  build: (env) => {
    return {
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      prompt: 'select_account',
    }
  },
  checkEnvs: () => checkProviderEnvs(['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET']),
  id: 'google',
  type: 'builtin',
}

export default provider
