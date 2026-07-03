import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'

const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' }

vi.mock('../services/auth', () => ({
  authService: {
    getProfile: vi.fn(() => Promise.resolve(mockUser)),
    login: vi.fn(() => Promise.resolve({ user: mockUser, token: 'mock-token' })),
    register: vi.fn(() => Promise.resolve({ user: mockUser, token: 'mock-token' })),
  },
}))

function TestComponent() {
  const { user, isLoading, login, register, logout } = useAuth()
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'loading' : 'loaded'}</span>
      <span data-testid="user">{user?.name || 'no user'}</span>
      <button data-testid="login-btn" onClick={() => login('a@b.com', 'pass')}>Login</button>
      <button data-testid="register-btn" onClick={() => register('N', 'a@b.com', 'pass')}>Register</button>
      <button data-testid="logout-btn" onClick={logout}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows loading then user profile when token exists', async () => {
    localStorage.setItem('token', 'mock-token')
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    )
    expect(screen.getByTestId('loading').textContent).toBe('loading')
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Test User'))
    expect(screen.getByTestId('loading').textContent).toBe('loaded')
  })

  it('shows no user when no token', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('loaded'))
    expect(screen.getByTestId('user').textContent).toBe('no user')
  })
})
