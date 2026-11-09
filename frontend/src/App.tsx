import { Navigate, Route, Routes } from "react-router"
import { CandidatesPage } from "./pages/CandidatesPage"
import { JobDetailPage } from "./pages/JobDetailPage"
import { JobNewPage } from "./pages/JobNewPage"
import { JobsPage } from "./pages/JobsPage"
import { NewCandidatePage } from "./pages/NewCandidatePage"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/candidates" replace />} />
      <Route path="/candidates" element={<CandidatesPage />} />
      <Route path="/candidates/new" element={<NewCandidatePage />} />
      <Route path="/jobs" element={<JobsPage />} />
      <Route path="/jobs/new" element={<JobNewPage />} />
      <Route path="/jobs/:jobId" element={<JobDetailPage />} />
    </Routes>
  )
}
