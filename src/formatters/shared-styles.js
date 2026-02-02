export const BASE_CSS = `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #f8fafc;
      background: linear-gradient(135deg, #0a0a0f 0%, #13131a 50%, #0f1419 100%);
      position: relative;
      overflow-x: hidden;
    }

    body::before {
      content: '';
      position: fixed;
      top: -40%;
      right: -20%;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, #6366f1 0%, rgba(99, 102, 241, 0) 70%);
      border-radius: 50%;
      opacity: 0.08;
      filter: blur(80px);
      pointer-events: none;
      z-index: 0;
      animation: float-orb 8s ease-in-out infinite;
    }

    body::after {
      content: '';
      position: fixed;
      bottom: -30%;
      left: -15%;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, #8b5cf6 0%, rgba(139, 92, 246, 0) 70%);
      border-radius: 50%;
      opacity: 0.06;
      filter: blur(80px);
      pointer-events: none;
      z-index: 0;
      animation: float-orb-alt 10s ease-in-out infinite;
    }

    @keyframes float-orb {
      0%, 100% { transform: translate(0, 0); }
      50% { transform: translate(40px, -40px); }
    }

    @keyframes float-orb-alt {
      0%, 100% { transform: translate(0, 0); }
      50% { transform: translate(-30px, 30px); }
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }`;
