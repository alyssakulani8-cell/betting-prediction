import { useState, useEffect } from 'react'
import { analyticsService, type AnalyticsOverview, type DisciplineScore, type ClvSummary } from '@/services/analytics'

export default function AnalyticsDashboardPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [discipline, setDiscipline] = useState<DisciplineScore | null>(null)
  const [clvEv, setClvEv] = useState<ClvSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      analyticsService.getOverview(),
      analyticsService.getDiscipline(),
      analyticsService.getClvSummary(),
    ])
      .then(([ov, disc, clv]) => {
        setOverview(ov)
        setDiscipline(disc)
        setClvEv(clv)
      })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse border-gray-800">
            <div className="h-5 bg-gray-800 rounded w-1/3 mb-3" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((j) => <div key={j} className="h-12 bg-gray-800/60 rounded" />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border-red-800/50 text-center py-8">
        <p className="text-red-400 text-sm mb-3">{error}</p>
        <button className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg" onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  const ov = overview
  const disc = discipline
  const clv = clvEv

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Performance Analytics</h1>
        <p className="text-xs text-gray-500">Comprehensive betting performance tracking</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card border-gray-800 text-center">
          <div className={`text-2xl font-bold ${(ov?.financial.totalProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {ov ? `${ov.financial.totalProfit > 0 ? '+' : ''}${ov.financial.totalProfit.toFixed(1)}` : '-'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total P&L</div>
        </div>
        <div className="card border-gray-800 text-center">
          <div className={`text-2xl font-bold ${(ov?.financial.roi ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {ov ? `${ov.financial.roi > 0 ? '+' : ''}${ov.financial.roi.toFixed(1)}%` : '-'}
          </div>
          <div className="text-xs text-gray-500 mt-1">ROI</div>
        </div>
        <div className="card border-gray-800 text-center">
          <div className="text-2xl font-bold text-blue-400">{ov ? `${(ov.performance.winRate * 100).toFixed(1)}%` : '-'}</div>
          <div className="text-xs text-gray-500 mt-1">Win Rate</div>
        </div>
        <div className="card border-gray-800 text-center">
          <div className="text-2xl font-bold text-purple-400">{ov?.totals.total ?? '-'}</div>
          <div className="text-xs text-gray-500 mt-1">Total Bets</div>
        </div>
      </div>

      {disc && (
        <div className="card border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Discipline Score</h3>
            <span className={`text-lg font-bold ${
              disc.score >= 80 ? 'text-emerald-400' : disc.score >= 60 ? 'text-yellow-400' : disc.score >= 40 ? 'text-orange-400' : 'text-red-400'
            }`}>
              {disc.score}/100
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all ${
                disc.score >= 80 ? 'bg-emerald-500' : disc.score >= 60 ? 'bg-yellow-500' : disc.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${disc.score}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mb-3">{disc.grade}</p>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(disc.factors).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                  <div className={`h-full rounded-full ${val > 0.6 ? 'bg-emerald-500' : val > 0.3 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${val * 100}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">{(val * 100).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {clv && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card border-gray-800">
            <h3 className="text-sm font-semibold mb-3">Closing Line Value (CLV)</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Average CLV</span>
                <span className={`font-semibold ${clv.clv.avgClv > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {clv.clv.avgClv > 0 ? '+' : ''}{clv.clv.avgClv.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Total CLV</span>
                <span className={`font-semibold ${clv.clv.totalClv > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {clv.clv.totalClv > 0 ? '+' : ''}{clv.clv.totalClv.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Sample Size</span>
                <span className="text-gray-300 font-semibold">{clv.clv.sampleSize}</span>
              </div>
            </div>
            {clv.clv.sampleSize === 0 && (
              <p className="text-xs text-gray-500 mt-2">No settled bets yet. CLV compares your taken odds to closing odds.</p>
            )}
          </div>
          <div className="card border-gray-800">
            <h3 className="text-sm font-semibold mb-3">Expected Value (EV)</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Average EV</span>
                <span className={`font-semibold ${(clv.ev.avgEv ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {clv.ev.avgEv > 0 ? '+' : ''}{clv.ev.avgEv.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Positive EV Bets</span>
                <span className="text-green-400 font-semibold">{clv.ev.positiveEvCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Positive EV Accuracy</span>
                <span className="text-emerald-400 font-semibold">{clv.ev.positiveEvAccuracy.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Negative EV Accuracy</span>
                <span className="text-red-400 font-semibold">{clv.ev.negativeEvAccuracy.toFixed(1)}%</span>
              </div>
            </div>
            {(clv.ev.sampleSize ?? 0) === 0 && (
              <p className="text-xs text-gray-500 mt-2">EV compares ML probability to your taken odds. Positive EV = mathematical edge.</p>
            )}
          </div>
        </div>
      )}

      {ov && ov.streaks.current.type && (
        <div className="card border-gray-800">
          <h3 className="text-sm font-semibold mb-3">Streaks</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className={`text-lg font-bold ${ov.streaks.current.type === 'win' ? 'text-emerald-400' : ov.streaks.current.type === 'loss' ? 'text-red-400' : 'text-gray-400'}`}>
                {ov.streaks.current.count}
              </div>
              <div className="text-[10px] text-gray-500 capitalize">{ov.streaks.current.type} streak</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-400">{ov.streaks.longestWinStreak}</div>
              <div className="text-[10px] text-gray-500">Best win streak</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-400">{ov.streaks.longestLossStreak}</div>
              <div className="text-[10px] text-gray-500">Worst loss streak</div>
            </div>
          </div>
        </div>
      )}

      {ov && ov.leagueBreakdown.length > 0 && (
        <div className="card border-gray-800">
          <h3 className="text-sm font-semibold mb-3">League Breakdown</h3>
          <div className="space-y-1">
            {ov.leagueBreakdown.map((l) => (
              <div key={l.league} className="flex items-center gap-3 py-1.5 border-b border-gray-800/40 last:border-0">
                <span className="text-xs text-gray-300 w-32 truncate">{l.league}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${l.winRate * 100}%` }} />
                </div>
                <span className={`text-xs font-semibold w-12 text-right ${l.winRate > 0.5 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(l.winRate * 100).toFixed(0)}%
                </span>
                <span className="text-[10px] text-gray-500 w-8 text-right">{l.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ov && ov.recentActivity.length > 0 && (
        <div className="card border-gray-800">
          <h3 className="text-sm font-semibold mb-3">Recent Activity (30 days)</h3>
          <div className="space-y-1">
            {ov.recentActivity.slice(-14).map((day) => (
              <div key={day.date} className="flex items-center gap-2 text-xs py-1">
                <span className="text-gray-500 w-20">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <div className="flex-1 flex gap-0.5 h-3 items-end">
                  {day.profit >= 0 ? (
                    <div className="bg-emerald-600 rounded-t" style={{ width: `${Math.min(day.bets * 8, 100)}%`, height: `${Math.min(Math.abs(day.profit) * 2, 20)}px` }} />
                  ) : (
                    <div className="bg-red-600 rounded-t" style={{ width: `${Math.min(day.bets * 8, 100)}%`, height: `${Math.min(Math.abs(day.profit) * 2, 20)}px` }} />
                  )}
                </div>
                <span className={`font-semibold w-16 text-right ${day.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {day.profit > 0 ? '+' : ''}{day.profit.toFixed(1)}
                </span>
                <span className="text-gray-500 w-6 text-right">{day.bets}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
