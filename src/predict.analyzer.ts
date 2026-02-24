import * as core from '@actions/core'
import * as path from 'path'
import { ChangedFile, JobPrediction, PredictionReport } from './types'
import { detectDomains, computeDomainBoost } from './domain.detector'
import { buildCorrelationMatrix, getConfidence } from './correlation'

export async function predictFailure(
  changedFiles: ChangedFile[],
  historicalRuns: any[],
  currentJobs: any[],
): Promise<PredictionReport> {
  core.info(`Predicting failures for ${changedFiles.length} changed file(s)...`)

  const changedPaths  = changedFiles.map(f => f.filename)
  const changedDomains = detectDomains(changedPaths)

  core.info(`  Detected domains: ${changedDomains.join(', ') || 'general'}`)

  const correlationMatrix = buildCorrelationMatrix(historicalRuns, currentJobs)
  const predictions: JobPrediction[] = []

  for (const job of currentJobs) {
    const jobCorrelations = correlationMatrix.get(job.name) ?? new Map()

    const relevantFiles: string[] = []
    let weightedProb = 0
    let totalWeight  = 0

    for (const changedFile of changedPaths) {
      const dir = path.dirname(changedFile)
      for (const [pattern, probability] of jobCorrelations.entries()) {
        if (changedFile.includes(pattern) || dir.includes(pattern)) {
          relevantFiles.push(changedFile)
          weightedProb += probability
          totalWeight++
        }
      }
    }

    const domainBoost    = computeDomainBoost(changedDomains)
    const baseProbability = totalWeight > 0 ? weightedProb / totalWeight : 0
    const finalProbability = Math.min(1, baseProbability + domainBoost)

    if (finalProbability > 0.15) {
      predictions.push({
        jobName:            job.name,
        failureProbability: Math.round(finalProbability * 1000) / 1000,
        basedOnRuns:        historicalRuns.length,
        affectedBy:         [...new Set(relevantFiles)].slice(0, 5),
        confidence:         getConfidence(historicalRuns.length, relevantFiles.length),
      })
    }
  }

  predictions.sort((a, b) => b.failureProbability - a.failureProbability)

  const riskScore = predictions.length > 0
    ? Math.round(Math.max(...predictions.map(p => p.failureProbability)) * 100)
    : 0

  const risk = riskScore >= 75 ? 'critical'
    : riskScore >= 50 ? 'high'
    : riskScore >= 25 ? 'medium'
    : 'low'

  core.info(`  Risk: ${risk} (score: ${riskScore}) — ${predictions.length} job(s) flagged`)

  return {
    risk, riskScore, predictions, changedDomains,
    recommendation: getRecommendation(risk, changedDomains),
  }
}

function getRecommendation(risk: PredictionReport['risk'], domains: string[]): string {
  if (risk === 'critical') return `High-risk domains touched (${domains.join(', ')}). Run the full test suite locally before pushing, and consider adding a required reviewer.`
  if (risk === 'high')     return `Several sensitive areas modified. Review the flagged jobs carefully before merging.`
  if (risk === 'medium')   return `Some risk detected. Check the flagged jobs and ensure relevant tests pass.`
  return 'Low predicted risk. Standard review process applies.'
}
