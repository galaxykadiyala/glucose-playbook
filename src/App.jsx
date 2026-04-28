import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Patterns from './pages/Patterns'
import SpikeCauses from './pages/SpikeCauses'
import WhatWorks from './pages/WhatWorks'
import Strategies from './pages/Strategies'
import FoodIntelligence from './pages/FoodIntelligence'
import DailyIntelligence from './pages/DailyIntelligence'
import FixYourGlucose from './pages/FixYourGlucose'
import Upload from './pages/Upload'
import Login from './pages/Login'
import Signup from './pages/Signup'
import { useUser } from './context/UserContext'

function RequireAuth({ children }) {
  const { user, loading } = useUser()
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"  element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Layout>
              <Routes>
                <Route path="/"                  element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"         element={<Dashboard />} />
                <Route path="/patterns"          element={<Patterns />} />
                <Route path="/spike-causes"      element={<SpikeCauses />} />
                <Route path="/what-works"        element={<WhatWorks />} />
                <Route path="/strategies"        element={<Strategies />} />
                <Route path="/food"              element={<FoodIntelligence />} />
                <Route path="/daily-intelligence" element={<DailyIntelligence />} />
                <Route path="/fix-your-glucose"  element={<FixYourGlucose />} />
                <Route path="/upload"            element={<Upload />} />
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  )
}
