export const shouldEnforceSingleInstanceLock = (platform: NodeJS.Platform, multiInstance: boolean) =>
  platform === 'win32' || !multiInstance
