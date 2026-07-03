import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { matchesService } from '@/services/matches'

interface Team { id: string; name: string; short?: string }
interface League { id: string; name: string; country: string }
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
  id: string; name: string; country: string
  matchCount: number; matches: Match[]
}

type Tab = 'live' | 'today' | 'upcoming'
type PredictionType = '1x2' | 'ou' | 'btts' | 'dc'

const LEAGUE_FLAGS: Record<string, string> = {
  pl: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', pd: '🇪🇸', sa: '🇮🇹', bl: '🇩🇪', fl: '🇫🇷',
  ucl: '⭐', uel: '🏆', wcq: '🌍', ecq: '🇪🇺', copa: '🌎',
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'live', label: 'LIVE' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
]

const PREDICTION_TYPES: { key: PredictionType; label: string }[] = [
  { key: '1x2', label: '1X2' },
  { key: 'ou', label: 'O/U 2.5' },
  { key: 'btts', label: 'BTTS' },
  { key: 'dc', label: 'DC' },
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

function PredictionBar({ home, draw, away }: { home: number; draw: number | null; away: number }) {
  const total = home + (draw ?? 0) + away
  const hp = (home / total) * 100
  const dp = ((draw ?? 0) / total) * 100
  const ap = (away / total) * 100
  return (
    <div className="mt-1.5">
      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-gray-800">
        <div className="bg-emerald-500 transition-all" style={{ width: `${hp}%` }} />
        {draw != null && <div className="bg-gray-500 transition-all" style={{ width: `${dp}%` }} />}
        <div className="bg-rose-500 transition-all" style={{ width: `${ap}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
        <span className="text-emerald-400">{home > 0 ? `${(home * 100).toFixed(0)}%` : ''}</span>
        {draw != null && draw > 0 && <span className="text-gray-400">{(draw * 100).toFixed(0)}%</span>}
        <span className="text-rose-400">{away > 0 ? `${(away * 100).toFixed(0)}%` : ''}</span>
      </div>
    </div>
  )
}

function LiveScore({ home, away }: { home: number; away: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-emerald-900/40 rounded px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-sm font-bold text-emerald-400 tabular-nums">{home}:{away}</span>
    </div>
  )
}

function OddsButton({ label, value, active, onClick }: { label: string; value: number | null; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded text-xs font-bold min-w-[48px] text-center transition-all ${
        active
          ? 'bg-emerald-700/40 text-emerald-300 border border-emerald-600/60 scale-105'
          : 'bg-gray-800/80 text-gray-300 border border-gray-700/50 hover:border-emerald-700/50 hover:bg-gray-800'
      } ${value == null ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
    >
      <span className="block text-[10px] text-gray-500 font-normal">{label}</span>
      <span className="text-xs">{value ? value.toFixed(2) : '-'}</span>
    </button>
  )
}

function MatchCard({ match, predType, highlight, onPick }: { match: Match; predType: PredictionType; highlight?: boolean; onPick?: (id: string) => void }) {
  const isLive = match.status === 'LIVE'
  const hp = match.aiPrediction?.homeWinProb ?? 0.33
  const dp = match.aiPrediction?.drawProb ?? 0.34
  const ap = match.aiPrediction?.awayWinProb ?? 0.33
  const best = Math.max(hp, dp, ap)
  const pick1 = best === hp
  const pickX = best === dp
  const pick2 = best === ap

  const ouProb = hp + ap > 0.5 ? 0.65 : 0.40
  const bttsProb = hp + ap > 0.5 ? 0.55 : 0.40
  const dcHomeProb = hp + dp
  const dcAwayProb = ap + dp

  return (
    <div
      className={`py-2.5 px-3 rounded-lg transition-colors cursor-pointer ${
        highlight ? 'bg-emerald-900/10 border border-emerald-700/30' : 'hover:bg-gray-800/40'
      } ${isLive ? 'bg-gray-850' : ''}`}
      onClick={() => onPick?.(match.id)}
    >
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
              <span className={`text-sm font-semibold ${pick1 ? 'text-emerald-400' : 'text-gray-200'}`}>
                {match.homeTeam.short || match.homeTeam.name}
              </span>
            </div>
            {isLive ? (
              <LiveScore home={match.homeScore ?? 0} away={match.awayScore ?? 0} />
            ) : (
              <span className="text-xs text-gray-600 w-6 text-center">vs</span>
            )}
            <div className="flex-1">
              <span className={`text-sm font-semibold ${pick2 ? 'text-rose-400' : 'text-gray-200'}`}>
                {match.awayTeam.short || match.awayTeam.name}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex gap-1">
          {predType === '1x2' && match.odds && (
            <>
              <OddsButton label="1" value={match.odds.homeWin} active={pick1} />
              <OddsButton label="X" value={match.odds.draw} active={pickX} />
              <OddsButton label="2" value={match.odds.awayWin} active={pick2} />
            </>
          )}
          {predType === 'ou' && match.odds && (
            <>
              <OddsButton label="O 2.5" value={match.odds.overPrice} active={ouProb > 0.5} />
              <OddsButton label="U 2.5" value={match.odds.underPrice} active={ouProb <= 0.5} />
            </>
          )}
          {predType === 'btts' && match.odds && (
            <>
              <OddsButton label="Yes" value={match.odds.bttsYes} active={bttsProb > 0.5} />
              <OddsButton label="No" value={match.odds.bttsNo} active={bttsProb <= 0.5} />
            </>
          )}
          {predType === 'dc' && match.odds && (
            <>
              <OddsButton label={`1X`} value={match.odds.homeWin && match.odds.draw ? +(match.odds.homeWin + match.odds.draw).toFixed(2) : null} active={dcHomeProb > dcAwayProb} />
              <OddsButton label={`X2`} value={match.odds.draw && match.odds.awayWin ? +(match.odds.draw + match.odds.awayWin).toFixed(2) : null} active={dcAwayProb > dcHomeProb} />
            </>
          )}
        </div>
      </div>

      {!isLive && match.aiPrediction && predType === '1x2' && (
        <PredictionBar home={hp} draw={dp} away={ap} />
      )}
      {!isLive && match.aiPrediction && predType === 'ou' && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${ouProb * 100}%` }} />
          </div>
          <span className="text-emerald-400 w-12 text-right">O {ouProb > 0.5 ? '✓' : ''}</span>
          <span className="text-rose-400 w-12">U {ouProb <= 0.5 ? '✓' : ''}</span>
        </div>
      )}
      {!isLive && match.aiPrediction && predType === 'btts' && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${bttsProb * 100}%` }} />
          </div>
          <span className="text-emerald-400 w-12 text-right">Yes {bttsProb > 0.5 ? '✓' : ''}</span>
          <span className="text-rose-400 w-12">No {bttsProb <= 0.5 ? '✓' : ''}</span>
        </div>
      )}
      {!isLive && match.aiPrediction && predType === 'dc' && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className={`px-1.5 py-0.5 rounded ${dcHomeProb > dcAwayProb ? 'bg-emerald-900/40 text-emerald-400' : 'text-gray-500'}`}>
            1X: {(dcHomeProb * 100).toFixed(0)}%
          </span>
          <span className={`px-1.5 py-0.5 rounded ${dcAwayProb > dcHomeProb ? 'bg-rose-900/40 text-rose-400' : 'text-gray-500'}`}>
            X2: {(dcAwayProb * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  )
}

function LeagueSection({ league, predType, onPick }: { league: GroupedLeague; predType: PredictionType; onPick?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(true)
  const hasLive = league.matches.some((m) => m.status === 'LIVE')
  return (
    <div className="card overflow-hidden border border-gray-800/60">
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-gray-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{LEAGUE_FLAGS[league.id] || '🏆'}</span>
          <h3 className="font-semibold text-sm">{league.name}</h3>
          {hasLive && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/40 px-1.5 py-0.5 rounded animate-pulse">LIVE</span>}
          <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{league.matchCount}</span>
        </div>
        <span className={`text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {expanded && (
        <div className="divide-y divide-gray-800/40 px-2 pb-2">
          {league.matches.map((m) => (
            <MatchCard key={m.id} match={m} predType={predType} highlight={m.status === 'LIVE'} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PredictionsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('today')
  const [predType, setPredType] = useState<PredictionType>('1x2')
  const [leagues, setLeagues] = useState<GroupedLeague[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{ total: number; timestamp: string } | null>(null)
  const liveTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await matchesService.getGrouped(tab)
      setLeagues(data.leagues ?? [])
      setTotal(data.totalCount ?? 0)
      setError('')
    } catch {
      setError('Failed to load matches')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (tab === 'live') {
      liveTimer.current = setInterval(fetchData, 15000)
    }
    return () => { if (liveTimer.current) clearInterval(liveTimer.current) }
  }, [tab, fetchData])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const result = await matchesService.analyzeAll()
      setAnalysisResult(result)
      await fetchData()
    } catch {
      setError('Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Matches</h1>
          <p className="text-xs text-gray-500">{total} matches available</p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5"
        >
          {analyzing ? (
            <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing...</>
          ) : (
            <><span className="text-sm">⟳</span> Analyze All</>
          )}
        </button>
      </div>

      {analysisResult && (
        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg px-3 py-2 text-xs text-emerald-300 flex items-center justify-between">
          <span>Analysis complete: {analysisResult.total} matches predicted</span>
          <button onClick={() => { setAnalysisResult(null); setError('') }} className="text-gray-500 hover:text-gray-300">✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-900/40'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.key === 'live' && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse align-middle" />}
          </button>
        ))}
      </div>

      {/* Prediction Type Selector */}
      <div className="flex gap-1">
        {PREDICTION_TYPES.map((p) => (
          <button
            key={p.key}
            onClick={() => setPredType(p.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              predType === p.key
                ? 'bg-gray-800 text-emerald-400 border border-emerald-700/50'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
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
          <p className="text-gray-500 text-sm mb-1">No matches found</p>
          <p className="text-gray-600 text-xs">Try switching tabs</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {leagues.map((league) => (
            <LeagueSection key={league.id} league={league} predType={predType} onPick={(id) => navigate(`/match/${id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}
