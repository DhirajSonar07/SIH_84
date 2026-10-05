import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '../store';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const isInitializing = useAuthStore(state => state.isInitializing);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberSession, setRememberSession] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const redirectTarget = new URLSearchParams(location.search).get('redirect') || '/';

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isInitializing, navigate]);

  const handleDemoFill = () => {
    setEmail('admin@novexa.demo');
    setPassword('NOVEXA2026');
    setError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProcessing(true);
    setError('');

    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      if (!trimmedEmail || !trimmedPassword) {
        throw new Error('PLEASE ENTER EMAIL AND PASSWORD');
      }

      if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
        throw new Error('PLEASE ENTER EMAIL AND PASSWORD');
      }

      await useAuthStore.getState().login(trimmedEmail, trimmedPassword);
      navigate(redirectTarget, { replace: true });
    } catch (caughtError) {
      const message = caughtError instanceof Error && caughtError.message === 'INVALID CREDENTIALS'
        ? 'INVALID CREDENTIALS'
        : 'PLEASE ENTER EMAIL AND PASSWORD';
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="auth-initializer-shell">
        <div className="auth-initializer-card">
          <span className="auth-status-badge">DEMO ENVIRONMENT</span>
          <strong>INITIALIZING SESSION...</strong>
          <p>Verifying the local operations session before connecting you to the command center.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-visual">
        <div className="login-glow" />
        <div className="login-brand-block">
          <span className="auth-status-badge">DEMO ENVIRONMENT</span>
          <div className="login-brand-mark">
            <div className="login-brand-icon">NX</div>
            <div>
              <strong>NOVEXA</strong>
              <span>NOWCAST</span>
            </div>
          </div>
          <h1>CONVECTIVE INTELLIGENCE<br />& EARLY WARNING SYSTEM</h1>
          <p>
            Monitor rapidly evolving storm cells, source agreement, and hazard risk across Maharashtra with a secure operations-only demo session.
          </p>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-panel-inner">
          <div className="login-header">
            <span className="eyebrow">OPERATIONS ACCESS</span>
            <h2>NOVEXA NOWCAST</h2>
            <p>LOGIN TO COMMAND CENTER</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="field-group">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="admin@novexa.demo"
                autoComplete="username"
              />
            </label>

            <label className="field-group">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>

            <div className="login-options">
              <label className="remember-row">
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={event => setRememberSession(event.target.checked)}
                />
                <span>Remember this session</span>
              </label>
              <button type="button" className="text-button demo-fill" onClick={handleDemoFill}>
                USE DEMO ACCOUNT
              </button>
            </div>

            {error && <div className="login-error">{error}</div>}

            <button className="login-submit" type="submit" disabled={processing}>
              {processing ? 'AUTHENTICATING...' : 'LOGIN TO COMMAND CENTER'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
