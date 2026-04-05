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

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/patterns" element={<Patterns />} />
        <Route path="/spike-causes" element={<SpikeCauses />} />
        <Route path="/what-works" element={<WhatWorks />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/food" element={<FoodIntelligence />} />
        <Route path="/daily-intelligence" element={<DailyIntelligence />} />
        <Route path="/fix-your-glucose" element={<FixYourGlucose />} />
      </Routes>
    </Layout>
  )
}
