import { useAuth } from '@/contexts/AuthContext'

export default function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Welcome back, {user?.name}</h2>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  )
}
