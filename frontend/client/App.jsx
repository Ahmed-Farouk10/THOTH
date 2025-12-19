import "./global.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";

import Header from "./components/Header";
import Footer from "./components/Footer";
import IntroSequence from "./components/IntroSequence";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import OraclePage from "./pages/OraclePage";
import TTSPage from "./pages/TTSPage";
import STTPage from "./pages/STTPage";
import DocumentsPage from "./pages/DocumentsPage";
import QuizPage from "./pages/QuizPage";
import TempleDashboard from "./pages/TempleDashboard";

function AppContent() {
  const [showIntro, setShowIntro] = useState(true);

  if (showIntro) {
    return <IntroSequence onComplete={() => setShowIntro(false)} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-thoth-navy">
      <Header />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/oracle" element={<OraclePage />} />
          <Route path="/tts" element={<TTSPage />} />
          <Route path="/stt" element={<STTPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/temple" element={<TempleDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function RootApp() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<RootApp />);
}

