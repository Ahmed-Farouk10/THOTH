import "./global.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";

import { AuthProvider } from "./contexts/AuthContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/Header";
import Footer from "./components/Footer";
import IntroSequence from "./components/IntroSequence";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import OraclePage from "./pages/OraclePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <main style={{ flexGrow: 1 }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/oracle" element={<OraclePage />} />
          <Route path="/tts" element={<TTSPage />} />
          <Route path="/stt" element={<STTPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/temple" element={<TempleDashboard />} />

          {/* Protected Routes - Require Authentication */}
          <Route element={<ProtectedRoute />}>
            <Route path="/documents" element={<DocumentsPage />} />
          </Route>

          {/* 404 */}
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
      <AuthProvider>
        <WebSocketProvider>
          <AppContent />
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(<RootApp />);
