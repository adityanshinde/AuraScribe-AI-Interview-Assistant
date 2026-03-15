import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const PageLayout = ({ children, title }: { children: React.ReactNode, title: string }) => {
  useEffect(() => {
    // Scroll to top when page changes
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="landing-page" style={{ display: 'flex', flexDirection: 'column' }}>
      <header className="landing-header">
          <nav className="container">
              <Link to="/" className="logo" style={{textDecoration: 'none'}}>AuraScribe</Link>
              <ul className="nav-links">
                  <li><Link to="/#features">Features</Link></li>
                  <li><Link to="/#modes">Modes</Link></li>
                  <li><Link to="/#tech">Tech Stack</Link></li>
                  <li><Link to="/#download">Download</Link></li>
                  <li><Link to="/contact">Contact</Link></li>
                  <li><a href="https://github.com/adityanshinde/Parakeet-AI-Clone" target="_blank" rel="noreferrer">GitHub</a></li>
                  <li><Link to="/app" className="cta-button" style={{textDecoration: 'none'}}>Launch App</Link></li>
              </ul>
          </nav>
      </header>

      <main style={{ flex: '1 0 auto', marginTop: '120px', marginBottom: '80px', minHeight: '60vh' }} className="container">
          <div className="glass-panel" style={{ 
              background: 'rgba(26, 32, 64, 0.6)', 
              border: '1px solid rgba(0, 255, 136, 0.2)', 
              borderRadius: '15px', 
              padding: '4rem', 
              maxWidth: '900px', 
              margin: '0 auto',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '3.5rem', marginBottom: '2.5rem', color: 'var(--primary)', letterSpacing: '-1.5px', lineHeight: '1.2' }}>{title}</h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: '1.9' }} className="markdown-content">
              {children}
            </div>
          </div>
      </main>

      <footer id="contact" style={{ flexShrink: 0, background: 'rgba(5, 8, 16, 0.9)' }}>
          <div className="footer-content container" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', padding: '3rem 2rem', textAlign: 'left' }}>
              <div className="footer-column">
                  <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', fontWeight: 600 }}>Product</h4>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                      <li><Link to="/#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Features</Link></li>
                      <li><Link to="/#modes" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Modes</Link></li>
                      <li><Link to="/#tech" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Tech Stack</Link></li>
                      <li><Link to="/#download" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Download</Link></li>
                  </ul>
              </div>
              <div className="footer-column">
                  <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', fontWeight: 600 }}>Resources</h4>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                      <li><Link to="/docs" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Documentation</Link></li>
                      <li><Link to="/api-reference" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>API Reference</Link></li>
                      <li><Link to="/blog" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Blog</Link></li>
                      <li><Link to="/faq" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>FAQ</Link></li>
                  </ul>
              </div>
              <div className="footer-column">
                  <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', fontWeight: 600 }}>Community</h4>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                      <li><a href="https://github.com/adityanshinde/Parakeet-AI-Clone" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>GitHub</a></li>
                      <li><a href="https://discord.gg/yourserver" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Discord</a></li>
                      <li><a href="https://twitter.com/aurascribe" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Twitter/X</a></li>
                      <li><a href="https://linkedin.com/company/aurascribe" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>LinkedIn</a></li>
                  </ul>
              </div>
              <div className="footer-column">
                  <h4 style={{ color: 'var(--primary)', marginBottom: '1rem', fontWeight: 600 }}>Legal</h4>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                      <li><Link to="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Privacy Policy</Link></li>
                      <li><Link to="/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Terms of Service</Link></li>
                      <li><Link to="/security" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Security</Link></li>
                      <li><Link to="/contact" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' }}>Contact</Link></li>
                  </ul>
              </div>
          </div>
          <div className="footer-bottom" style={{ borderTop: '1px solid rgba(0, 255, 136, 0.1)', paddingTop: '2rem', paddingBottom: '2rem', textAlign: 'center' }}>
              <p>&copy; 2024-2026 AuraScribe. Built with precision for engineers. All rights reserved.</p>
          </div>
      </footer>
      
      {/* Dynamic styles specifically for markdown content rendered in pages */}
      <style>{`
        .markdown-content h2 { color: #fff; margin-top: 2rem; margin-bottom: 1rem; font-size: 1.8rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; }
        .markdown-content h3 { color: #e2e8f0; margin-top: 1.5rem; margin-bottom: 0.75rem; font-size: 1.4rem; }
        .markdown-content p { margin-bottom: 1.25rem; }
        .markdown-content ul { padding-left: 1.5rem; margin-bottom: 1.5rem; }
        .markdown-content li { margin-bottom: 0.5rem; }
        .markdown-content strong { color: var(--primary); }
        .markdown-content a { color: var(--accent-blue); text-decoration: none; border-bottom: 1px solid transparent; transition: border-color 0.2s; }
        .markdown-content a:hover { border-color: var(--accent-blue); }
      `}</style>
    </div>
  );
};

export const Documentation = () => (
  <PageLayout title="Documentation">
    <h2>Getting Started</h2>
    <p>Welcome to the AuraScribe Documentation. AuraScribe is built to run natively on your machine, leveraging Edge compute via Groq's API and local window embedding to serve as your ultimate technical preparation tool.</p>
    
    <h2>Installation</h2>
    <ul>
      <li><strong>Windows (.exe):</strong> Download the standalone installer. It automatically binds to your system audio loopback so Voice Mode works seamlessly.</li>
      <li><strong>Web:</strong> Navigate to our Web Interface, grant Microphone and Screen Share permissions, and select your meeting application (or entire screen) as an audio input.</li>
      <li><strong>Source:</strong> Clone the repository and run <code>npm run dev</code> for developers.</li>
    </ul>

    <h2>Using Voice Mode</h2>
    <p>Click the Microphone icon on the transparent widget. The system will continuously listen for interviewer speech patterns. Ensure your microphone is muted to the meeting software if you choose to speak to the bot directly.</p>

    <h2>Using Chat Mode</h2>
    <p>Switch to chat by clicking the message icon. You can type in complex data structures, algorithmic requirements, or system design scenarios and receive perfectly structured Markdown responses with complete code snippets.</p>
  </PageLayout>
);

export const ApiReference = () => (
  <PageLayout title="API Reference">
    <h2>Public API</h2>
    <p>Currently, the AuraScribe system interfaces directly with third-party Language Models (Groq, Together, etc.). We do not currently expose a public REST API for routing external queries through the AuraScribe transcription engine.</p>
    
    <h2>Local Development</h2>
    <p>If you are self-hosting, the backend exposes the following internal endpoints handling WebSocket traffic:</p>
    <ul>
      <li><code>wss://localhost:3000</code> - Streams raw base64 PCM16 audio chunks to the transcription engine.</li>
      <li><code>/api/transcribe</code> - A fallback HTTP endpoint for sending full recorded audio buffers.</li>
      <li><code>/api/generate</code> - Handles the advanced Dual-LLM self-verification system.</li>
    </ul>
    <p>We plan to open-source the local API documentation layer using Swagger in Q4 2026. Stay tuned on our GitHub repository for updates.</p>
  </PageLayout>
);

export const Blog = () => (
  <PageLayout title="AuraScribe Blog">
    <h2>Latest Update: v2.5 Framework Overhaul</h2>
    <p><em>Posted on March 15, 2026</em></p>
    <p>We've completely overhauled the UI to utilize a fully transparent React overlay for Windows Desktop. By manipulating Electron's frameless window and click-through mechanics, we successfully decoupled the widget from the Electron taskbar, making it completely invisible to all screen-recording and conferencing software like OBS, Zoom, and Microsoft Teams.</p>
    
    <h2>How we achieved 120ms Latency with Groq</h2>
    <p><em>Posted on February 02, 2026</em></p>
    <p>Speech-to-text models have notoriously delayed interview responses. In our latest patch, we migrated our active transcription polling from local edge-transformers to <strong>Whisper-large-v3-turbo</strong> running on the Groq LPU inference engine, bringing TTFT (Time To First Token) down by roughly 80%.</p>
  </PageLayout>
);

export const FAQ = () => (
  <PageLayout title="Frequently Asked Questions">
    <h2>Is AuraScribe completely free?</h2>
    <p>The core community edition of AuraScribe is completely free and open source. You can self-host the application forever. We offer the Professional tier for power users who want unrestricted priority API access without needing to plug in their own tokens.</p>

    <h2>Can my interviewer see the widget?</h2>
    <p><strong>No.</strong> On Windows Desktop and macOS, AuraScribe uses OS-level content protection protocols (the same APIs used by Netflix to prevent screen-recording). During a Microsoft Teams, Zoom, or Google Meet screen share, the widget is completely omitted from the captured video feed.</p>

    <h2>Does it record my voice continuously?</h2>
    <p>AuraScribe only performs processing while the Microphone toggle is actively engaged (red indicator). No audio is saved to your disk, and external APIs are strictly configured to not retain transcription history for training data.</p>
  </PageLayout>
);

export const PrivacyPolicy = () => (
  <PageLayout title="Privacy Policy">
    <h2>Our Commitment to Privacy</h2>
    <p>AuraScribe was built by engineers, for engineers. We profoundly respect data privacy, especially regarding your sensitive career information.</p>
    
    <h2>Data Collection and Usage</h2>
    <ul>
      <li><strong>Audio Data:</strong> Audio is processed strictly in-memory. It is beamed directly to the transcription API and instantly discarded. We do not maintain logs or recordings of your sessions.</li>
      <li><strong>Resume Context:</strong> If you upload a resume or job description, the text is kept exclusively in your local machine's memory cache. It is injected into the LLM prompt and then deleted upon application exit.</li>
      <li><strong>API Keys:</strong> If you provide your own API keys, they are stored securely in your OS's encrypted local keychain (Windows Credential Manager / macOS Keychain). They are never transmitted to our servers.</li>
    </ul>

    <h2>Third Parties</h2>
    <p>We route transcription and intelligence requests through our LLM providers (Groq, Together AI). We maintain explicit Zero-Data Retention (ZDR) agreements with these enterprise endpoints, ensuring your prompts are never used for model training.</p>
  </PageLayout>
);

export const TermsOfService = () => (
  <PageLayout title="Terms of Service">
    <h2>Acceptable Use</h2>
    <p>AuraScribe is designed as an educational tool, interview prep companion, and real-time AI accessibility aide. By using our software, you agree that you will not utilize AuraScribe in proctored academic environments, certified testing centers, or any situation where its use is explicitly prohibited by the ruling body.</p>
    
    <h2>Disclaimer of Warranty</h2>
    <p>The software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability.</p>
  </PageLayout>
);

export const Security = () => (
  <PageLayout title="Security Infrastructure">
    <h2>End-to-End Encryption</h2>
    <p>All communication between the AuraScribe desktop client and our backend processing servers routes exclusively through TLS 1.3 encrypted WebSockets.</p>

    <h2>Application Sandboxing</h2>
    <p>The Electron application runs its renderer processes in isolated sandboxes with context bridge restrictions. Node integration is strictly limited to necessary IPC channels, preventing Remote Code Execution vulnerabilities during browser interactions.</p>
    
    <h2>Reporting Vulnerabilities</h2>
    <p>If you believe you have discovered a security vulnerability within AuraScribe's local implementation or web API, please reach out to our team immediately at <strong>security@aurascribe.ai</strong>. We actively participate in bug bounties and appreciate responsible disclosure.</p>
  </PageLayout>
);

export const ContactPage = () => (
  <PageLayout title="Contact Us">
    <h2>Get in Touch</h2>
    <p>Whether you're looking for enterprise licensing, need technical support, or want to contribute to the open-source project, our team is highly responsive.</p>
    
    <h2>General Inquiries</h2>
    <p>Email us at: <strong>hello@aurascribe.ai</strong></p>
    
    <h2>Support & Bug Reports</h2>
    <p>For technical support, please open an issue directly on our <a href="https://github.com/adityanshinde/Parakeet-AI-Clone/issues" target="_blank" rel="noreferrer">GitHub Repository</a>. This allows the community to track bugs and find existing solutions.</p>

    <h2>Social Media</h2>
    <p>Slide into our DMs on <a href="https://twitter.com/aurascribe" target="_blank" rel="noreferrer">Twitter</a> or join the developer conversation on our <a href="#" target="_blank" rel="noreferrer">Discord server</a>.</p>
  </PageLayout>
);
