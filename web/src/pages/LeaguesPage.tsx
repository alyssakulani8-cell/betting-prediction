export default function LeaguesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leagues</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League'].map((league) => (
          <div key={league} className="card hover:border-primary-600/50 cursor-pointer transition-colors">
            <h3 className="font-semibold text-lg">{league}</h3>
            <p className="text-sm text-gray-500 mt-1">View predictions & analysis</p>
          </div>
        ))}
      </div>
    </div>
  )
}
