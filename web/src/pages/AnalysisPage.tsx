export default function AnalysisPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Deep Analysis</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Team Form Analysis</h3>
          <p className="text-gray-400">Form charts and statistical analysis</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
          <p className="text-gray-400">Head-to-head, xG, possession stats</p>
        </div>
      </div>
    </div>
  )
}
