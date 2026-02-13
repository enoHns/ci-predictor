export interface ChangedFile {
  filename:  string
  status:    string
  additions: number
  deletions: number
}

export interface JobPrediction {
  jobName:            string
  failureProbability: number
  basedOnRuns:        number
  affectedBy:         string[]
  confidence:         'low' | 'medium' | 'high'
}

export interface PredictionReport {
  risk:           'low' | 'medium' | 'high' | 'critical'
  riskScore:      number
  predictions:    JobPrediction[]
  changedDomains: string[]
  recommendation: string
}
