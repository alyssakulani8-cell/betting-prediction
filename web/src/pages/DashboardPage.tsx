export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
          <p className="text-gray-400">Chart will render here</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Recent Predictions</h3>
          <p className="text-gray-400">Recent prediction history table</p>
        </div>
      </div>
    </div>
  )
}
