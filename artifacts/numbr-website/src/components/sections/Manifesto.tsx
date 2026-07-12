import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

export function ManifestoSection() {
  return (
    <section id="manifesto" className="py-32 lg:py-48 bg-[#050508] relative">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="max-w-4xl mx-auto text-center mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-5xl lg:text-6xl font-light text-white leading-tight"
          >
            Modern phones still rely on country-based identities.
            <br />
            <span className="font-bold mt-4 block">We built around something different.</span>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-32">
          {[
            { icon: <X className="text-white/20 w-8 h-8" />, title: "Not geography", delay: 0.1, color: "text-white/40" },
            { icon: <X className="text-white/20 w-8 h-8" />, title: "Not SIM cards", delay: 0.2, color: "text-white/40" },
            { icon: <Check className="text-[#C9A84C] w-8 h-8" />, title: "You.", delay: 0.3, color: "text-white font-bold" }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: item.delay, duration: 0.6 }}
              className="glass-panel p-10 flex flex-col items-center justify-center gap-6 text-center group hover:border-[#C9A84C]/30 transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                {item.icon}
              </div>
              <h3 className={`text-2xl ${item.color}`}>{item.title}</h3>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1 }}
          className="max-w-5xl mx-auto"
        >
          <div className="relative overflow-hidden py-16 px-6 sm:px-12 flex items-center justify-center text-center">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C9A84C]/5 to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[1px] bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[1px] bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent" />
            
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white relative z-10">
              Your identity.<br className="md:hidden" /> Your number. <br className="md:hidden" /><span className="gold-gradient-text">Everywhere.</span>
            </h2>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
