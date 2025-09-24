import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Common/Toast';
import ErrorBoundary from './components/Common/ErrorBoundary';
import ProtectedRoute from './components/Common/ProtectedRoute';
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import AdminLoginForm from './components/Auth/AdminLoginForm';
import AdminDashboard from './components/Admin/AdminDashboard';
import ChatPage from './components/Chat/ChatPage';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <Router>
            <AuthProvider>
              <ToastProvider>
                <div className="App">
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<LoginForm />} />
                    <Route path="/register" element={<RegisterForm />} />
                    <Route path="/admin" element={<AdminLoginForm />} />

                    {/* Protected routes */}
                    <Route
                      path="/chat"
                      element={
                        <ProtectedRoute>
                          <ChatPage />

                        </ProtectedRoute>
                      }
                    />
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />

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
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
