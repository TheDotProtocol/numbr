import { motion } from "framer-motion";
import { PhoneMockup } from "../ui/PhoneMockup";
import { Shield, Smartphone, Cpu, Satellite, Camera, BatteryCharging, Fingerprint } from "lucide-react";

export function HardwareSection() {
  const specs = [
    { title: "Titanium Frame", desc: "Aerospace-grade precision. Featherlight. Indestructible.", status: "Available Today", icon: <Shield className="w-8 h-8 text-[#C9A84C] mb-4" /> },
    { title: "Premium OLED Display", desc: "True blacks. Infinite contrast. Cinematic color gamut.", status: "Available Today", icon: <Smartphone className="w-6 h-6 text-white/60 mb-4" /> },
    { title: "AI Processor", desc: "Purpose-built for tomorrow's communication demands.", status: "Available Today", icon: <Cpu className="w-6 h-6 text-white/60 mb-4" /> },
    { title: "Satellite Architecture", desc: "Future-ready infrastructure.", status: "Future Vision", icon: <Satellite className="w-6 h-6 text-white/60 mb-4" /> },
    { title: "Multi-Camera Array", desc: "Capture the world you're connected to.", status: "Available Today", icon: <Camera className="w-6 h-6 text-white/60 mb-4" /> },
    { title: "Wireless Charging", desc: "Power without compromise.", status: "Available Today", icon: <BatteryCharging className="w-6 h-6 text-white/60 mb-4" /> },
    { title: "Biometric Security", desc: "You are the password.", status: "Available Today", icon: <Fingerprint className="w-6 h-6 text-white/60 mb-4" /> },
  ];

  return (
    <section id="hardware" className="py-32 bg-[#020204] relative">
      <div className="container mx-auto px-6 lg:px-12">
        
        <div className="text-center mb-24 relative z-10">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight"
          >
            Crafted Without <span className="gold-gradient-text">Compromise.</span>
          </motion.h2>
        </div>

        {/* Floating Phone Render */}
        <div className="flex justify-center mb-32 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] max-w-[800px] h-[300px] bg-[#C9A84C] opacity-5 blur-[120px] rounded-full pointer-events-none" />
          
          <motion.div
            animate={{ y: [0, -20, 0] }}
            transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
          >
            <PhoneMockup className="shadow-[0_0_80px_rgba(201,168,76,0.15)] ring-1 ring-white/10">
              <div className="w-full h-full bg-gradient-to-b from-[#111] to-[#000] relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.2)_0%,transparent_50%)]" />
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-10 left-0 w-full text-center">
                <div className="text-4xl font-serif italic text-white/90">Tau</div>
              </div>
            </PhoneMockup>
          </motion.div>
        </div>

        {/* Specs Masonry / Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {specs.map((spec, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className={`glass-panel p-8 rounded-2xl flex flex-col justify-between ${
                i === 0 ? "md:col-span-2 lg:col-span-2 glass-panel-gold" : ""
              }`}
            >
              <div>
                {spec.icon}
                <h3 className="text-xl font-bold text-white mb-3">{spec.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{spec.desc}</p>
              </div>
              
              <div className="mt-8">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full border ${
                  spec.status === "Available Today" 
                    ? "border-[#C9A84C]/30 text-[#C9A84C] bg-[#C9A84C]/5" 
                    : "border-white/10 text-white/40 bg-white/5"
                }`}>
                  {spec.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
