import { useState, useEffect } from 'react'
import { predictionsService } from '@/services/predictions'
import PerformanceChart from '@/components/PerformanceChart'

interface Prediction {
  id: string
  homeTeam: string
  awayTeam: string
  predictedScore: string
  confidence: number
  league: string
  kickoff: string
}

export default function DashboardPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    predictionsService.getPredictions()
      .then((data) => setPredictions(data.predictions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalBets = predictions.length
  const highConf = predictions.filter((p) => p.confidence >= 0.7).length
  const leagues = [...new Set(predictions.map((p) => p.league))]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-800 rounded w-full" />
              <div className="h-4 bg-gray-800 rounded w-3/4" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Predictions</span>
                <span className="font-semibold">{totalBets}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">High Confidence (&ge;70%)</span>
                <span className="font-semibold">{highConf}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Leagues Covered</span>
                <span className="font-semibold">{leagues.length}</span>
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Recent Predictions</h3>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-gray-800 rounded w-full" />
              ))}
            </div>
          ) : predictions.length === 0 ? (
            <p className="text-gray-400 text-sm">No predictions yet</p>
          ) : (
            <div className="space-y-2">
              {predictions.slice(0, 5).map((p) => (
                <div key={p.id} className="flex justify-between text-sm py-1 border-b border-gray-800 last:border-0">
                  <span className="text-gray-300">{p.homeTeam} vs {p.awayTeam}</span>
                  <span className="text-gray-500">{p.league}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Weekly Performance</h3>
        <PerformanceChart />
      </div>
    </div>
  )
}
