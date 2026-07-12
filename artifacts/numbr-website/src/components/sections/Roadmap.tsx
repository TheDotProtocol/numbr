import { motion } from "framer-motion";

export function RoadmapSection() {
  const phases = [
    { phase: "Phase 1", title: "Cloud Communication", desc: "Core Numbr platform live. Global calling and messaging.", status: "Available Today", active: true },
    { phase: "Phase 2", title: "Global Identity", desc: "Persistent ID fully deployed. Seamless cross-border use.", status: "Available Today", active: true },
    { phase: "Phase 3", title: "eSIM Connectivity", desc: "SIM-free connectivity via partner eSIM integration.", status: "Coming Soon", active: false },
    { phase: "Phase 4", title: "Network Intelligence", desc: "AI-powered call routing, smart connectivity.", status: "Future Vision", active: false },
    { phase: "Phase 5", title: "Expanded Global Partnerships", desc: "Carrier partnerships across 100+ countries.", status: "Future Vision", active: false },
    { phase: "Phase 6", title: "Next-Generation Platform", desc: "The future of communication, fully realized.", status: "Future Vision", active: false },
  ];

  return (
    <section id="roadmap" className="py-32 bg-[#050508] relative overflow-hidden">
      <div className="container mx-auto px-6 lg:px-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-24"
        >
          <h2 className="text-5xl md:text-7xl font-bold text-white mb-6">A Clear Path Forward.</h2>
          <div className="w-24 h-1 bg-[#C9A84C] mx-auto rounded-full" />
        </motion.div>

        {/* Horizontal Scroll wrapper for smaller screens, full grid for large */}
        <div className="overflow-x-auto pb-12 hide-scrollbar">
          <div className="min-w-[1200px] xl:w-full">
            <div className="relative">
              {/* Central Line */}
              <div className="absolute top-[40px] left-0 w-full h-[2px] bg-white/5" />
              <div className="absolute top-[40px] left-0 w-1/3 h-[2px] bg-gradient-to-r from-[#C9A84C] to-transparent shadow-[0_0_15px_#C9A84C]" />

              <div className="grid grid-cols-6 gap-6 relative z-10">
                {phases.map((phase, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className={`relative pt-20 ${phase.active ? 'opacity-100' : 'opacity-40 hover:opacity-100 transition-opacity'}`}
                  >
                    {/* Node Dot */}
                    <div className={`absolute top-[33px] left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-4 ${
                      phase.active 
                        ? 'bg-[#050508] border-[#C9A84C] shadow-[0_0_20px_#C9A84C]' 
                        : 'bg-[#050508] border-white/20'
                    }`} />
                    
                    <div className="text-center">
                      <div className="text-[#C9A84C] font-mono text-sm tracking-widest mb-4 uppercase">{phase.phase}</div>
                      <h3 className="text-white font-bold text-lg mb-3">{phase.title}</h3>
                      <p className="text-white/60 text-sm mb-6 px-4">{phase.desc}</p>
                      
                      <span className={`inline-block px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                        phase.status === 'Available Today' ? 'bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/30' :
                        phase.status === 'Coming Soon' ? 'bg-white/10 text-white/80 border border-white/20' :
                        'bg-transparent text-white/40 border border-white/10'
                      }`}>
                        {phase.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
