import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  useEffect(() => {
    // Smooth scroll offset for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (this: HTMLAnchorElement, e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if(href) {
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // Add scroll animation for feature cards
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                (entry.target as HTMLElement).style.opacity = '1';
                (entry.target as HTMLElement).style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card, .mode-card, .tech-item, .pricing-card').forEach(el => {
        (el as HTMLElement).style.opacity = '0';
        (el as HTMLElement).style.transform = 'translateY(30px)';
        (el as HTMLElement).style.transition = 'all 0.6s ease';
        observer.observe(el);
    });
  }, []);

  return (
    <div className="landing-page">
      <header className="landing-header">
          <nav className="container">
              <div className="logo">AuraScribe</div>
              <ul className="nav-links">
                  <li><a href="#features">Features</a></li>
                  <li><a href="#modes">Modes</a></li>
                  <li><a href="#tech">Tech Stack</a></li>
                  <li><a href="#download">Download</a></li>
                  <li><a href="#contact">Contact</a></li>
                  <li><a href="https://github.com/adityanshinde/Parakeet-AI-Clone" target="_blank" rel="noreferrer">GitHub</a></li>
                  <li><button className="cta-button" onClick={() => document.getElementById('download')?.scrollIntoView({behavior: 'smooth'})}>Get Started</button></li>
              </ul>
          </nav>
      </header>

      <section className="hero">
          <h1>Your Invisible <span className="gradient-text">Interview Ally</span></h1>
          <p>Ace technical interviews with real-time AI assistance. Voice-guided answers, stealth mode, and personalized prep—all in one transparent overlay.</p>
          <div className="hero-buttons">
              <button className="btn btn-primary" onClick={() => document.getElementById('download')?.scrollIntoView({behavior: 'smooth'})}>
                  Download Now
              </button>
              <button className="btn btn-secondary" onClick={() => document.getElementById('features')?.scrollIntoView({behavior: 'smooth'})}>
                  See Features
              </button>
          </div>
      </section>

      <section className="features" id="features">
          <div className="container">
              <h2 className="section-title">Powerful <span className="highlight">Features</span></h2>
              <div className="features-grid">
                  <div className="feature-card">
                      <div className="feature-icon">🎙️</div>
                      <h3>Voice Mode</h3>
                      <p>Real-time transcription with Groq's ultra-fast Whisper. Smart question detection and instant STAR-method talking points.</p>
                  </div>
                  <div className="feature-card">
                      <div className="feature-icon">💬</div>
                      <h3>Chat Mode</h3>
                      <p>Type any question and get deeply structured answers with prose, key points, and complete working code.</p>
                  </div>
                  <div className="feature-card">
                      <div className="feature-icon">🕵️</div>
                      <h3>Stealth Mode</h3>
                      <p>Invisible on screen share. Click-through enabled. Keyboard shortcuts for hands-free operation.</p>
                  </div>
                  <div className="feature-card">
                      <div className="feature-icon">🧠</div>
                      <h3>Personalized</h3>
                      <p>Upload your resume and job description. Get answers tailored to your specific stack and role.</p>
                  </div>
                  <div className="feature-card">
                      <div className="feature-icon">⚡</div>
                      <h3>Lightning Fast</h3>
                      <p>~100ms question classification. 2-3s structured answers. Self-verifying hard questions.</p>
                  </div>
                  <div className="feature-card">
                      <div className="feature-icon">🔒</div>
                      <h3>Private & Secure</h3>
                      <p>API keys stored locally. No audio logging. Resume/JD never persisted. Full content protection.</p>
                  </div>
              </div>
          </div>
      </section>

      <section className="modes" id="modes">
          <div className="modes-container">
              <h2 className="section-title">Two Powerful <span className="highlight">Modes</span></h2>

              <div className="mode-card">
                  <div className="mode-header">
                      <div className="mode-icon">🎤</div>
                      <div>
                          <h3>Voice Mode</h3>
                          <p style={{color: 'var(--text-secondary)', margin: 0, fontSize: '1rem'}}>Real-time interview assistance</p>
                      </div>
                  </div>
                  <div className="mode-features">
                      <div className="mode-feature">
                          <h4>Ultra-Fast Transcription</h4>
                          <p>Groq Whisper-large-v3-turbo with near-zero latency</p>
                      </div>
                      <div className="mode-feature">
                          <h4>Smart Question Detection</h4>
                          <p>Automatically identifies interview questions from system audio</p>
                      </div>
                      <div className="mode-feature">
                          <h4>STAR-Method Bullets</h4>
                          <p>Situation → Action → Result formatted talking points</p>
                      </div>
                      <div className="mode-feature">
                          <h4>Big-O Complexity</h4>
                          <p>Technical bullets with algorithm complexity notation</p>
                      </div>
                      <div className="mode-feature">
                          <h4>Spoken Response</h4>
                          <p>Confident 1–2 sentence verbal answer you can say immediately</p>
                      </div>
                      <div className="mode-feature">
                          <h4>Hallucination Filter</h4>
                          <p>30+ common Whisper false transcriptions auto-removed</p>
                      </div>
                  </div>
              </div>

              <div className="mode-card">
                  <div className="mode-header">
                      <div className="mode-icon">💬</div>
                      <div>
                          <h3>Chat Mode</h3>
                          <p style={{color: 'var(--text-secondary)', margin: 0, fontSize: '1rem'}}>Deep learning & interview prep</p>
                      </div>
                  </div>
                  <div className="mode-features">
                      <div className="mode-feature">
                          <h4>Difficulty Classification</h4>
                          <p>Auto-routes questions to optimal prompt style</p>
                      </div>
                      <div className="mode-feature">
                          <h4>Structured Answers</h4>
                          <p>Multi-section responses with titled cards, not walls of text</p>
                      </div>
                      <div className="mode-feature">
                          <h4>Complete Code Blocks</h4>
                          <p>Syntax-highlighted with language labels and copy buttons</p>
                      </div>
                      <div className="mode-feature">
                          <h4>Self-Verification</h4>
                          <p>Second LLM checks hard questions for errors & edge cases</p>
                      </div>
                      <div className="mode-feature">
                          <h4>Key Takeaways</h4>
                          <p>2–4 crisp one-liners per section for quick scanning</p>
                      </div>
                      <div className="mode-feature">
                          <h4>Meeting Personas</h4>
                          <p>Technical, Executive, or Translator modes</p>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      <section className="tech-stack" id="tech">
          <div className="container">
              <h2 className="section-title">Built with Modern <span className="highlight">Tech</span></h2>
              <div className="tech-grid">
                  <div className="tech-item">
                      <h4>Frontend</h4>
                      <p>React 19, Tailwind CSS v4, Motion, Lucide Icons</p>
                  </div>
                  <div className="tech-item">
                      <h4>Backend</h4>
                      <p>Node.js, Express 4, TypeScript</p>
                  </div>
                  <div className="tech-item">
                      <h4>Desktop</h4>
                      <p>Electron 41 with content protection</p>
                  </div>
                  <div className="tech-item">
                      <h4>AI — Speech</h4>
                      <p>Groq Whisper-large-v3-turbo</p>
                  </div>
                  <div className="tech-item">
                      <h4>AI — Chat</h4>
                      <p>Llama-3.3-70b-versatile & 3.1-8b-instant</p>
                  </div>
                  <div className="tech-item">
                      <h4>Audio Capture</h4>
                      <p>Web Audio API + WebRTC getDisplayMedia</p>
                  </div>
                  <div className="tech-item">
                      <h4>Voice Synthesis</h4>
                      <p>Google GenAI Text-to-Speech</p>
                  </div>
                  <div className="tech-item">
                      <h4>Dev Tools</h4>
                      <p>Vite 6, TypeScript, tsx watch</p>
                  </div>
              </div>
          </div>
      </section>

      <section className="pricing">
          <div className="container">
              <h2 className="section-title">Simple <span className="highlight">Pricing</span></h2>
              <div className="pricing-cards">
                  <div className="pricing-card">
                      <div className="pricing-badge">FREE</div>
                      <h3>Community</h3>
                      <div className="price">$0<span style={{fontSize: '1rem', color: 'var(--text-secondary)'}}>/month</span></div>
                      <p className="price-label">Perfect for getting started</p>
                      <ul className="pricing-features">
                          <li>Voice & Chat modes</li>
                          <li>Free Groq API access</li>
                          <li>Desktop app (Windows)</li>
                          <li>Basic stealth mode</li>
                          <li>Community support</li>
                      </ul>
                      <button className="btn btn-secondary" style={{width: '100%'}}>Get Started</button>
                  </div>
                  <div className="pricing-card featured">
                      <div className="pricing-badge" style={{background: 'var(--accent-blue)'}}>RECOMMENDED</div>
                      <h3>Professional</h3>
                      <div className="price">$9.99<span style={{fontSize: '1rem', color: 'var(--text-secondary)'}}>/month</span></div>
                      <p className="price-label">For serious interview prep</p>
                      <ul className="pricing-features">
                          <li>Everything in Community</li>
                          <li>Priority Groq API quota</li>
                          <li>Advanced personas</li>
                          <li>Session history export</li>
                          <li>Resume/JD optimization</li>
                          <li>Priority support</li>
                      </ul>
                      <button className="btn btn-primary" style={{width: '100%'}}>Upgrade Now</button>
                  </div>
                  <div className="pricing-card">
                      <div className="pricing-badge">TEAM</div>
                      <h3>Enterprise</h3>
                      <div className="price">Custom</div>
                      <p className="price-label">For organizations</p>
                      <ul className="pricing-features">
                          <li>All Professional features</li>
                          <li>Custom API integration</li>
                          <li>Dedicated support</li>
                          <li>Team management</li>
                          <li>Admin dashboard</li>
                          <li>SLA guarantee</li>
                      </ul>
                      <button className="btn btn-secondary" style={{width: '100%'}}>Contact Sales</button>
                  </div>
              </div>
          </div>
      </section>

      <section className="download" id="download">
          <div className="download-content">
              <h2 className="section-title">Ready to <span className="highlight">Excel?</span></h2>
              <p style={{color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '2rem'}}>Choose your platform and start acing interviews today</p>

              <div className="download-buttons">
                  <div className="download-card">
                      <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🌐</div>
                      <h3>Web Version</h3>
                      <p>Use AuraScribe directly in your browser. Perfect for Google Meet and web-based interviews.</p>
                      <Link to="/app" className="btn btn-primary">Launch Web App</Link>
                  </div>
                  <div className="download-card">
                      <div style={{fontSize: '3rem', marginBottom: '1rem'}}>💻</div>
                      <h3>Windows Desktop</h3>
                      <p>Standalone .exe for maximum power. Captures system audio from Zoom, Teams, and all apps.</p>
                      {/* Will link to Github releases or local dist */}
                      <a href="https://github.com/adityanshinde/Parakeet-AI-Clone/releases/latest/download/AuraScribe-Setup.exe" className="btn btn-primary">Download .exe</a>
                  </div>
                  <div className="download-card">
                      <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🚀</div>
                      <h3>Self-Hosted</h3>
                      <p>Deploy on your own servers. Full control, privacy, and customization options.</p>
                      <a href="https://github.com/adityanshinde/Parakeet-AI-Clone" className="btn btn-secondary" target="_blank" rel="noreferrer">View on GitHub</a>
                  </div>
              </div>
          </div>
      </section>

      <footer id="contact">
          <div className="footer-content">
              <div className="footer-column">
                  <h4>Product</h4>
                  <ul>
                      <li><a href="#features">Features</a></li>
                      <li><a href="#modes">Modes</a></li>
                      <li><a href="#tech">Tech Stack</a></li>
                      <li><a href="#download">Download</a></li>
                  </ul>
              </div>
              <div className="footer-column">
                  <h4>Resources</h4>
                  <ul>
                      <li><Link to="/docs">Documentation</Link></li>
                      <li><Link to="/api-reference">API Reference</Link></li>
                      <li><Link to="/blog">Blog</Link></li>
                      <li><Link to="/faq">FAQ</Link></li>
                  </ul>
              </div>
              <div className="footer-column">
                  <h4>Community</h4>
                  <ul>
                      <li><a href="https://github.com/adityanshinde/Parakeet-AI-Clone" target="_blank" rel="noreferrer">GitHub</a></li>
                      <li><a href="https://discord.gg/yourserver" target="_blank" rel="noreferrer">Discord</a></li>
                      <li><a href="https://twitter.com/aurascribe" target="_blank" rel="noreferrer">Twitter/X</a></li>
                      <li><a href="https://linkedin.com/company/aurascribe" target="_blank" rel="noreferrer">LinkedIn</a></li>
                  </ul>
              </div>
              <div className="footer-column">
                  <h4>Legal</h4>
                  <ul>
                      <li><Link to="/privacy">Privacy Policy</Link></li>
                      <li><Link to="/terms">Terms of Service</Link></li>
                      <li><Link to="/security">Security</Link></li>
                      <li><Link to="/contact">Contact</Link></li>
                  </ul>
              </div>
          </div>
          <div className="footer-bottom">
              <p>&copy; 2024-2026 AuraScribe. Built with precision for engineers. All rights reserved.</p>
          </div>
      </footer>
    </div>
  );
}
