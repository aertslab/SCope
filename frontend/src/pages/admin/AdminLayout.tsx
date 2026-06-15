import { Outlet, Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Users,
    Folder,
    Users as GroupsIcon,
    Database,
    Activity,
    Link as LinkIcon,
    HardDrive,
} from 'lucide-react'

export default function AdminLayout() {
    const location = useLocation()

    const navigation = [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'System', href: '/admin/system', icon: Activity },
        { name: 'Users', href: '/admin/users', icon: Users },
        { name: 'Groups', href: '/admin/groups', icon: GroupsIcon },
        { name: 'Projects', href: '/admin/projects', icon: Folder },
        { name: 'Datasets', href: '/admin/datasets', icon: Database },
        { name: 'Sessions', href: '/admin/sessions', icon: LinkIcon },
        { name: 'Files', href: '/admin/files', icon: HardDrive },
    ]

    return (
        <div className="flex h-full min-h-screen bg-gray-100">
            {/* Sidebar */}
            <div className="w-64 bg-white shadow-md z-10">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-800">Admin Panel</h2>
                </div>
                <nav className="mt-6 px-4 space-y-2">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href || (item.href !== '/admin' && location.pathname.startsWith(item.href))
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                                    isActive
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                            >
                                <item.icon className="mr-3 h-5 w-5" />
                                {item.name}
                            </Link>
                        )
                    })}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-8">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}
