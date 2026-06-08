export default function PredictionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Predictions</h1>
        <select className="input w-48">
          <option>All Leagues</option>
          <option>Premier League</option>
          <option>La Liga</option>
          <option>Serie A</option>
          <option>Bundesliga</option>
        </select>
      </div>

      <div className="card">
        <p className="text-gray-400">Prediction cards will be rendered here with AI-generated insights.</p>
      </div>
    </div>
  )
}
