import { Link } from "wouter";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-[#050508]/80 backdrop-blur-xl border-b border-white/5 py-3" : "bg-transparent py-5"
        }`}
      >
        <div className="container mx-auto px-6 lg:px-12 flex items-center justify-between">
          <Link href="/" className="shrink-0">
            <img
              src="/numbr-logo-mark.png"
              alt="Numbr"
              width={1315}
              height={270}
              className="h-11 w-auto object-contain sm:h-12 md:h-14"
              style={{ maxWidth: "min(280px, 52vw)" }}
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
            <button onClick={() => scrollTo("experience")} className="hover:text-white transition-colors tracking-wide">Platform</button>
            <button onClick={() => scrollTo("hardware")} className="hover:text-white transition-colors tracking-wide">Tau Phone</button>
            <button onClick={() => scrollTo("reserve")} className="hover:text-white transition-colors tracking-wide">Reserve Number</button>
            <button onClick={() => scrollTo("roadmap")} className="hover:text-white transition-colors tracking-wide">Roadmap</button>
            <button onClick={() => scrollTo("manifesto")} className="hover:text-white transition-colors tracking-wide">Company</button>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => scrollTo("reserve")}
              className="bg-gradient-to-r from-[#C9A84C] to-[#E8C96D] text-[#050508] px-6 py-2.5 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              Reserve Access
            </button>
          </div>

          <button
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-[#050508]/97 backdrop-blur-xl pt-24 px-6 flex flex-col gap-6"
          >
            <button onClick={() => scrollTo("experience")} className="text-2xl font-light text-left text-white/80 py-2 border-b border-white/5">Platform</button>
            <button onClick={() => scrollTo("hardware")} className="text-2xl font-light text-left text-white/80 py-2 border-b border-white/5">Tau Phone</button>
            <button onClick={() => scrollTo("reserve")} className="text-2xl font-light text-left text-white/80 py-2 border-b border-white/5">Reserve Number</button>
            <button onClick={() => scrollTo("roadmap")} className="text-2xl font-light text-left text-white/80 py-2 border-b border-white/5">Roadmap</button>
            <button onClick={() => scrollTo("manifesto")} className="text-2xl font-light text-left text-white/80 py-2 border-b border-white/5">Company</button>
            <button
              onClick={() => scrollTo("reserve")}
              className="mt-6 bg-gradient-to-r from-[#C9A84C] to-[#E8C96D] text-[#050508] px-6 py-4 text-center font-bold uppercase tracking-wider"
            >
              Reserve Your Number
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
