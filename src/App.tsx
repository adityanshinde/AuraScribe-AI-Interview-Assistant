/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import OverlayWidget from './components/OverlayWidget';
import LandingPage from './components/LandingPage';
import { Documentation, ApiReference, Blog, FAQ, PrivacyPolicy, TermsOfService, Security, ContactPage } from './components/FooterPages';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<Documentation />} />
        <Route path="/api-reference" element={<ApiReference />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/security" element={<Security />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/app" element={
          <div className="h-screen w-screen overflow-hidden">
            <OverlayWidget />
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}
