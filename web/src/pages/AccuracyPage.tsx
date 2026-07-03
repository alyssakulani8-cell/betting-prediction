import { useState, useEffect } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api/ml' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

interface AccuracyData {
  total_predictions: number
  resolved: number
  correct: number
  accuracy: number
  accuracy_by_confidence: Record<string, { total: number; correct: number; accuracy: number }>
}

export default function AccuracyPage() {
  const [data, setData] = useState<AccuracyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sport, setSport] = useState<'football' | 'basketball'>('football')
  const [days, setDays] = useState(30)

  const fetchAccuracy = async () => {
    setLoading(true)
    try {
      const { data: result } = await api.get('/learning/accuracy', {
        params: { sport, days },
      })
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAccuracy() }, [sport, days])

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Model Accuracy</h1>
          <p className="text-xs text-gray-500">Track prediction performance over time</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          className="input max-w-[180px]"
          value={sport}
          onChange={(e) => setSport(e.target.value as any)}
        >
          <option value="football">Football</option>
          <option value="basketball">Basketball</option>
        </select>
        <select
          className="input max-w-[180px]"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
        <button className="btn-secondary text-xs" onClick={fetchAccuracy}>Refresh</button>
      </div>

      {loading ? (
        <div className="card animate-pulse border-gray-800">
          <div className="h-8 bg-gray-800 rounded w-1/3 mb-4" />
          <div className="h-16 bg-gray-800/60 rounded" />
        </div>
      ) : data && data.resolved > 0 ? (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="card border-gray-800 text-center">
              <div className="text-2xl font-bold text-emerald-400">{(data.accuracy * 100).toFixed(1)}%</div>
              <div className="text-xs text-gray-500 mt-1">Accuracy</div>
            </div>
            <div className="card border-gray-800 text-center">
              <div className="text-2xl font-bold text-gray-200">{data.correct}</div>
              <div className="text-xs text-gray-500 mt-1">Correct</div>
            </div>
            <div className="card border-gray-800 text-center">
              <div className="text-2xl font-bold text-gray-200">{data.resolved}</div>
              <div className="text-xs text-gray-500 mt-1">Resolved</div>
            </div>
            <div className="card border-gray-800 text-center">
              <div className="text-2xl font-bold text-gray-200">{data.total_predictions}</div>
              <div className="text-xs text-gray-500 mt-1">Total</div>
            </div>
          </div>

          <div className="card border-gray-800">
            <h3 className="text-sm font-semibold mb-3">Accuracy by Confidence Level</h3>
            <div className="space-y-2">
              {Object.entries(data.accuracy_by_confidence).reverse().map(([bucket, stats]) => (
                <div key={bucket} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-12">{(+bucket * 100).toFixed(0)}%</span>
                  <div className="flex-1 h-3 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        stats.accuracy > 0.6 ? 'bg-emerald-500' : stats.accuracy > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${stats.accuracy * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-20 text-right">
                    {stats.correct}/{stats.total}
                  </span>
                  <span className={`text-xs font-semibold w-14 text-right ${
                    stats.accuracy > 0.6 ? 'text-emerald-400' : stats.accuracy > 0.4 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {(stats.accuracy * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card border-gray-800 text-center py-10">
          <p className="text-gray-500 text-sm mb-1">No resolved predictions yet</p>
          <p className="text-gray-600 text-xs">Predictions will be tracked automatically once matches are resolved</p>
        </div>
      )}
    </div>
  )
}
