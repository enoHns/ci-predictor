"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderReport = renderReport;
const COMMENT_TAG = '<!-- ci-predictor -->';
const RISK_EMOJI = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
};
async function renderReport(octokit, ctx, report) {
    if (!ctx.payload.pull_request)
        return;
    const body = buildComment(report);
    const { owner, repo } = ctx.repo;
    const prNumber = ctx.payload.pull_request.number;
    const { data: comments } = await octokit.issues.listComments({ owner, repo, issue_number: prNumber });
    const existing = comments.find(c => c.body?.includes(COMMENT_TAG));
    if (existing) {
        await octokit.issues.updateComment({ owner, repo, comment_id: existing.id, body });
    }
    else {
        await octokit.issues.createComment({ owner, repo, issue_number: prNumber, body });
    }
}
function buildComment(report) {
    const lines = [COMMENT_TAG, '## ⚡ ci-predictor — failure prediction\n'];
    lines.push(`${RISK_EMOJI[report.risk]} **Risk level: ${report.risk.toUpperCase()}** (score: ${report.riskScore}/100)  `);
    if (report.changedDomains.length > 0) {
        lines.push(`Domains touched: ${report.changedDomains.map(d => `\`${d}\``).join(', ')}  `);
    }
    lines.push(`\n> ${report.recommendation}\n`);
    if (report.predictions.length === 0) {
        lines.push('No jobs flagged as high-risk.');
        return lines.join('\n');
    }
    lines.push('| Job | Failure probability | Confidence | Affected by |');
    lines.push('|-----|---------------------|------------|-------------|');
    for (const p of report.predictions) {
        const prob = `${(p.failureProbability * 100).toFixed(0)}%`;
        const files = p.affectedBy.length > 0 ? p.affectedBy.map(f => `\`${f}\``).join(', ') : '—';
        lines.push(`| \`${p.jobName}\` | ${prob} | ${p.confidence} | ${files} |`);
    }
    return lines.join('\n');
}
