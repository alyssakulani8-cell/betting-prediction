export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold mb-2">AI Betting Predictions</h2>
        <p className="text-gray-400">
          Get precision predictions powered by machine learning algorithms
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="text-lg font-semibold text-primary-400 mb-1">Win Probability</h3>
          <p className="text-3xl font-bold">78.5%</p>
          <p className="text-sm text-gray-500">Average accuracy</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-accent-400 mb-1">Active Predictions</h3>
          <p className="text-3xl font-bold">24</p>
          <p className="text-sm text-gray-500">Today's matches</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-primary-400 mb-1">ROI</h3>
          <p className="text-3xl font-bold text-accent-400">+12.3%</p>
          <p className="text-sm text-gray-500">Last 30 days</p>
        </div>
      </div>
    </div>
  )
}
