"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const rest_1 = require("@octokit/rest");
const predict_analyzer_1 = require("./predict.analyzer");
const reporter_1 = require("./reporter");
async function run() {
    try {
        const token = core.getInput('github-token', { required: true });
        const lookback = parseInt(core.getInput('lookback-runs') || '50');
        const postComment = core.getBooleanInput('post-comment');
        const failOnHighRisk = core.getBooleanInput('fail-on-high-risk');
        const octokit = new rest_1.Octokit({ auth: token });
        const ctx = github.context;
        const { owner, repo } = ctx.repo;
        if (!ctx.payload.pull_request) {
            core.info('ci-predictor: not a PR event, skipping');
            return;
        }
        const prNumber = ctx.payload.pull_request.number;
        // Fetch changed files in this PR
        const { data: changedFiles } = await octokit.pulls.listFiles({
            owner, repo, pull_number: prNumber, per_page: 100,
        });
        // Fetch historical runs for correlation
        const { data: runsData } = await octokit.actions.listWorkflowRunsForRepo({
            owner, repo,
            per_page: Math.min(lookback, 100),
            status: 'completed',
        });
        // Fetch current run jobs as prediction targets
        const currentRunId = parseInt(process.env.GITHUB_RUN_ID ?? '0');
        const { data: currentJobs } = await octokit.actions.listJobsForWorkflowRun({
            owner, repo, run_id: currentRunId,
        });
        const report = await (0, predict_analyzer_1.predictFailure)(changedFiles.map(f => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
        })), runsData.workflow_runs, currentJobs.jobs);
        core.setOutput('risk-level', report.risk);
        core.setOutput('risk-score', report.riskScore);
        if (postComment) {
            await (0, reporter_1.renderReport)(octokit, ctx, report);
        }
        if (failOnHighRisk && (report.risk === 'high' || report.risk === 'critical')) {
            core.setFailed(`Predicted risk: ${report.risk} (${report.riskScore}/100) — review required before merge`);
            return;
        }
        core.info(`Done — risk: ${report.risk} (${report.riskScore}/100)`);
    }
    catch (err) {
        core.setFailed(`ci-predictor failed: ${err.message}`);
    }
}
run();
