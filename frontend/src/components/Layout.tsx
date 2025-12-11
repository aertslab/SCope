import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Folder, Users, Shield, LogOut, User as UserIcon, Menu, X } from 'lucide-react'
import { Button } from './ui/Button'

export default function Layout() {
  const { isAuthenticated, user, logout, fetchUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchUser()
    }
  }, [isAuthenticated, user, fetchUser])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isViewer = location.pathname.startsWith('/viewer')

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, current: location.pathname === '/dashboard' },
    { name: 'Projects', href: '/projects', icon: Folder, current: location.pathname.startsWith('/projects') },
    { name: 'Groups', href: '/groups', icon: Users, current: location.pathname.startsWith('/groups') },
  ]

  if (user?.is_superuser) {
    navigation.push({ name: 'Admin', href: '/admin', icon: Shield, current: location.pathname.startsWith('/admin') })
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isViewer ? 'bg-black' : 'bg-gray-50'}`}>
      <header className="bg-white border-b border-gray-200 z-50 relative flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex-shrink-0 flex items-center gap-2">
                <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">S</span>
                </div>
                <span className="font-bold text-xl text-gray-900 tracking-tight">SCope v2</span>
              </Link>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                {isAuthenticated && navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                      item.current
                        ? 'border-indigo-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  <Link to="/profile" className="hidden md:flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors">
                    <UserIcon className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">{user?.full_name || user?.email}</span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    leftIcon={<LogOut className="w-4 h-4" />}
                  >
                    Logout
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                    <Link to="/login">
                        <Button variant="ghost" size="sm">Login</Button>
                    </Link>
                    <Link to="/register">
                        <Button variant="primary" size="sm">Register</Button>
                    </Link>
                </div>
              )}
              <div className="-mr-2 flex items-center sm:hidden">
                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                  >
                      {isMobileMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
                  </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile menu */}
        {isMobileMenuOpen && (
            <div className="sm:hidden border-t border-gray-200">
                <div className="pt-2 pb-3 space-y-1">
                    {isAuthenticated && navigation.map((item) => (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                                item.current
                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                                    : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                            }`}
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <div className="flex items-center">
                                <item.icon className="w-5 h-5 mr-3" />
                                {item.name}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        )}
      </header>
      <main className={`flex-1 flex flex-col ${isViewer ? 'overflow-hidden' : 'overflow-auto'}`}>
        {isViewer ? (
            <Outlet />
        ) : (
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 w-full">
                <Outlet />
            </div>
        )}
      </main>
    </div>
  )
}
