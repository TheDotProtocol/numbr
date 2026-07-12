import { motion } from "framer-motion";
import { Shield, Cpu, Camera, BatteryCharging, Wifi, Lock, Monitor } from "lucide-react";
import tauPhoneImg from "@assets/ChatGPT_Image_Jul_12,_2026,_01_59_23_PM_1783852464330.png";

const specs = [
  {
    icon: <Monitor className="w-5 h-5 text-[#C9A84C]" />,
    title: "6.67″ LTPO AMOLED",
    desc: "QHD+ · 1–120Hz · 3000 nits peak brightness",
    sub: "HDR10+ · Corning® Gorilla Glass Victus® 2",
    status: "Available Today",
  },
  {
    icon: <Cpu className="w-5 h-5 text-[#C9A84C]" />,
    title: "Snapdragon® 8 Elite",
    desc: "4nm process · Adreno GPU · On-device AI Engine",
    sub: "Up to 16GB RAM · 512GB UFS 4.1",
    status: "Available Today",
  },
  {
    icon: <Camera className="w-5 h-5 text-[#C9A84C]" />,
    title: "5-Camera System",
    desc: "50MP Main LYT-900 OIS + 50MP Ultra Wide",
    sub: "50MP Portrait · 50MP Periscope 5× · Laser AF",
    status: "Available Today",
  },
  {
    icon: <BatteryCharging className="w-5 h-5 text-[#C9A84C]" />,
    title: "6000mAh Silicon-Carbon",
    desc: "100W Wired · 50W Wireless · Reverse Wireless",
    sub: "All-day power, engineered to last",
    status: "Available Today",
  },
  {
    icon: <Wifi className="w-5 h-5 text-[#C9A84C]" />,
    title: "5G + eSIM + Dual SIM",
    desc: "Wi-Fi 7 · Bluetooth 5.4 · NFC · USB 4.0",
    sub: "Native Numbr ID integration",
    status: "Available Today",
  },
  {
    icon: <Shield className="w-5 h-5 text-[#C9A84C]" />,
    title: "IP68 Durability",
    desc: "Aerospace-grade Titanium Frame · Ceramic Glass Back",
    sub: "Scratch-resistant · Reinforced structure",
    status: "Available Today",
  },
  {
    icon: <Lock className="w-5 h-5 text-[#C9A84C]" />,
    title: "Privacy First",
    desc: "On-device AI · Private by design · Always in control",
    sub: "7 Years OS & Security Updates",
    status: "Available Today",
  },
];

export function HardwareSection() {
  return (
    <section id="hardware" className="py-24 bg-[#020204] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-[#C9A84C]/4 blur-[160px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-6 lg:px-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <div className="text-[#C9A84C] text-xs font-semibold uppercase tracking-[0.3em] mb-4">Hardware</div>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight">
            Crafted Without{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] via-[#E8C96D] to-[#C9A84C]">
              Compromise.
            </span>
          </h2>
          <p className="text-white/40 text-lg mt-4 max-w-xl mx-auto">
            Intelligence, engineered. A new standard of flagship.
          </p>
        </motion.div>

        {/* TAU wordmark */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-6">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
            <span className="text-xs text-white/30 uppercase tracking-[0.5em] font-medium">Tau Phone by Numbr</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
          </div>
        </motion.div>

        {/* HERO — Device Image */}
        <div className="flex justify-center mb-24 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.07)_0%,transparent_65%)] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            animate={{ y: [0, -12, 0] }}
          >
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
              className="relative"
            >
              {/* Gold rim glow behind image */}
              <div className="absolute -inset-4 bg-gradient-to-b from-[#C9A84C]/10 via-transparent to-[#C9A84C]/5 blur-2xl rounded-[60px]" />
              <img
                src={tauPhoneImg}
                alt="Tau Phone — Intelligence, Engineered"
                className="relative z-10 w-full max-w-2xl mx-auto object-contain drop-shadow-[0_40px_80px_rgba(201,168,76,0.2)]"
                style={{ maxHeight: "700px" }}
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Specs Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-center mb-12"
        >
          <h3 className="text-2xl font-bold text-white/80">Full Specifications</h3>
          <div className="w-12 h-px bg-[#C9A84C]/40 mx-auto mt-4" />
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {specs.map((spec, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.07, duration: 0.5 }}
              className="group border border-white/5 bg-white/[0.02] hover:border-[#C9A84C]/20 hover:bg-[#C9A84C]/[0.03] transition-all duration-300 p-6 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 border border-[#C9A84C]/20 bg-[#C9A84C]/5">
                  {spec.icon}
                </div>
                <h4 className="text-white font-bold text-sm leading-snug">{spec.title}</h4>
              </div>
              <p className="text-white/60 text-xs leading-relaxed">{spec.desc}</p>
              <p className="text-white/30 text-[11px] leading-relaxed">{spec.sub}</p>
              <div className="mt-auto pt-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#C9A84C] bg-[#C9A84C]/8 border border-[#C9A84C]/25 px-2 py-1">
                  {spec.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pre-book CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-20 text-center"
        >
          <div className="inline-flex flex-col items-center gap-5 border border-[#C9A84C]/20 bg-[#C9A84C]/3 px-12 py-10">
            <div className="text-[#C9A84C] text-xs uppercase tracking-[0.35em] font-semibold">Something Remarkable Is Approaching</div>
            <div className="text-3xl md:text-4xl font-bold text-white">Join the Founding Circle</div>
            <p className="text-white/50 text-sm max-w-md">
              Pre-book your Tau Phone and lock in your Numbr ID together. First 30 founding members receive lifetime access at an exclusive rate.
            </p>
            <button
              onClick={() => document.getElementById("reserve")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-gradient-to-r from-[#C9A84C] to-[#E8C96D] text-[#050508] px-10 py-4 text-sm font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              Reserve Now
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
