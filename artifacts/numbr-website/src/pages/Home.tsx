import { useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { HeroSection } from "../components/sections/Hero";
import { ManifestoSection } from "../components/sections/Manifesto";
import { ExperienceSection } from "../components/sections/Experience";
import { HardwareSection } from "../components/sections/Hardware";
import { TimelineSection } from "../components/sections/Timeline";
import { GlobeSection } from "../components/sections/GlobeSection";
import { TauOSSection } from "../components/sections/TauOS";
import { RoadmapSection } from "../components/sections/Roadmap";

export default function Home() {
  const [location] = useLocation();

  useEffect(() => {
    // If routing directly to /tau-phone, scroll to hardware section
    if (location === "/tau-phone") {
      setTimeout(() => {
        const hardwareElement = document.getElementById("hardware");
        if (hardwareElement) {
          hardwareElement.scrollIntoView({ behavior: "smooth" });
        }
      }, 500);
    }
  }, [location]);

  return (
    <div className="w-full bg-[#050508] overflow-x-hidden">
      <Navbar />
      
      <main>
        <HeroSection />
        <ManifestoSection />
        <ExperienceSection />
        <HardwareSection />
        <TimelineSection />
        <GlobeSection />
        <TauOSSection />
        <RoadmapSection />
      </main>

      <Footer />
    </div>
  );
}
