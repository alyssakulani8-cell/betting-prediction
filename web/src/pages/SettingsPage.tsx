export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Notification Preferences</label>
          <select className="input">
            <option>All notifications</option>
            <option>Important only</option>
            <option>None</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Default League</label>
          <select className="input">
            <option>All Leagues</option>
            <option>Premier League</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Dark Mode</span>
          <div className="w-10 h-5 bg-primary-600 rounded-full relative cursor-pointer">
            <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 right-0.5" />
          </div>
        </div>
      </div>

      <button className="btn-primary">Save Settings</button>
    </div>
  )
}
