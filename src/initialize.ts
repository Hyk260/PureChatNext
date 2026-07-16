/**
 * Client bootstrap — import first from SPA entry (see LobeHub `src/initialize.ts`).
 * Dev-only react-scan toolbar; production Monitor uses `Analytics/ReactScan` + API key.
 */
if (__DEV__) {
  void import('react-scan').then(({ scan }) => {
    scan({ enabled: false, showToolbar: true })
  })
}
