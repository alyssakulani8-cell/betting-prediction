import { useState, useEffect } from 'react'
import { analyticsService, type CoachingInsight } from '@/services/analytics'

const SEVERITY_STYLES: Record<string, { border: string; icon: string; label: string }> = {
  danger: { border: 'border-red-700/30', icon: '🔴', label: 'bg-red-900/20 text-red-300' },
  warning: { border: 'border-yellow-700/30', icon: '🟡', label: 'bg-yellow-900/20 text-yellow-300' },
  info: { border: 'border-blue-700/30', icon: '🔵', label: 'bg-blue-900/20 text-blue-300' },
  positive: { border: 'border-emerald-700/30', icon: '🟢', label: 'bg-emerald-900/20 text-emerald-300' },
}

function InsightCard({ insight }: { insight: CoachingInsight }) {
  const s = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info
  return (
    <div className={`card border ${s.border}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-gray-200">{insight.title}</h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.label}`}>
              {insight.severity.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-gray-400">{insight.message}</p>
        </div>
      </div>
    </div>
  )
}

export default function CoachingPage() {
  const [insights, setInsights] = useState<CoachingInsight[]>([])
  const [tip, setTip] = useState<{ text: string; category: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [insightsData, tipData] = await Promise.all([
        analyticsService.getCoachingInsights(),
        analyticsService.getCoachingTip(),
      ])
      setInsights(insightsData)
      setTip(tipData)
      setError('')
    } catch {
      setError('Failed to load coaching data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Betting Coach</h1>
        <p className="text-xs text-gray-500">Personalized insights to improve your betting discipline</p>
      </div>

      {tip && (
        <div className="card bg-gray-850 border border-primary-700/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Tip of the moment</span>
            <span className="text-[10px] text-primary-400 bg-primary-900/30 px-1.5 py-0.5 rounded">{tip.category}</span>
          </div>
          <p className="text-sm text-gray-200 italic">"{tip.text}"</p>
          <button
            onClick={() => analyticsService.getCoachingTip().then(setTip)}
            className="text-[10px] text-primary-400 hover:underline mt-2"
          >
            New tip &rarr;
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2 text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchData} className="text-gray-500 hover:text-gray-300">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse border-gray-800">
              <div className="h-5 bg-gray-800 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-800/60 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="card border-gray-800 text-center py-10">
          <p className="text-gray-500 text-sm mb-1">No insights yet</p>
          <p className="text-gray-600 text-xs">Place more predictions to receive personalized coaching insights</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <InsightCard key={`${insight.type}-${i}`} insight={insight} />
          ))}
        </div>
      )}
    </div>
  )
}
