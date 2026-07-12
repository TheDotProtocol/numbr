import { motion } from "framer-motion";
import { PhoneMockup } from "../ui/PhoneMockup";
import { Globe2, MessageSquare, Map, Star, Cloud, Plane } from "lucide-react";

export function ExperienceSection() {
  const features = [
    { title: "Global Calling", icon: <Globe2 className="w-6 h-6 text-white/80" />, desc: "No roaming fees, just seamless voice." },
    { title: "Messaging", icon: <MessageSquare className="w-6 h-6 text-white/80" />, desc: "Encrypted across all borders." },
    { title: "Global Access", icon: <Map className="w-6 h-6 text-white/80" />, desc: "Native connectivity everywhere." },
    { title: "Premium Numbers", icon: <Star className="w-6 h-6 text-[#C9A84C]" />, desc: "Short, memorable Numbr IDs." },
    { title: "Cloud Contacts", icon: <Cloud className="w-6 h-6 text-white/80" />, desc: "Never lose a connection again." },
    { title: "Travel Mode", icon: <Plane className="w-6 h-6 text-white/80" />, desc: "Auto-adjusts timezones & routing." },
  ];

  return (
    <section id="experience" className="py-32 bg-[#0A0A10] relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute -left-1/4 top-1/4 w-[1000px] h-[1000px] bg-[#C9A84C] rounded-full blur-[200px] opacity-[0.03] pointer-events-none" />

      <div className="container mx-auto px-6 lg:px-12">
        <div className="flex flex-col items-center mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-6 text-center"
          >
            The Numbr Experience
          </motion.h2>
          <motion.div 
            initial={{ width: 0 }}
            whileInView={{ width: "100px" }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="h-[2px] bg-[#C9A84C]"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
          {/* Left Text Callouts */}
          <div className="space-y-12">
            {[
              {
                title: "One number. Boundless reach.",
                text: "Your Numbr ID isn't tied to a SIM card. It lives in the cloud, syncing instantly to your Tau Phone."
              },
              {
                title: "Crystal clear, anywhere.",
                text: "Proprietary intelligent routing finds the strongest, lowest-latency path for every call, crossing oceans seamlessly."
              },
              {
                title: "End-to-end security.",
                text: "Zero-knowledge architecture means your conversations remain yours. Always encrypted, everywhere."
              }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.2, duration: 0.6 }}
                className="pl-8 border-l border-white/10 relative group"
              >
                <div className="absolute top-0 -left-[1px] w-[2px] h-0 bg-[#C9A84C] group-hover:h-full transition-all duration-500" />
                <h3 className="text-2xl font-medium text-white mb-3">{item.title}</h3>
                <p className="text-lg text-white/50">{item.text}</p>
              </motion.div>
            ))}
          </div>

          {/* Right Phone Mockup */}
          <div className="flex justify-center lg:justify-end relative">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="relative"
            >
              <div className="absolute -inset-10 bg-[radial-gradient(circle_at_center,rgba(201,168,76,0.1)_0%,transparent_70%)]" />
              
              <PhoneMockup>
                <div className="flex flex-col h-full bg-[#050508] p-4 font-sans text-white">
                  {/* Status Bar */}
                  <div className="flex justify-between items-center mb-8 px-2 text-xs text-white/60">
                    <span className="font-serif italic font-bold">Numbr</span>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]/50" />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]/50" />
                    </div>
                  </div>

                  {/* Number Display */}
                  <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 bg-white/5 rounded-full px-3 py-1 mb-4 border border-white/10">
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
                      <span className="text-[10px] uppercase tracking-wider text-white/80">Connected Globally</span>
                    </div>
                    <div className="text-3xl font-mono tracking-tight text-white/90">
                      +1739 <span className="text-[#C9A84C]">482913</span>
                    </div>
                  </div>

                  {/* Grid */}
                  <div className="grid grid-cols-2 gap-3 flex-1">
                    {features.map((feature, i) => (
                      <div key={i} className="glass-panel rounded-2xl p-4 flex flex-col justify-center items-center text-center group hover:border-[#C9A84C]/40 transition-colors cursor-pointer">
                        <div className="mb-2 group-hover:scale-110 transition-transform">{feature.icon}</div>
                        <span className="text-xs font-medium text-white/80">{feature.title}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Bottom Bar */}
                  <div className="mt-4 pt-4 border-t border-white/10 flex justify-around px-4 pb-2">
                    <div className="w-8 h-8 rounded-full bg-white/10" />
                    <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] flex items-center justify-center font-bold">N</div>
                    <div className="w-8 h-8 rounded-full bg-white/10" />
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
