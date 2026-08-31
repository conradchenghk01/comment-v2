import { createRoot } from 'react-dom/client';
import './styles.css';

function Console() {
  return <main><header><strong>Comment Console</strong><span>Logto sign-in is enabled outside local.</span></header><section><h1>Operations</h1><p>Select an application after sign-in to review comments, manage blocks, and configure settings.</p><button type="button">Sign in with Logto</button></section></main>;
}

createRoot(document.getElementById('root')!).render(<Console />);