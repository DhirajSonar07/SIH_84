import { Component, type ReactNode } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './app/routes';
class RecoveryBoundary extends Component<{ children:ReactNode }, { failed:boolean }> {
  state = { failed:false };
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <div className="recovery-screen"><h1>NOVEXA / RECOVERY</h1><p>The display encountered an error. Restore the local scenario without a backend.</p><button onClick={() => window.location.assign('/')}>Restore Command Center</button></div> : this.props.children; }
}
export default function App() { return <RecoveryBoundary><RouterProvider router={router}/></RecoveryBoundary>; }
