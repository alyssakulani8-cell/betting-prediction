import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { userPredictionsService } from '@/services/userPredictions'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [match, setMatch] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [prediction, setPrediction] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    api.get(`/predictions/${id}`)
      .then(({ data }) => {
        setMatch(data)
        setPrediction(data.predicted_outcome === 'Home Win' ? 'HOME_WIN' : data.predicted_outcome === 'Away Win' ? 'AWAY_WIN' : 'DRAW')
      })
      .catch(() => setError('Failed to load match'))
      .finally(() => setLoading(false))
  }, [id])

  const handlePick = async () => {
    if (!prediction || !id) return
    setSubmitting(true)
    try {
      await userPredictionsService.create(id, prediction, match?.confidence || 0.5)
      navigate('/my-predictions')
    } catch {
      setError('Failed to save prediction')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="card animate-pulse border-gray-800">
          <div className="h-6 bg-gray-800 rounded w-1/2 mb-4" />
          <div className="h-4 bg-gray-800/60 rounded w-1/3 mb-2" />
          <div className="h-4 bg-gray-800/60 rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (error || !match) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <p className="text-red-400 text-sm mb-3">{error || 'Match not found'}</p>
        <button className="text-xs bg-gray-800 text-gray-300 px-4 py-2 rounded-lg" onClick={() => navigate(-1)}>Go back</button>
      </div>
    )
  }

  const hp = match.homeWinProb ?? 0.33
  const dp = match.drawProb ?? 0.34
  const ap = match.awayWinProb ?? 0.33
  const isLive = match.status === 'LIVE'
  const isFinished = match.status === 'FINISHED'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <button onClick={() => navigate(-1)} className="text-xs text-gray-500 hover:text-gray-300 mb-2">&larr; Back</button>

      <div className="card border-gray-800">
        <div className="text-center mb-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{match.league || 'Match'}</p>
          {isLive && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/40 px-2 py-0.5 rounded animate-pulse">LIVE</span>}
          <p className="text-xs text-gray-500">{new Date(match.kickoff).toLocaleString()}</p>
          {isFinished && match.homeScore != null && (
            <p className="text-lg font-bold text-gray-200 mt-2">{match.homeScore} - {match.awayScore}</p>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 py-4">
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-gray-200">{match.homeTeam}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-400">{match.predictedScore}</p>
            <p className="text-[10px] text-gray-500">Predicted</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-gray-200">{match.awayTeam}</p>
          </div>
        </div>

        <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden flex">
          <div className="bg-emerald-500 h-full" style={{ width: `${hp * 100}%` }} />
          <div className="bg-gray-500 h-full" style={{ width: `${dp * 100}%` }} />
          <div className="bg-rose-500 h-full" style={{ width: `${ap * 100}%` }} />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-emerald-400">{match.homeTeam}: {(hp * 100).toFixed(0)}%</span>
          <span className="text-gray-400">Draw: {(dp * 100).toFixed(0)}%</span>
          <span className="text-rose-400">{match.awayTeam}: {(ap * 100).toFixed(0)}%</span>
        </div>
      </div>

      {!isFinished && (
        <div className="card border-gray-800">
          <h3 className="text-sm font-semibold mb-3">Your Prediction</h3>
          <div className="flex gap-2 mb-4">
            {[
              { key: 'HOME_WIN', label: match.homeTeam, prob: hp },
              { key: 'DRAW', label: 'Draw', prob: dp },
              { key: 'AWAY_WIN', label: match.awayTeam, prob: ap },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPrediction(opt.key)}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all ${
                  prediction === opt.key
                    ? 'bg-emerald-700 text-white border border-emerald-500'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
                }`}
              >
                <span className="block text-xs font-normal text-gray-500 mb-0.5">{(opt.prob * 100).toFixed(0)}%</span>
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={handlePick}
            disabled={submitting || !prediction}
            className="w-full text-sm bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold"
          >
            {submitting ? 'Saving...' : 'Confirm Pick'}
          </button>
        </div>
      )}

      {match.analysis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card border-gray-800">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">{match.homeTeam} Form</h4>
            <div className="flex gap-1 mb-3">
              {(match.analysis.homeForm || '').split('-').map((r: string, i: number) => (
                <span key={i} className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center ${
                  r === 'W' ? 'bg-emerald-700 text-white' : r === 'L' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300'
                }`}>{r}</span>
              ))}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Avg Goals Scored</span><span className="text-gray-200">{match.analysis.homexG}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Avg Goals Conceded</span><span className="text-gray-200">{match.analysis.awayxG}</span></div>
            </div>
          </div>
          <div className="card border-gray-800">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">{match.awayTeam} Form</h4>
            <div className="flex gap-1 mb-3">
              {(match.analysis.awayForm || '').split('-').map((r: string, i: number) => (
                <span key={i} className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center ${
                  r === 'W' ? 'bg-emerald-700 text-white' : r === 'L' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300'
                }`}>{r}</span>
              ))}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Avg Goals Scored</span><span className="text-gray-200">{match.analysis.awayxG}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Avg Goals Conceded</span><span className="text-gray-200">{match.analysis.homexG}</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {match.over25Prob != null && (
          <div className="card border-gray-800 text-center">
            <p className="text-[10px] text-gray-500">Over 2.5</p>
            <p className="text-lg font-bold text-gray-200">{(match.over25Prob * 100).toFixed(0)}%</p>
          </div>
        )}
        {match.under25Prob != null && (
          <div className="card border-gray-800 text-center">
            <p className="text-[10px] text-gray-500">Under 2.5</p>
            <p className="text-lg font-bold text-gray-200">{(match.under25Prob * 100).toFixed(0)}%</p>
          </div>
        )}
        {match.bttsProb != null && (
          <div className="card border-gray-800 text-center">
            <p className="text-[10px] text-gray-500">Both to Score</p>
            <p className="text-lg font-bold text-gray-200">{(match.bttsProb * 100).toFixed(0)}%</p>
          </div>
        )}
      </div>

      {match.analysis?.h2h && (
        <div className="card border-gray-800">
          <h4 className="text-xs font-semibold text-gray-400 mb-2">Head to Head</h4>
          <p className="text-sm text-gray-200">{match.analysis.h2h}</p>
        </div>
      )}
    </div>
  )
}
