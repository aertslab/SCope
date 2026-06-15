import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import Groups from './pages/Groups'
import Projects from './pages/Projects'
import PrivateRoute from './components/PrivateRoute'
import GroupDetails from './pages/GroupDetails'
import ProjectDetails from './pages/ProjectDetails'
import SessionLoader from './pages/SessionLoader'
import MyDatasets from './pages/MyDatasets'
import Profile from './pages/Profile'

// Heavy pages that pull in three.js, react-mosaic and the viewer chain are
// loaded on-demand so the dashboard / auth shell stays small.
const Viewer = lazy(() => import('./pages/Viewer'))
const PublicProjects = lazy(() => import('./pages/PublicProjects'))
const MySessions = lazy(() => import('./pages/MySessions'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const Invitations = lazy(() => import('./pages/Invitations'))
const ApiTokens = lazy(() => import('./pages/ApiTokens'))
const Trash = lazy(() => import('./pages/Trash'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminGroups = lazy(() => import('./pages/admin/AdminGroups'))
const AdminProjects = lazy(() => import('./pages/admin/AdminProjects'))
const AdminSystem = lazy(() => import('./pages/admin/AdminSystem'))
const AdminSessions = lazy(() => import('./pages/admin/AdminSessions'))
const AdminFiles = lazy(() => import('./pages/admin/AdminFiles'))
const AdminDatasets = lazy(() => import('./pages/admin/AdminDatasets'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-gray-400">
      Loading…
    </div>
  )
}

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="auth/callback" element={<AuthCallback />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password" element={<ResetPassword />} />
              <Route path="verify-email" element={<VerifyEmail />} />
              <Route path="s/:sessionId" element={<SessionLoader />} />
              <Route path="viewer" element={<Viewer />} />
              <Route path="viewer/:datasetId" element={<Viewer />} />
              <Route path="public" element={<PublicProjects />} />

              <Route element={<PrivateRoute />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="profile" element={<Profile />} />
                <Route path="my-datasets" element={<MyDatasets />} />
                <Route path="my-sessions" element={<MySessions />} />
                <Route path="invitations" element={<Invitations />} />
                <Route path="tokens" element={<ApiTokens />} />
                <Route path="trash" element={<Trash />} />
                <Route path="groups" element={<Groups />} />
                <Route path="groups/:id" element={<GroupDetails />} />
                <Route path="projects" element={<Projects />} />
                <Route path="projects/:id" element={<ProjectDetails />} />
              </Route>

              <Route element={<PrivateRoute adminOnly />}>
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="system" element={<AdminSystem />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="groups" element={<AdminGroups />} />
                  <Route path="projects" element={<AdminProjects />} />
                  <Route path="datasets" element={<AdminDatasets />} />
                  <Route path="sessions" element={<AdminSessions />} />
                  <Route path="files" element={<AdminFiles />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Router>
  )
}

export default App
