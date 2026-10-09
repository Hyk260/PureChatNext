import path from 'node:path'

import { protocol, session } from 'electron'

import { createAppProtocolHandler } from '../appProtocol'

const protocolScheme = 'purechat'

export class ProtocolManager {
  private remoteServerUrlGetter: () => Promise<string | null>
  private authorizationHeaderGetter: () => Promise<string | null> = async () => null

  constructor(
    private readonly rendererDir: string,
    private readonly getRemoteServerUrl: () => Promise<string | null>
  ) {
    this.remoteServerUrlGetter = getRemoteServerUrl
  }

  setRemoteServerUrlGetter(getter: () => Promise<string | null>) {
    this.remoteServerUrlGetter = getter
  }

  setAuthorizationHeaderGetter(getter: () => Promise<string | null>) {
    this.authorizationHeaderGetter = getter
  }

  static registerScheme() {
    protocol.registerSchemesAsPrivileged([
      {
        scheme: protocolScheme,
        privileges: { corsEnabled: true, secure: true, standard: true, stream: true, supportFetchAPI: true },
      },
    ])
  }

  initialize() {
    protocol.handle(
      protocolScheme,
      createAppProtocolHandler({
        fetch: (input, init) => session.defaultSession.fetch(input, init),
        getAuthorizationHeader: () => this.authorizationHeaderGetter(),
        getRemoteServerUrl: () => this.remoteServerUrlGetter(),
        rendererDir: path.resolve(this.rendererDir),
      })
    )
  }
}
