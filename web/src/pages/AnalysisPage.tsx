import { useState, useEffect } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

interface TeamInfo {
  id: string
  name: string
}

export default function AnalysisPage() {
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [search, setSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/leagues')
      .then(async ({ data }) => {
        const leagues = data.leagues ?? data ?? []
        const teamSet = new Map<string, string>()
        for (const league of leagues.slice(0, 5)) {
          try {
            const { data: leagueData } = await api.get(`/leagues/${league.id}/teams`)
            const items = leagueData.teams ?? leagueData ?? []
            for (const t of items) {
              if (!teamSet.has(t.id)) teamSet.set(t.id, t.name)
            }
          } catch {}
        }
        const teamList = Array.from(teamSet.entries()).map(([id, name]) => ({ id, name }))
        setTeams(teamList)
      })
      .catch(() => setError('Could not load teams'))
      .finally(() => setLoading(false))
  }, [])

  const filteredTeams = search.trim()
    ? teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : teams.slice(0, 50)

  const handleAnalyze = async (teamId: string) => {
    setAnalyzing(true)
    setError('')
    try {
      const { data } = await api.get(`/analysis/team/${teamId}`)
      setSelectedTeam(data)
    } catch {
      setError('Analysis not available for this team')
      setSelectedTeam(null)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Team Analysis</h1>
        <p className="text-xs text-gray-500">Search and analyze team performance</p>
      </div>

      <div className="card border-gray-800">
        <input
          className="input w-full"
          placeholder="Search for a team..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {loading ? (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-800/60 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {filteredTeams.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">No teams found</p>
            ) : (
              filteredTeams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleAnalyze(t.id)}
                  disabled={analyzing}
                  className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  {t.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {analyzing && (
        <div className="card border-gray-800 animate-pulse">
          <div className="h-5 bg-gray-800 rounded w-1/3 mb-3" />
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-800/60 rounded" />)}
          </div>
        </div>
      )}

      {selectedTeam && !analyzing && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card border-gray-800">
              <h3 className="text-lg font-semibold mb-4">{selectedTeam.name}</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Avg Goals Scored', value: selectedTeam.avgGoalsScored },
                  { label: 'Avg Goals Conceded', value: selectedTeam.avgGoalsConceded },
                  { label: 'xG Per Match', value: selectedTeam.xGPerMatch },
                  { label: 'xGA Per Match', value: selectedTeam.xGAPerMatch },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-lg font-bold text-gray-200">{s.value ?? '-'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="card border-gray-800">
              <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
              <div className="space-y-3">
                {[
                  { label: 'Possession', value: `${selectedTeam.possessionAvg ?? '-'}%` },
                  { label: 'Clean Sheet', value: selectedTeam.cleanSheetPct != null ? `${(selectedTeam.cleanSheetPct * 100).toFixed(0)}%` : '-' },
                  { label: 'BTTS', value: selectedTeam.bttsPct != null ? `${(selectedTeam.bttsPct * 100).toFixed(0)}%` : '-' },
                ].map((s) => (
                  <div key={s.label} className="flex justify-between py-2 border-b border-gray-800 last:border-0">
                    <span className="text-sm text-gray-400">{s.label}</span>
                    <span className="text-sm font-semibold text-gray-200">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selectedTeam.form && (
            <div className="card border-gray-800">
              <h4 className="text-xs font-semibold text-gray-400 mb-2">Recent Form</h4>
              <div className="flex gap-1">
                {(selectedTeam.form || '').split('-').map((r: string, i: number) => (
                  <span key={i} className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center ${
                    r === 'W' ? 'bg-emerald-700 text-white' : r === 'L' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-300'
                  }`}>{r}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
