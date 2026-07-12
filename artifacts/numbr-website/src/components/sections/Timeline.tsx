import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function TimelineSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);

  const moments = [
    { time: "6:00 AM", icon: "🌅", title: "Wake up.", desc: "Your Numbr ID is already active. One number. Always on." },
    { time: "9:30 AM", icon: "📞", title: "A call from Tokyo", desc: "Lands in your pocket. Same number. No forwarding." },
    { time: "2:00 PM", icon: "✈️", title: "Board your flight.", desc: "Your identity boards with you." },
    { time: "11:00 PM", icon: "🛬", title: "Land in London.", desc: "Your contacts are here. Your messages are here. You are here." },
    { time: "11:30 PM", icon: "💬", title: "Continue the conversation.", desc: "Same thread. Same identity. Zero confusion." },
    { time: "Midnight", icon: "🌙", title: "Sleep anywhere.", desc: "Your Numbr never sleeps." },
  ];

  useEffect(() => {
    let ctx = gsap.context(() => {
      if (!scrollWrapperRef.current || !containerRef.current) return;
      
      const panels = gsap.utils.toArray(".timeline-panel");
      
      gsap.to(panels, {
        xPercent: -100 * (panels.length - 1),
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          pin: true,
          scrub: 1,
          end: () => "+=" + (scrollWrapperRef.current?.offsetWidth || 0)
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="h-screen w-full bg-[#050508] overflow-hidden flex flex-col relative border-t border-white/5">
      <div className="absolute top-20 left-12 md:left-24 z-10">
        <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight">
          Your Day, <span className="text-[#C9A84C]">Borderless.</span>
        </h2>
      </div>

      <div className="flex items-center h-full pt-32">
        <div ref={scrollWrapperRef} className="flex h-[60vh] gap-8 px-12 md:px-24">
          {moments.map((moment, i) => (
            <div 
              key={i} 
              className="timeline-panel w-[85vw] md:w-[60vw] lg:w-[40vw] h-full shrink-0 flex flex-col relative"
            >
              {/* Connector line */}
              <div className="absolute top-[40px] left-0 w-full h-[2px] bg-white/10 z-0">
                {i === 0 && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#C9A84C]" />}
              </div>
              
              <div className="relative z-10 flex flex-col h-full mt-20 p-10 glass-panel rounded-3xl hover:border-[#C9A84C]/30 transition-colors group">
                <div className="text-5xl mb-8 opacity-80 group-hover:scale-110 group-hover:opacity-100 transition-all duration-500 origin-left">{moment.icon}</div>
                <div className="text-[#C9A84C] font-mono text-sm tracking-widest mb-4">{moment.time}</div>
                <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">{moment.title}</h3>
                <p className="text-lg md:text-xl text-white/50">{moment.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
