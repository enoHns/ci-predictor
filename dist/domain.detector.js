"use strict";
// Mapping file paths → logical code domains
// Used to boost risk score when high-risk domains are touched
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOMAIN_RISK_BOOST = exports.DOMAIN_PATTERNS = void 0;
exports.detectDomains = detectDomains;
exports.computeDomainBoost = computeDomainBoost;
exports.DOMAIN_PATTERNS = {
    auth: [/auth/, /login/, /session/, /jwt/, /oauth/, /passport/],
    payments: [/payment/, /billing/, /stripe/, /webhook/, /invoice/],
    database: [/migration/, /prisma/, /schema\.sql/, /models?\//],
    api: [/controller/, /route/, /endpoint/, /handler/],
    ui: [/component/, /page/, /\.tsx$/, /\.vue$/, /\.svelte$/],
    config: [/\.env/, /config\//, /settings/, /docker/, /nginx/],
    ci: [/\.github\//, /workflow/, /Dockerfile/, /docker-compose/],
    deps: [/package\.json$/, /pnpm-lock/, /yarn\.lock/, /requirements\.txt/],
    tests: [/\.test\./, /\.spec\./, /__tests__/, /e2e\//],
    security: [/crypto/, /encrypt/, /hash/, /secret/, /token/, /key/],
};
exports.DOMAIN_RISK_BOOST = {
    database: 0.25,
    security: 0.20,
    payments: 0.20,
    deps: 0.15,
    ci: 0.30,
    auth: 0.15,
};
function detectDomains(files) {
    const found = new Set();
    for (const file of files) {
        for (const [domain, patterns] of Object.entries(exports.DOMAIN_PATTERNS)) {
            if (patterns.some(p => p.test(file)))
                found.add(domain);
        }
    }
    return Array.from(found);
}
function computeDomainBoost(domains) {
    let boost = 0;
    for (const domain of domains) {
        if (exports.DOMAIN_RISK_BOOST[domain])
            boost = Math.max(boost, exports.DOMAIN_RISK_BOOST[domain]);
    }
    return boost;
}
