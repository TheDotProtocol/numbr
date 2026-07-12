import { motion } from "framer-motion";
import { CheckCircle2, Clock } from "lucide-react";

export function RoadmapSection() {
  const phases = [
    {
      phase: "Phase 1",
      title: "Cloud Communication",
      desc: "Core Numbr platform live. Global calling and messaging.",
      status: "Available Today",
      active: true,
    },
    {
      phase: "Phase 2",
      title: "Global Identity",
      desc: "Persistent ID fully deployed. Seamless cross-border use.",
      status: "Available Today",
      active: true,
    },
    {
      phase: "Phase 3",
      title: "eSIM Connectivity",
      desc: "SIM-free connectivity via partner eSIM integration.",
      status: "Available Today",
      active: true,
    },
    {
      phase: "Phase 4",
      title: "Network Intelligence",
      desc: "AI-powered call routing and smart global connectivity.",
      status: "Coming Soon",
      active: false,
    },
    {
      phase: "Phase 5",
      title: "Expanded Global Partnerships",
      desc: "Carrier partnerships across 100+ countries.",
      status: "Coming Soon",
      active: false,
    },
    {
      phase: "Phase 6",
      title: "Next-Generation Platform",
      desc: "The future of communication, fully realized.",
      status: "Coming Soon",
      active: false,
    },
  ];

  const activeCount = phases.filter((p) => p.active).length;
  const progressPct = (activeCount / phases.length) * 100;

  return (
    <section id="roadmap" className="py-32 bg-[#050508] relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#C9A84C]/3 blur-[120px] rounded-full" />
      </div>

      <div className="container mx-auto px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <div className="text-[#C9A84C] text-xs font-semibold uppercase tracking-[0.3em] mb-4">Product Roadmap</div>
          <h2 className="text-5xl md:text-7xl font-bold text-white mb-6">A Clear Path Forward.</h2>
          <div className="w-20 h-px bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent mx-auto" />
        </motion.div>

        {/* Progress summary */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex justify-center gap-8 mb-20 text-sm"
        >
          <div className="flex items-center gap-2 text-[#C9A84C]">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-medium">{activeCount} Phases Live</span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <Clock className="w-4 h-4" />
            <span>{phases.length - activeCount} Coming Soon</span>
          </div>
        </motion.div>

        <div className="overflow-x-auto pb-12">
          <div className="min-w-[900px] xl:w-full">
            <div className="relative">
              {/* Track */}
              <div className="absolute top-[38px] left-[8.33%] right-[8.33%] h-[2px] bg-white/5" />
              {/* Progress fill */}
              <motion.div
                className="absolute top-[38px] left-[8.33%] h-[2px] bg-gradient-to-r from-[#C9A84C] to-[#E8C96D] shadow-[0_0_12px_#C9A84C]"
                initial={{ width: "0%" }}
                whileInView={{ width: `${progressPct * 0.83}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
              />

              <div className="grid grid-cols-6 gap-4 relative z-10">
                {phases.map((phase, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12 }}
                    className="relative pt-20"
                  >
                    {/* Node */}
                    <div className="absolute top-[30px] left-1/2 -translate-x-1/2">
                      {phase.active ? (
                        <div className="w-[18px] h-[18px] rounded-full bg-[#C9A84C] shadow-[0_0_16px_rgba(201,168,76,0.8)] flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-[#050508]" />
                        </div>
                      ) : (
                        <div className="w-[18px] h-[18px] rounded-full border-2 border-white/20 bg-[#050508]" />
                      )}
                    </div>

                    <div className={`text-center transition-opacity ${phase.active ? "opacity-100" : "opacity-45 hover:opacity-80"}`}>
                      <div className="text-[#C9A84C]/70 font-mono text-[11px] tracking-widest mb-3 uppercase">{phase.phase}</div>
                      <h3 className="text-white font-bold text-base mb-2 leading-tight">{phase.title}</h3>
                      <p className="text-white/50 text-xs mb-5 px-2 leading-relaxed">{phase.desc}</p>

                      <span
                        className={`inline-block px-3 py-1 text-[10px] uppercase tracking-wider font-bold border ${
                          phase.status === "Available Today"
                            ? "bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30"
                            : "bg-white/5 text-white/50 border-white/10"
                        }`}
                      >
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
