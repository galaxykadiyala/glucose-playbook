import { useLocation, NavLink } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { useStint } from '../../context/StintContext'

const titles = {
  '/dashboard':          { title: 'Dashboard',            subtitle: 'Your weekly glucose overview' },
  '/patterns':           { title: 'Glucose Patterns',      subtitle: 'Daily trends and time-in-range analysis' },
  '/spike-causes':       { title: 'Spike Causes',          subtitle: 'What drives your glucose spikes' },
  '/what-works':         { title: 'What Works',            subtitle: 'Strategy effectiveness from your real CGM data' },
  '/strategies':         { title: 'Strategies',            subtitle: 'Evidence-based methods to improve control' },
  '/food':               { title: 'Food Intelligence',     subtitle: 'Glycemic impact of common foods' },
  '/daily-intelligence': { title: 'Daily Intelligence',   subtitle: 'Overnight analysis, daily scores, and continuous glucose insights' },
  '/fix-your-glucose':   { title: 'Fix Your Glucose',     subtitle: 'Actionable recommendations derived from your CGM data' },
}

const mobileNavItems = [
  { to: '/dashboard',          label: 'Overview' },
  { to: '/patterns',           label: 'Patterns' },
  { to: '/spike-causes',       label: 'Spikes' },
  { to: '/what-works',         label: 'What Works' },
  { to: '/strategies',         label: 'Strategies' },
  { to: '/food',               label: 'Food' },
  { to: '/daily-intelligence', label: 'CGM' },
  { to: '/fix-your-glucose',   label: 'Fix' },
  { to: '/whatsapp',           label: 'WhatsApp' },
]

function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? (
        /* Sun */
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
        </svg>
      ) : (
        /* Moon */
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}

function MonthBadge() {
  const { months, selectedMonth, setSelectedMonth } = useStint()

  if (!months.length) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400">
        No data
      </span>
    )
  }

  return (
    <select
      value={selectedMonth ?? ''}
      onChange={e => setSelectedMonth(e.target.value || null)}
      className="px-3 py-1.5 rounded-full text-xs font-medium border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 focus:outline-none cursor-pointer"
    >
      <option value="">All time</option>
      {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
    </select>
  )
}

export default function Navbar() {
  const { pathname } = useLocation()
  const meta = titles[pathname] || { title: 'Glyco', subtitle: '' }

  return (
    <>
      {/* Desktop top bar */}
      <header className="hidden md:flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{meta.title}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{meta.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthBadge />
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile header */}
      <header className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span
                className="text-white font-medium text-sm leading-none"
                style={{ letterSpacing: '-0.5px' }}
              >
                G
              </span>
            </div>
            <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">Glyco</span>
          </div>
          <div className="flex items-center gap-2">
            <MonthBadge />
            <ThemeToggle />
          </div>
        </div>
        <nav className="flex overflow-x-auto pb-0 border-t border-slate-100 dark:border-slate-700/60 scrollbar-none">
          {mobileNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-slate-400'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
    </>
  )
}
