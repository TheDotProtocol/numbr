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
          scrolled ? "bg-background/70 backdrop-blur-md border-b border-white/5 py-4" : "bg-transparent py-6"
        }`}
      >
        <div className="container mx-auto px-6 lg:px-12 flex items-center justify-between">
          <Link href="/" className="text-2xl font-serif italic font-bold tracking-tight text-white flex items-center gap-1 group">
            Nümbr
            <span className="w-1.5 h-1.5 rounded-full bg-primary mb-2 group-hover:scale-150 transition-transform"></span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
            <button onClick={() => scrollTo("experience")} className="hover:text-white transition-colors">Platform</button>
            <button onClick={() => scrollTo("hardware")} className="hover:text-white transition-colors">Tau Phone</button>
            <button onClick={() => scrollTo("os")} className="hover:text-white transition-colors">Ecosystem</button>
            <button onClick={() => scrollTo("roadmap")} className="hover:text-white transition-colors">Roadmap</button>
            <button onClick={() => scrollTo("manifesto")} className="hover:text-white transition-colors">Company</button>
          </nav>

          <div className="hidden md:flex">
            <button className="bg-gradient-to-r from-[#C9A84C] to-[#E8C96D] text-background px-6 py-2.5 text-sm font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
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

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl pt-24 px-6 flex flex-col gap-6"
          >
            <button onClick={() => scrollTo("experience")} className="text-2xl font-light text-left text-white/80">Platform</button>
            <button onClick={() => scrollTo("hardware")} className="text-2xl font-light text-left text-white/80">Tau Phone</button>
            <button onClick={() => scrollTo("os")} className="text-2xl font-light text-left text-white/80">Ecosystem</button>
            <button onClick={() => scrollTo("roadmap")} className="text-2xl font-light text-left text-white/80">Roadmap</button>
            <button onClick={() => scrollTo("manifesto")} className="text-2xl font-light text-left text-white/80">Company</button>
            <button className="mt-8 bg-gradient-to-r from-[#C9A84C] to-[#E8C96D] text-background px-6 py-4 text-center font-bold uppercase tracking-wider">
              Reserve Access
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
