import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          containerStyle={{
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)'
          }}
          toastOptions={{
            duration: 4500,
            style: {
              fontSize: '0.95rem',
              maxWidth: 'min(420px, calc(100vw - 24px))'
            },
            success: {
              duration: 3500,
              iconTheme: { primary: '#0d5c3d', secondary: '#fff' }
            },
            error: {
              duration: 5500,
              iconTheme: { primary: '#b00020', secondary: '#fff' }
            }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
