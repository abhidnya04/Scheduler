import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

import SchedulePage from "./components/SchedulePage";

export default function App() {
  return (
 
    <Routes>
      {/* Home Page */}
      
      <Route
        path="/"
        element={
          <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white text-gray-900">
            <Navbar />
            <Hero />
            <Features />
            <CTA />
            <Footer />
          </div>
        }
      />

      {/* Landing Page after login */}
      <Route path="/schedule" element={<SchedulePage />} />
    </Routes>
  );
}
