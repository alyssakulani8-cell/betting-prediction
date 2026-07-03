import { useState, useEffect, useCallback, useRef } from 'react'
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

type Tab = 'live' | 'today' | 'upcoming'
type BetType = 'ml' | 'ou'

const TABS: { key: Tab; label: string }[] = [
  { key: 'live', label: 'LIVE' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
]

const BET_TYPES: { key: BetType; label: string }[] = [
  { key: 'ml', label: 'Moneyline' },
  { key: 'ou', label: 'O/U' },
]

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

function formatOdds(v: number | null | undefined) { return v ? v.toFixed(2) : '-' }

function LiveScore({ home, away }: { home: number; away: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-orange-900/40 rounded px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
      <span className="text-sm font-bold text-orange-400 tabular-nums">{home}:{away}</span>
    </div>
  )
}

function PredictionBar({ home, away }: { home: number; away: number }) {
  const total = home + away
  const hp = total > 0 ? (home / total) * 100 : 50
  const ap = total > 0 ? (away / total) * 100 : 50
  return (
    <div className="mt-1.5">
      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-gray-800">
        <div className="bg-orange-500 transition-all" style={{ width: `${hp}%` }} />
        <div className="bg-blue-500 transition-all" style={{ width: `${ap}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
        <span className="text-orange-400">{home > 0 ? `${(home * 100).toFixed(0)}%` : ''}</span>
        <span className="text-blue-400">{away > 0 ? `${(away * 100).toFixed(0)}%` : ''}</span>
      </div>
    </div>
  )
}

function OddsButton({ label, value, active }: { label: string; value: number | null; active?: boolean }) {
  return (
    <button
      className={`px-2.5 py-1.5 rounded text-xs font-bold min-w-[48px] text-center transition-all ${
        active
          ? 'bg-orange-700/40 text-orange-300 border border-orange-600/60 scale-105'
          : 'bg-gray-800/80 text-gray-300 border border-gray-700/50 hover:border-orange-700/50 hover:bg-gray-800'
      } ${value == null ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
    >
      <span className="block text-[10px] text-gray-500 font-normal">{label}</span>
      <span className="text-xs">{value ? value.toFixed(2) : '-'}</span>
    </button>
  )
}

function MatchCard({ match, betType }: { match: Match; betType: BetType }) {
  const isLive = match.status === 'LIVE'
  const hp = match.aiPrediction?.homeWinProb ?? 0.5
  const ap = match.aiPrediction?.awayWinProb ?? 0.5
  const pickHome = hp > ap
  const ouProb = 0.55

  return (
    <div className={`py-2.5 px-3 rounded-lg transition-colors hover:bg-gray-800/40 ${isLive ? 'bg-gray-850' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {!isLive && (
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wider">{match.league.name}</span>
              <span className="text-[10px] text-gray-600">{formatTime(match.kickoff)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 text-right">
              <span className={`text-sm font-semibold ${pickHome ? 'text-orange-400' : 'text-gray-200'}`}>
                {match.homeTeam.short || match.homeTeam.name}
              </span>
            </div>
            {isLive ? (
              <LiveScore home={match.homeScore ?? 0} away={match.awayScore ?? 0} />
            ) : (
              <span className="text-xs text-gray-600 w-6 text-center">vs</span>
            )}
            <div className="flex-1">
              <span className={`text-sm font-semibold ${!pickHome ? 'text-blue-400' : 'text-gray-200'}`}>
                {match.awayTeam.short || match.awayTeam.name}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex gap-1">
          {betType === 'ml' && match.odds && (
            <>
              <OddsButton label="Home" value={match.odds.homeWin} active={pickHome} />
              <OddsButton label="Away" value={match.odds.awayWin} active={!pickHome} />
            </>
          )}
          {betType === 'ou' && match.odds && (
            <>
              <OddsButton label="O/U" value={match.odds.overPrice} active={ouProb > 0.5} />
            </>
          )}
        </div>
      </div>

      {!isLive && match.aiPrediction && betType === 'ml' && (
        <PredictionBar home={hp} away={ap} />
      )}
    </div>
  )
}

function LeagueSection({ league, betType }: { league: GroupedLeague; betType: BetType }) {
  const [expanded, setExpanded] = useState(true)
  const hasLive = league.matches.some((m) => m.status === 'LIVE')
  return (
    <div className="card overflow-hidden border border-gray-800/60">
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-gray-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🏀</span>
          <h3 className="font-semibold text-sm">{league.name}</h3>
          {hasLive && <span className="text-[10px] font-bold text-orange-400 bg-orange-900/40 px-1.5 py-0.5 rounded animate-pulse">LIVE</span>}
          <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{league.matchCount}</span>
        </div>
        <span className={`text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {expanded && (
        <div className="divide-y divide-gray-800/40 px-2 pb-2">
          {league.matches.map((m) => (
            <MatchCard key={m.id} match={m} betType={betType} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function BasketballPage() {
  const [tab, setTab] = useState<Tab>('today')
  const [betType, setBetType] = useState<BetType>('ml')
  const [leagues, setLeagues] = useState<GroupedLeague[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const liveTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await matchesService.getGrouped(tab, 'basketball')
      setLeagues(data.leagues ?? [])
      setTotal(data.totalCount ?? 0)
      setError('')
    } catch {
      setError('Failed to load basketball matches')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (tab === 'live') {
      liveTimer.current = setInterval(fetchData, 15000)
    }
    return () => { if (liveTimer.current) clearInterval(liveTimer.current) }
  }, [tab, fetchData])

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Basketball</h1>
          <p className="text-xs text-gray-500">{total} matches available</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-orange-700 text-white shadow-lg shadow-orange-900/40'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.key === 'live' && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 inline-block animate-pulse align-middle" />}
          </button>
        ))}
      </div>

      <div className="flex gap-1">
        {BET_TYPES.map((p) => (
          <button
            key={p.key}
            onClick={() => setBetType(p.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              betType === p.key
                ? 'bg-gray-800 text-orange-400 border border-orange-700/50'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="card animate-pulse border-gray-800">
              <div className="h-5 bg-gray-800 rounded w-1/3 mb-3" />
              {[1, 2].map((j) => <div key={j} className="h-12 bg-gray-800/60 rounded mb-2" />)}
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card border-red-800/50 text-center py-6">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg" onClick={fetchData}>Retry</button>
        </div>
      ) : leagues.length === 0 ? (
        <div className="card border-gray-800 text-center py-10">
          <p className="text-gray-500 text-sm mb-1">No basketball matches found</p>
          <p className="text-gray-600 text-xs">Try switching tabs</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {leagues.map((league) => (
            <LeagueSection key={league.id} league={league} betType={betType} />
          ))}
        </div>
      )}
    </div>
  )
}
