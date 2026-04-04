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
exports.predictFailure = predictFailure;
const core = __importStar(require("@actions/core"));
const path = __importStar(require("path"));
const domain_detector_1 = require("./domain.detector");
const correlation_1 = require("./correlation");
async function predictFailure(changedFiles, historicalRuns, currentJobs) {
    core.info(`Predicting failures for ${changedFiles.length} changed file(s)...`);
    const changedPaths = changedFiles.map(f => f.filename);
    const changedDomains = (0, domain_detector_1.detectDomains)(changedPaths);
    core.info(`  Detected domains: ${changedDomains.join(', ') || 'general'}`);
    const correlationMatrix = (0, correlation_1.buildCorrelationMatrix)(historicalRuns, currentJobs);
    const predictions = [];
    for (const job of currentJobs) {
        const jobCorrelations = correlationMatrix.get(job.name) ?? new Map();
        const relevantFiles = [];
        let weightedProb = 0;
        let totalWeight = 0;
        for (const changedFile of changedPaths) {
            const dir = path.dirname(changedFile);
            for (const [pattern, probability] of jobCorrelations.entries()) {
                if (changedFile.includes(pattern) || dir.includes(pattern)) {
                    relevantFiles.push(changedFile);
                    weightedProb += probability;
                    totalWeight++;
                }
            }
        }
        const domainBoost = (0, domain_detector_1.computeDomainBoost)(changedDomains);
        const baseProbability = totalWeight > 0 ? weightedProb / totalWeight : 0;
        const finalProbability = Math.min(1, baseProbability + domainBoost);
        if (finalProbability > 0.15) {
            predictions.push({
                jobName: job.name,
                failureProbability: Math.round(finalProbability * 1000) / 1000,
                basedOnRuns: historicalRuns.length,
                affectedBy: [...new Set(relevantFiles)].slice(0, 5),
                confidence: (0, correlation_1.getConfidence)(historicalRuns.length, relevantFiles.length),
            });
        }
    }
    predictions.sort((a, b) => b.failureProbability - a.failureProbability);
    const riskScore = predictions.length > 0
        ? Math.round(Math.max(...predictions.map(p => p.failureProbability)) * 100)
        : 0;
    const risk = riskScore >= 75 ? 'critical'
        : riskScore >= 50 ? 'high'
            : riskScore >= 25 ? 'medium'
                : 'low';
    core.info(`  Risk: ${risk} (score: ${riskScore}) — ${predictions.length} job(s) flagged`);
    return {
        risk, riskScore, predictions, changedDomains,
        recommendation: getRecommendation(risk, changedDomains),
    };
}
function getRecommendation(risk, domains) {
    if (risk === 'critical')
        return `High-risk domains touched (${domains.join(', ')}). Run the full test suite locally before pushing, and consider adding a required reviewer.`;
    if (risk === 'high')
        return `Several sensitive areas modified. Review the flagged jobs carefully before merging.`;
    if (risk === 'medium')
        return `Some risk detected. Check the flagged jobs and ensure relevant tests pass.`;
    return 'Low predicted risk. Standard review process applies.';
}
