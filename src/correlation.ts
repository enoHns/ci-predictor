import * as path from 'path'

// Job name → Map<file_pattern, failure_probability>
// Built from heuristics + observed failure history
export function buildCorrelationMatrix(
  historicalRuns: any[],
  currentJobs: any[],
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>()

  for (const job of currentJobs) {
    const name = job.name.toLowerCase()
    const correlations = new Map<string, number>()

    // Heuristics: job name → likely failing file patterns
    if (name.includes('auth')  || name.includes('login'))    correlations.set('auth',       0.75)
    if (name.includes('payment') || name.includes('billing')) correlations.set('payment',    0.80)
    if (name.includes('e2e')   || name.includes('integration')) correlations.set('api',      0.60)
    if (name.includes('unit')  || name.includes('test'))     correlations.set('src',        0.45)
    if (name.includes('build') || name.includes('compile'))  correlations.set('src',        0.50)
    if (name.includes('lint')  || name.includes('type'))     correlations.set('src',        0.30)
    if (name.includes('docker')|| name.includes('deploy'))   correlations.set('Dockerfile', 0.90)
    if (name.includes('migration') || name.includes('db'))   correlations.set('migration',  0.85)

    // Reinforce from historical failures
    const jobHistory = historicalRuns.filter(r =>
      r.jobs?.some((j: any) => j.name === job.name && j.conclusion === 'failure')
    )
    if (jobHistory.length >= 3) {
      const failRate = jobHistory.length / Math.max(historicalRuns.length, 1)
      if (failRate > 0.3) {
        // High historical failure rate — boost all correlations
        for (const [k, v] of correlations.entries()) {
          correlations.set(k, Math.min(0.95, v + failRate * 0.2))
        }
      }
    }

    matrix.set(job.name, correlations)
  }

  return matrix
}

export function getConfidence(basedOnRuns: number, matchedFiles: number): 'low' | 'medium' | 'high' {
  if (basedOnRuns >= 20 && matchedFiles >= 2) return 'high'
  if (basedOnRuns >= 10 || matchedFiles >= 1) return 'medium'
  return 'low'
}
