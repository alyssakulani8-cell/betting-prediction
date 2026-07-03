import { useState, useEffect } from 'react'
import { leaguesService } from '@/services/leagues'

interface League {
  id: string
  name: string
  country: string
  logo?: string
}

const FLAGS: Record<string, string> = {
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Spain: '🇪🇸',
  Italy: '🇮🇹',
  Germany: '🇩🇪',
  France: '🇫🇷',
  Europe: '🇪🇺',
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    leaguesService.getLeagues()
      .then(setLeagues)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leagues</h1>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 bg-gray-800 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leagues.map((l) => (
            <div
              key={l.id}
              className="card hover:border-primary-600/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{FLAGS[l.country] || '🏆'}</span>
                <div>
                  <h3 className="font-semibold text-lg">{l.name}</h3>
                  <p className="text-sm text-gray-500">{l.country}</p>
                </div>
              </div>
              <p className="text-xs text-primary-400 mt-3">View predictions &rarr;</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
