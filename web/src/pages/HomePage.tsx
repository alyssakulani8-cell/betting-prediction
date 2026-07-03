import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { matchesService } from '@/services/matches'

interface Team { id: string; name: string; short?: string }
interface League { id: string; name: string; country: string; sport: string }
interface MatchOdds {
  homeWin: number; draw: number | null; awayWin: number
  overUnder: number | null; overPrice: number | null; underPrice: number | null
  bttsYes: number | null; bttsNo: number | null
}
interface AiPrediction {
  homeWinProb: number; drawProb: number | null; awayWinProb: number
  confidence: number
}
interface Match {
  id: string
  homeTeam: Team; awayTeam: Team
  league: League; leagueId: string
  kickoff: string; status: string
  homeScore: number | null; awayScore: number | null
  odds: MatchOdds | null; aiPrediction: AiPrediction | null
}
interface GroupedLeague {
  id: string; name: string; country: string; sport: string
  matchCount: number; matches: Match[]
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  if (diff > 0 && diff < 86400000) {
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function LiveScore({ home, away }: { home: number; away: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-emerald-900/40 rounded px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-sm font-bold text-emerald-400 tabular-nums">{home}:{away}</span>
    </div>
  )
}

function MiniMatchRow({ match, onPick }: { match: Match; onPick?: (id: string) => void }) {
  const isLive = match.status === 'LIVE'
  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer ${isLive ? 'bg-emerald-900/10' : 'hover:bg-gray-800/30'}`} onClick={() => onPick?.(match.id)}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-xs text-gray-500 w-16 text-right truncate">{match.homeTeam.short || match.homeTeam.name}</span>
        {isLive ? (
          <LiveScore home={match.homeScore ?? 0} away={match.awayScore ?? 0} />
        ) : (
          <span className="text-xs text-gray-600 w-6 text-center">vs</span>
        )}
        <span className="text-xs text-gray-300 w-16 truncate">{match.awayTeam.short || match.awayTeam.name}</span>
        <span className="text-[10px] text-gray-600 ml-2">{formatTime(match.kickoff)}</span>
      </div>
      {match.aiPrediction && (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
          match.aiPrediction.confidence > 0.7
            ? 'bg-emerald-900/40 text-emerald-400'
            : match.aiPrediction.confidence > 0.5
              ? 'bg-yellow-900/40 text-yellow-400'
              : 'bg-gray-800 text-gray-500'
        }`}>
          {(match.aiPrediction.confidence * 100).toFixed(0)}%
        </span>
      )}
    </div>
  )
}

function HomePage() {
  const navigate = useNavigate()
  const [liveLeagues, setLiveLeagues] = useState<GroupedLeague[]>([])
  const [todayLeagues, setTodayLeagues] = useState<GroupedLeague[]>([])
  const [liveTotal, setLiveTotal] = useState(0)
  const [todayTotal, setTodayTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const liveTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [live, today] = await Promise.all([
        matchesService.getGrouped('live'),
        matchesService.getGrouped('today'),
      ])
      setLiveLeagues(live.leagues ?? [])
      setLiveTotal(live.totalCount ?? 0)
      setTodayLeagues(today.leagues ?? [])
      setTodayTotal(today.totalCount ?? 0)
      setError('')
    } catch {
      setError('Failed to load matches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    liveTimer.current = setInterval(fetchData, 15000)
    return () => { if (liveTimer.current) clearInterval(liveTimer.current) }
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card animate-pulse"><div className="h-6 bg-gray-800 rounded w-1/3 mb-2" /><div className="h-4 bg-gray-800 rounded w-2/3" /></div>
        <div className="card animate-pulse"><div className="h-5 bg-gray-800 rounded w-1/4 mb-3" />{[1,2,3].map(i => <div key={i} className="h-8 bg-gray-800/60 rounded mb-2" />)}</div>
        <div className="card animate-pulse"><div className="h-5 bg-gray-800 rounded w-1/4 mb-3" />{[1,2,3].map(i => <div key={i} className="h-8 bg-gray-800/60 rounded mb-2" />)}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border-red-800/50 text-center py-8">
        <p className="text-red-400 text-sm mb-3">{error}</p>
        <button className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg" onClick={fetchData}>Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="text-xl font-bold mb-1">AI Betting Predictions</h2>
        <p className="text-sm text-gray-400">Live scores, predictions, and upcoming matches</p>
      </div>

      {liveTotal > 0 && (
        <div className="card border-emerald-800/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="font-semibold text-sm text-emerald-400">LIVE</h3>
              <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{liveTotal}</span>
            </div>
            <Link to="/predictions" className="text-[10px] text-primary-400 hover:underline">View all &rarr;</Link>
          </div>
          <div className="divide-y divide-gray-800/30">
            {liveLeagues.map(league => (
              <div key={league.id}>
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider px-3 pt-1 pb-0.5">{league.name}</p>
                {league.matches.map(m => <MiniMatchRow key={m.id} match={m} onPick={(id) => navigate(`/match/${id}`)} />)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Today's Matches</h3>
          <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{todayTotal}</span>
        </div>
        {todayTotal > 0 ? (
          <div className="divide-y divide-gray-800/30">
            {todayLeagues.map(league => (
              <div key={league.id}>
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider px-3 pt-1 pb-0.5">{league.name}</p>
                {league.matches.map(m => <MiniMatchRow key={m.id} match={m} onPick={(id) => navigate(`/match/${id}`)} />)}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No matches scheduled for today</p>
        )}
        <div className="mt-2 text-center">
          <Link to="/predictions" className="text-xs text-primary-400 hover:underline">View all predictions &rarr;</Link>
        </div>
      </div>
    </div>
  )
}

export default HomePage