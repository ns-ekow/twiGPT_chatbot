import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './components/Common/Toast';
import ErrorBoundary from './components/Common/ErrorBoundary';
import ProtectedRoute from './components/Common/ProtectedRoute';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import ChatPage from './components/Chat/ChatPage';

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <Router>
          <AuthProvider>
            <ToastProvider>
              <div className="App">
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<LoginForm />} />
                  <Route path="/register" element={<RegisterForm />} />

                  {/* Protected routes */}
                  <Route
                    path="/chat"
                    element={
                      <ProtectedRoute>
                        <ChatPage />

                      </ProtectedRoute>
                    }
                  />

                  {/* Redirect root to chat */}
                  <Route path="/" element={<Navigate to="/chat" replace />} />

                  {/* Catch all - redirect to chat */}
                  <Route path="*" element={<Navigate to="/chat" replace />} />
                </Routes>
              </div>
            </ToastProvider>
          </AuthProvider>
        </Router>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
