import { Component, type ReactNode, useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './app/routes';
import { useAuthStore } from './store';

class RecoveryBoundary extends Component<{ children:ReactNode }, { failed:boolean }> {
  state = { failed:false };
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <div className="recovery-screen"><h1>NOVEXA / RECOVERY</h1><p>The display encountered an error. Restore the local scenario without a backend.</p><button onClick={() => window.location.assign('/')}>Restore Command Center</button></div> : this.props.children; }
}

function AuthBootstrap() {
  const initializeAuth = useAuthStore(state => state.initializeAuth);
  const isInitializing = useAuthStore(state => state.isInitializing);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  if (isInitializing) {
    return (
      <div className="auth-initializer-shell">
        <div className="auth-initializer-card">
          <span className="auth-status-badge">DEMO ENVIRONMENT</span>
          <strong>INITIALIZING SESSION...</strong>
          <p>Validating local demo credentials and restoring operator access.</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function App() {
  return (
    <RecoveryBoundary>
      <AuthBootstrap />
      <RouterProvider router={router} />
    </RecoveryBoundary>
  );
}
