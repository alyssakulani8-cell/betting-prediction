import { useState, useEffect } from 'react'
import { analyticsService, type SessionData } from '@/services/analytics'

function formatDuration(start: string, end: string | null): string {
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const mins = Math.floor((e.getTime() - s.getTime()) / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [activeSession, setActiveSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState('')

  const fetchSessions = async () => {
    try {
      const data = await analyticsService.getSessions()
      setSessions(data)
      const active = data.find((s) => s.status === 'active')
      setActiveSession(active || null)
      setError('')
    } catch {
      setError('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSessions() }, [])

  const handleStart = async () => {
    setStarting(true)
    try {
      await analyticsService.startSession()
      await fetchSessions()
    } catch {
      setError('Failed to start session')
    } finally {
      setStarting(false)
    }
  }

  const handleEnd = async () => {
    setEnding(true)
    try {
      await analyticsService.endSession()
      await fetchSessions()
    } catch {
      setError('Failed to end session')
    } finally {
      setEnding(false)
    }
  }

  const activeDuration = activeSession
    ? formatDuration(activeSession.startTime, null)
    : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Betting Sessions</h1>
          <p className="text-xs text-gray-500">Track your betting sessions to monitor time and spend</p>
        </div>
      </div>

      {activeSession && (
        <div className="card border border-emerald-700/30 bg-emerald-900/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-semibold text-emerald-400">Active Session</h3>
              </div>
              <p className="text-xs text-gray-400">Started {formatDate(activeSession.startTime)}</p>
              <p className="text-xs text-gray-400">Duration: {activeDuration}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Bets: <span className="text-gray-300 font-semibold">{activeSession.betsPlaced}</span></p>
              <p className="text-xs text-gray-500">Stake: <span className="text-gray-300 font-semibold">{activeSession.totalStake.toFixed(1)}</span></p>
              <p className={`text-xs font-semibold ${activeSession.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {activeSession.netProfit >= 0 ? '+' : ''}{activeSession.netProfit.toFixed(1)}
              </p>
            </div>
          </div>
          <button
            onClick={handleEnd}
            disabled={ending}
            className="mt-3 w-full text-xs bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-medium"
          >
            {ending ? 'Ending...' : 'End Session'}
          </button>
        </div>
      )}

      {!activeSession && (
        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-3 rounded-lg font-medium"
        >
          {starting ? 'Starting...' : 'Start New Session'}
        </button>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse border-gray-800">
              <div className="h-5 bg-gray-800 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-800/60 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="card border-gray-800 text-center py-10">
          <p className="text-gray-500 text-sm mb-1">No sessions yet</p>
          <p className="text-gray-600 text-xs">Start a session to track your betting activity</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-400">Session History</h3>
          {sessions.filter((s) => s.status === 'ended').map((s) => {
            const isPositive = s.netProfit >= 0
            return (
              <div key={s.id} className="card border-gray-800 py-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-300">{formatDate(s.startTime)}</div>
                    <div className="text-[10px] text-gray-500">
                      {formatDuration(s.startTime, s.endTime)}
                    </div>
                  </div>
                  <div className="text-right flex gap-4">
                    <div>
                      <span className="text-[10px] text-gray-500">Bets</span>
                      <p className="text-xs font-semibold text-gray-200">{s.betsPlaced}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500">Stake</span>
                      <p className="text-xs font-semibold text-gray-200">{s.totalStake.toFixed(1)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500">P&L</span>
                      <p className={`text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{s.netProfit.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
