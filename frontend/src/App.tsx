import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import Viewer from './pages/Viewer'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminGroups from './pages/admin/AdminGroups'
import AdminProjects from './pages/admin/AdminProjects'
import Groups from './pages/Groups'
import Projects from './pages/Projects'
import PrivateRoute from './components/PrivateRoute'
import GroupDetails from './pages/GroupDetails'
import ProjectDetails from './pages/ProjectDetails'
import SessionLoader from './pages/SessionLoader'
import MyDatasets from './pages/MyDatasets'
import Profile from './pages/Profile'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="auth/callback" element={<AuthCallback />} />
          <Route path="s/:sessionId" element={<SessionLoader />} />
          <Route path="viewer" element={<Viewer />} />
          <Route path="viewer/:datasetId" element={<Viewer />} />
          
          <Route element={<PrivateRoute />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="my-datasets" element={<MyDatasets />} />
            <Route path="groups" element={<Groups />} />
            <Route path="groups/:id" element={<GroupDetails />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
          </Route>

          <Route element={<PrivateRoute adminOnly />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="groups" element={<AdminGroups />} />
              <Route path="projects" element={<AdminProjects />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Router>
  )
}

export default App
