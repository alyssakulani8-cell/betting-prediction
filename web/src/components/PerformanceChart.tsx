import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const data = [
  { day: 'Mon', accuracy: 72, bets: 5 },
  { day: 'Tue', accuracy: 78, bets: 8 },
  { day: 'Wed', accuracy: 75, bets: 6 },
  { day: 'Thu', accuracy: 81, bets: 7 },
  { day: 'Fri', accuracy: 79, bets: 10 },
  { day: 'Sat', accuracy: 85, bets: 14 },
  { day: 'Sun', accuracy: 82, bets: 12 },
]

export default function PerformanceChart() {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 12 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
        />
        <Line yAxisId="left" type="monotone" dataKey="accuracy" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb' }} name="Accuracy %" />
        <Line yAxisId="right" type="monotone" dataKey="bets" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed' }} name="Bets" />
      </LineChart>
    </ResponsiveContainer>
  )
}
