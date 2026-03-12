import * as core   from '@actions/core'
import * as github from '@actions/github'
import { Octokit } from '@octokit/rest'
import { predictFailure } from './predict.analyzer'
import { renderReport }   from './reporter'

async function run(): Promise<void> {
  try {
    const token         = core.getInput('github-token', { required: true })
    const lookback      = parseInt(core.getInput('lookback-runs') || '50')
    const postComment   = core.getBooleanInput('post-comment')
    const failOnHighRisk = core.getBooleanInput('fail-on-high-risk')

    const octokit = new Octokit({ auth: token })
    const ctx     = github.context
    const { owner, repo } = ctx.repo

    if (!ctx.payload.pull_request) {
      core.info('ci-predictor: not a PR event, skipping')
      return
    }

    const prNumber = ctx.payload.pull_request.number

    // Fetch changed files in this PR
    const { data: changedFiles } = await octokit.pulls.listFiles({
      owner, repo, pull_number: prNumber, per_page: 100,
    })

    // Fetch historical runs for correlation
    const { data: runsData } = await octokit.actions.listWorkflowRunsForRepo({
      owner, repo,
      per_page: Math.min(lookback, 100),
      status: 'completed',
    })

    // Fetch current run jobs as prediction targets
    const currentRunId = parseInt(process.env.GITHUB_RUN_ID ?? '0')
    const { data: currentJobs } = await octokit.actions.listJobsForWorkflowRun({
      owner, repo, run_id: currentRunId,
    })

    const report = await predictFailure(
      changedFiles.map(f => ({
        filename:  f.filename,
        status:    f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
      runsData.workflow_runs,
      currentJobs.jobs,
    )

    core.setOutput('risk-level', report.risk)
    core.setOutput('risk-score', report.riskScore)

    if (postComment) {
      await renderReport(octokit, ctx, report)
    }

    if (failOnHighRisk && (report.risk === 'high' || report.risk === 'critical')) {
      core.setFailed(`Predicted risk: ${report.risk} (${report.riskScore}/100) — review required before merge`)
      return
    }

    core.info(`Done — risk: ${report.risk} (${report.riskScore}/100)`)
  } catch (err) {
    core.setFailed(`ci-predictor failed: ${(err as Error).message}`)
  }
}

run()
