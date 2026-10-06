import { Routes, Route, Link, Navigate } from 'react-router-dom'
import { AppProvider } from './components/AppContext.jsx'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Dataset from './pages/Dataset.jsx'
import Comparison from './pages/Comparison.jsx'
import Annotation from './pages/Annotation.jsx'
import Benchmark from './pages/Benchmark.jsx'
import Results from './pages/Results.jsx'
import Methodology from './pages/Methodology.jsx'
import Reproducibility from './pages/Reproducibility.jsx'
import About from './pages/About.jsx'

const NotFound = () => (
  <div className="py-20 text-center">
    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Page not found</h1>
    <p className="mt-2 text-sm text-slate-500">The requested benchmark route does not exist.</p>
    <Link
      to="/"
      className="mt-4 inline-block font-medium text-teal-700 underline dark:text-teal-400"
    >
      Return to Research Dashboard
    </Link>
  </div>
)

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="dataset" element={<Dataset />} />
          <Route path="comparison" element={<Comparison />} />
          <Route path="workspace" element={<Navigate to="/comparison" replace />} />
          <Route path="annotation" element={<Annotation />} />
          <Route path="benchmark" element={<Benchmark />} />
          <Route path="results" element={<Results />} />
          <Route path="methodology" element={<Methodology />} />
          <Route path="reproducibility" element={<Reproducibility />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AppProvider>
  )
}
