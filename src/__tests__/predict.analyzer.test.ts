import { predictFailure } from '../predict.analyzer'
import { ChangedFile } from '../types'

const makeJobs = (names: string[]) => names.map(name => ({ name }))
const makeFile = (filename: string): ChangedFile => ({ filename, status: 'modified', additions: 5, deletions: 2 })

describe('predictFailure', () => {
  it('returns low risk for unclassified files with no matching jobs', async () => {
    const report = await predictFailure(
      [makeFile('docs/README.md')],
      [],
      makeJobs(['some-random-job']),
    )
    expect(report.risk).toBe('low')
    expect(report.riskScore).toBe(0)
  })

  it('detects high risk for CI + deploy job with Dockerfile change', async () => {
    const report = await predictFailure(
      [makeFile('Dockerfile')],
      Array(15).fill({ jobs: [{ name: 'deploy', conclusion: 'failure' }] }),
      makeJobs(['deploy', 'docker-build']),
    )
    expect(report.riskScore).toBeGreaterThan(50)
    expect(['high', 'critical']).toContain(report.risk)
  })

  it('flags auth job when auth files change', async () => {
    const report = await predictFailure(
      [makeFile('src/auth/login.service.ts')],
      Array(10).fill({ jobs: [] }),
      makeJobs(['auth-tests', 'unit-tests']),
    )
    const authPrediction = report.predictions.find(p => p.jobName === 'auth-tests')
    expect(authPrediction).toBeDefined()
    expect(authPrediction!.failureProbability).toBeGreaterThan(0.15)
  })

  it('marks changedDomains correctly', async () => {
    const report = await predictFailure(
      [makeFile('src/payments/stripe.ts'), makeFile('.github/workflows/ci.yml')],
      [],
      makeJobs(['build']),
    )
    expect(report.changedDomains).toContain('payments')
    expect(report.changedDomains).toContain('ci')
  })
})
