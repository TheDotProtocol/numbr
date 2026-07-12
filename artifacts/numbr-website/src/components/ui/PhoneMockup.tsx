import { ReactNode } from "react";

export function PhoneMockup({ children, className = "" }: { children: ReactNode, className?: string }) {
  return (
    <div className={`w-[320px] h-[660px] md:w-[360px] md:h-[740px] shrink-0 rounded-[44px] bg-[#1a1a1a] p-[3px] shadow-2xl relative ${className}`}>
      {/* Outer Titanium Frame */}
      <div className="absolute inset-0 rounded-[44px] bg-gradient-to-br from-[#4a4a4a] via-[#1a1a1a] to-[#0a0a0a]" />
      
      {/* Inner Bezel */}
      <div className="absolute inset-[2px] rounded-[42px] bg-black z-10" />
      
      {/* Screen Area */}
      <div className="absolute inset-[8px] rounded-[36px] bg-[#050508] overflow-hidden z-20 flex flex-col relative">
        {/* Notch / Dynamic Island */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-50 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-[#111] border border-white/5 mr-4" />
        </div>
        
        {children}
      </div>

      {/* Buttons */}
      <div className="absolute top-32 -left-[2px] w-[2px] h-12 bg-gradient-to-b from-[#555] to-[#333] rounded-l-md" />
      <div className="absolute top-48 -left-[2px] w-[2px] h-12 bg-gradient-to-b from-[#555] to-[#333] rounded-l-md" />
      <div className="absolute top-40 -right-[2px] w-[2px] h-16 bg-gradient-to-b from-[#C9A84C]/60 to-[#C9A84C]/30 rounded-r-md" />
    </div>
  );
}
