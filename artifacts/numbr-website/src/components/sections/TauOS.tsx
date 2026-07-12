import { motion } from "framer-motion";
import { PhoneMockup } from "../ui/PhoneMockup";
import { Lock, Cloud, Cpu, Zap, Link as LinkIcon, Rocket } from "lucide-react";

export function TauOSSection() {
  const features = [
    { icon: <Lock className="w-5 h-5 text-[#C9A84C]" />, title: "Privacy-First", desc: "Zero-knowledge architecture by design." },
    { icon: <Cloud className="w-5 h-5 text-[#C9A84C]" />, title: "Cloud Sync", desc: "Your world, always in sync." },
    { icon: <Cpu className="w-5 h-5 text-[#C9A84C]" />, title: "AI Assistant", desc: "An assistant that knows your communication patterns." },
    { icon: <Zap className="w-5 h-5 text-[#C9A84C]" />, title: "Fast Updates", desc: "Rolling updates. No waiting. No disruption." },
    { icon: <LinkIcon className="w-5 h-5 text-[#C9A84C]" />, title: "Unified Experience", desc: "Numbr ID flows seamlessly through every app." },
    { icon: <Rocket className="w-5 h-5 text-[#C9A84C]" />, title: "Future-Ready", desc: "An OS designed for the next decade of communication." }
  ];

  return (
    <section id="os" className="py-32 bg-[#08080C] relative border-t border-white/5">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Content */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-16"
            >
              <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
                Tau OS.<br />
                <span className="text-[#C9A84C]">Intelligence Built In.</span>
              </h2>
            </motion.div>

            <div className="space-y-8">
              {features.map((feat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="flex gap-6 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-[#C9A84C]/10 group-hover:border-[#C9A84C]/30 transition-all">
                    {feat.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{feat.title}</h3>
                    <p className="text-white/50">{feat.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Mockup */}
          <div className="flex justify-center relative perspective-1000">
            <motion.div
              initial={{ opacity: 0, rotateY: 20, scale: 0.9 }}
              whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <PhoneMockup className="shadow-[0_20px_100px_rgba(0,0,0,0.8)] border border-white/10">
                <div className="h-full w-full bg-[#050508] relative overflow-hidden flex flex-col font-sans">
                  {/* Abstract OS Background */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A84C] rounded-full mix-blend-screen opacity-10 blur-[80px]" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500 rounded-full mix-blend-screen opacity-10 blur-[60px]" />
                  
                  {/* Status */}
                  <div className="flex justify-between px-6 pt-12 pb-4 z-10">
                    <span className="text-white/80 font-medium text-sm">9:41</span>
                    <div className="flex gap-2 items-center">
                      <div className="w-4 h-3 bg-white/80 rounded-[2px]" />
                      <div className="w-3 h-3 rounded-full bg-white/80" />
                    </div>
                  </div>

                  {/* Main UI */}
                  <div className="px-4 z-10 flex-1 flex flex-col">
                    <div className="mb-10 mt-8">
                      <h4 className="text-white/60 text-sm mb-1 uppercase tracking-widest font-mono">ID: +1739-482</h4>
                      <h3 className="text-white text-3xl font-light">Good Morning</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="glass-panel rounded-2xl p-4 aspect-square flex flex-col justify-between">
                        <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-[#C9A84C]" />
                        </div>
                        <span className="text-white/90 text-sm font-medium">Vault Secure</span>
                      </div>
                      <div className="glass-panel rounded-2xl p-4 aspect-square flex flex-col justify-between">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Cloud className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="text-white/90 text-sm font-medium">Synced</span>
                      </div>
                    </div>

                    <div className="glass-panel rounded-2xl p-4 flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                        <Cpu className="w-5 h-5 text-white/70" />
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">AI Suggestions</div>
                        <div className="text-white/50 text-xs">2 new routing paths found</div>
                      </div>
                    </div>
                  </div>

                  {/* Dock */}
                  <div className="m-4 glass-panel rounded-3xl p-3 flex justify-around z-10">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                        <div className="w-6 h-6 bg-white/40 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </PhoneMockup>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
