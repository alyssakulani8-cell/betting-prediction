import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { authService } from '@/services/auth'

const NOTIFICATION_LEVELS = [
  { value: 'all', label: 'All notifications' },
  { value: 'important', label: 'Important only' },
  { value: 'none', label: 'None' },
]

const LEAGUES = [
  { value: '', label: 'All Leagues' },
  { value: 'pl', label: 'Premier League' },
  { value: 'pd', label: 'La Liga' },
  { value: 'sa', label: 'Serie A' },
  { value: 'bl', label: 'Bundesliga' },
  { value: 'fl', label: 'Ligue 1' },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const [notificationLevel, setNotificationLevel] = useState('all')
  const [defaultLeague, setDefaultLeague] = useState('')
  const [theme, setTheme] = useState('dark')
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setName(user.name)
      authService.getProfile().then((data) => {
        if (data.preferences) {
          setNotificationLevel(data.preferences.notificationLevel ?? 'all')
          setDefaultLeague(data.preferences.defaultLeague ?? '')
          setTheme(data.preferences.theme ?? 'dark')
        }
      }).catch(() => {})
    }
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await authService.updateProfile({ name, notificationLevel, defaultLeague, theme })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="card space-y-4">
        <h3 className="text-lg font-semibold mb-2">Profile</h3>
        <div>
          <label className="block text-sm font-medium mb-1">Display Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <p className="text-xs text-gray-500">{user?.email}</p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Notification Preferences</label>
          <select className="input" value={notificationLevel} onChange={(e) => setNotificationLevel(e.target.value)}>
            {NOTIFICATION_LEVELS.map((n) => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Default League</label>
          <select className="input" value={defaultLeague} onChange={(e) => setDefaultLeague(e.target.value)}>
            {LEAGUES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Dark Mode</span>
          <button
            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${theme === 'dark' ? 'bg-primary-600' : 'bg-gray-600'}`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${theme === 'dark' ? 'right-0.5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-accent-400 text-sm">Settings saved!</span>}
      </div>
    </div>
  )
}
