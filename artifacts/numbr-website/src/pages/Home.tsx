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
import { ReserveSection } from "../components/sections/ReserveSection";

export default function Home() {
  const [location] = useLocation();

  useEffect(() => {
    if (location === "/tau-phone") {
      setTimeout(() => {
        document.getElementById("hardware")?.scrollIntoView({ behavior: "smooth" });
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
        <ReserveSection />
        <TimelineSection />
        <GlobeSection />
        <TauOSSection />
        <RoadmapSection />
      </main>

      <Footer />
    </div>
  );
}
