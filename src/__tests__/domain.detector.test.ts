import { detectDomains, computeDomainBoost } from '../domain.detector'

describe('detectDomains', () => {
  it('detects auth domain', () => {
    expect(detectDomains(['src/auth/login.ts', 'src/utils/helper.ts'])).toContain('auth')
  })

  it('detects payments domain', () => {
    expect(detectDomains(['src/billing/stripe.ts'])).toContain('payments')
  })

  it('detects CI domain from workflow files', () => {
    expect(detectDomains(['.github/workflows/ci.yml'])).toContain('ci')
  })

  it('detects multiple domains', () => {
    const domains = detectDomains(['src/auth/session.ts', 'src/payments/invoice.ts'])
    expect(domains).toContain('auth')
    expect(domains).toContain('payments')
  })

  it('returns empty for unclassified files', () => {
    expect(detectDomains(['src/utils/string-utils.ts'])).toHaveLength(0)
  })
})

describe('computeDomainBoost', () => {
  it('returns 0 for non-risky domains', () => {
    expect(computeDomainBoost(['ui', 'tests'])).toBe(0)
  })

  it('returns highest boost among domains', () => {
    // ci=0.30, auth=0.15 → should return 0.30
    expect(computeDomainBoost(['ci', 'auth'])).toBe(0.30)
  })

  it('returns correct boost for database', () => {
    expect(computeDomainBoost(['database'])).toBe(0.25)
  })
})
