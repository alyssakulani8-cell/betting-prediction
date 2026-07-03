import { useState, useEffect } from 'react'
import { userPredictionsService } from '@/services/userPredictions'

interface MatchTeam { id: string; name: string; short?: string }
interface MatchLeague { id: string; name: string; country: string }
interface AiPrediction {
  homeWinProb: number; drawProb: number | null; awayWinProb: number; confidence: number
}
interface Match {
  id: string; homeTeam: MatchTeam; awayTeam: MatchTeam; league: MatchLeague
  homeScore: number | null; awayScore: number | null; status: string; kickoff: string
  aiPrediction?: AiPrediction | null
}
interface UserPrediction {
  id: string
  predictedWinner: 'HOME_WIN' | 'DRAW' | 'AWAY_WIN'
  confidence: number
  result: string | null
  profit: number | null
  createdAt: string
  match: Match
}

const WINNER_LABELS: Record<string, string> = {
  HOME_WIN: 'Home',
  DRAW: 'Draw',
  AWAY_WIN: 'Away',
}

const WINNER_COLORS: Record<string, string> = {
  HOME_WIN: 'text-emerald-400',
  DRAW: 'text-gray-400',
  AWAY_WIN: 'text-rose-400',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function MyPredictionsPage() {
  const [predictions, setPredictions] = useState<UserPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchPredictions = async () => {
    try {
      setLoading(true)
      const data = await userPredictionsService.getAll()
      setPredictions(data.predictions ?? [])
      setError('')
    } catch {
      setError('Failed to load predictions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPredictions() }, [])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await userPredictionsService.delete(id)
      setPredictions((prev) => prev.filter((p) => p.id !== id))
    } catch {
      setError('Failed to delete prediction')
    } finally {
      setDeleting(null)
    }
  }

  const isFinished = (status: string) => status === 'FINISHED'
  const isLive = (status: string) => status === 'LIVE'

  const correctCount = predictions.filter((p) => p.result === 'correct').length
  const totalWithResult = predictions.filter((p) => p.result !== null).length

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">My Predictions</h1>
          <p className="text-xs text-gray-500">{predictions.length} total predictions</p>
        </div>
        {totalWithResult > 0 && (
          <div className="text-xs bg-gray-800 rounded-lg px-3 py-2 text-gray-400">
            Accuracy: <span className="text-emerald-400 font-semibold">
              {((correctCount / totalWithResult) * 100).toFixed(0)}%
            </span>
            {' '}({correctCount}/{totalWithResult})
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2 text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-gray-500 hover:text-gray-300">✕</button>
        </div>
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
      ) : predictions.length === 0 ? (
        <div className="card border-gray-800 text-center py-10">
          <p className="text-gray-500 text-sm mb-1">No predictions yet</p>
          <p className="text-gray-600 text-xs">Go to Predictions page to make your picks</p>
        </div>
      ) : (
        <div className="space-y-2">
          {predictions.map((p) => {
            const match = p.match
            const hp = match.aiPrediction?.homeWinProb ?? 0.33
            const ap = match.aiPrediction?.awayWinProb ?? 0.33
            const aiPick = hp > ap ? 'HOME_WIN' : ap > hp ? 'AWAY_WIN' : 'DRAW'
            const matchesAi = p.predictedWinner === aiPick

            return (
              <div
                key={p.id}
                className={`card border ${
                  isFinished(match.status) && p.result === 'correct'
                    ? 'border-emerald-700/30'
                    : isFinished(match.status) && p.result === 'incorrect'
                    ? 'border-red-700/30'
                    : 'border-gray-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] text-gray-600 font-medium">{match.league.name}</span>
                      <span className="text-[10px] text-gray-600">{formatDate(match.kickoff)}</span>
                      {isLive(match.status) && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/40 px-1.5 py-0.5 rounded animate-pulse">LIVE</span>
                      )}
                      {isFinished(match.status) && match.homeScore !== null && match.awayScore !== null && (
                        <span className="text-[10px] text-gray-400 font-mono">{match.homeScore}:{match.awayScore}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-200">
                        {match.homeTeam.short || match.homeTeam.name}
                      </span>
                      <span className="text-xs text-gray-600">vs</span>
                      <span className="text-sm font-semibold text-gray-200">
                        {match.awayTeam.short || match.awayTeam.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-2">
                    <div className="text-right">
                      <div className={`text-xs font-bold ${WINNER_COLORS[p.predictedWinner]}`}>
                        {WINNER_LABELS[p.predictedWinner]}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {(p.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    {!matchesAi && (
                      <div className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                        AI: {WINNER_LABELS[aiPick]}
                      </div>
                    )}
                    {isFinished(match.status) && p.result && (
                      <div className={`text-xs font-bold px-2 py-1 rounded ${
                        p.result === 'correct' ? 'text-emerald-400 bg-emerald-900/20' : 'text-red-400 bg-red-900/20'
                      }`}>
                        {p.result === 'correct' ? '✓' : '✗'}
                      </div>
                    )}
                    {!isFinished(match.status) && (
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        {deleting === p.id ? '...' : '✕'}
                      </button>
                    )}
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
