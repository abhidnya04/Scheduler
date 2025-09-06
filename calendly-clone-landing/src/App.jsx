import { Route, Routes } from "react-router-dom";
import CTA from "./components/CTA";
import Features from "./components/Features";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import Navbar from "./components/Navbar";

import Dashboard from "./components/Dashboard";
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

      {/* Dashboard */}
      <Route path="/dashboard" element={<Dashboard />} />
      
      {/* Landing Page after login */}
      <Route path="/schedule" element={<SchedulePage />} />
    </Routes>
  );
}
