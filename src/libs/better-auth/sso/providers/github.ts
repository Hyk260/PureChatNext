import { checkProviderEnvs } from '../helpers'
import { type BuiltinProviderDefinition } from '../types'

const provider: BuiltinProviderDefinition<
  {
    AUTH_GITHUB_ID: string
    AUTH_GITHUB_SECRET: string
  },
  'github'
> = {
  build: (env) => {
    return {
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    }
  },
  checkEnvs: () => checkProviderEnvs(['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET']),
  id: 'github',
  type: 'builtin',
}

export default provider
