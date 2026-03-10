@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:ital,wght@0,400;0,500;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-display: 'Syne', sans-serif;
  --font-sans: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  background: #050508;
  color: #e8e8ff;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2a2a45; border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: #4a4a7a; }

/* Selection */
::selection { background: rgba(77,158,255,0.25); color: #e8e8ff; }

/* Focus */
:focus-visible { outline: 1px solid rgba(77,158,255,0.6); outline-offset: 2px; }

/* Noise overlay texture */
.noise-overlay::after {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 9999;
  opacity: 0.35;
}

/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, #4d9eff 0%, #8b5cf6 50%, #ff4d6d 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.gradient-text-azure {
  background: linear-gradient(135deg, #4d9eff, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Glow effects */
.glow-azure { box-shadow: 0 0 30px rgba(77,158,255,0.2), 0 0 60px rgba(77,158,255,0.05); }
.glow-violet { box-shadow: 0 0 30px rgba(139,92,246,0.2), 0 0 60px rgba(139,92,246,0.05); }

/* Glass card */
.glass {
  background: rgba(20, 20, 34, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.06);
}

/* Animated gradient border */
@keyframes borderRotate {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.gradient-border {
  position: relative;
  border-radius: 12px;
}
.gradient-border::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 13px;
  background: linear-gradient(135deg, #4d9eff, #8b5cf6, #ff4d6d, #4d9eff);
  background-size: 300% 300%;
  animation: borderRotate 4s ease infinite;
  z-index: -1;
  opacity: 0.7;
}

/* Code blocks */
pre, code {
  font-family: var(--font-mono);
}

/* Diff colors */
.diff-add { background: rgba(16, 217, 142, 0.08); color: #10d98e; }
.diff-remove { background: rgba(255, 77, 109, 0.08); color: #ff4d6d; }
.diff-context { color: #4a4a7a; }

/* Toast animation */
@keyframes toastIn {
  from { transform: translateX(110%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes toastOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(110%); opacity: 0; }
}

.toast-enter { animation: toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-exit { animation: toastOut 0.2s ease-in forwards; }

/* Shimmer loading */
.shimmer {
  background: linear-gradient(90deg, #141422 0%, #1e1e32 50%, #141422 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
