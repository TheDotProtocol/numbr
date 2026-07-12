import { Link } from "wouter";
export function Footer() {
  return (
    <footer className="bg-[#020204] pt-24 pb-12 border-t border-white/5 relative z-10">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-start gap-12 mb-16">
          <div className="max-w-xs">
            <Link href="/">
              <img
                src="/numbr-logo.png"
                alt="Numbr"
                width={1331}
                height={558}
                className="h-16 w-auto object-contain mb-4 md:h-20"
                style={{ maxWidth: "320px" }}
              />
            </Link>
            <p className="text-white/30 text-xs leading-relaxed mt-4">
              One numbr everywhere. A new global standard for communications built for a borderless world.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
            <div>
              <div className="text-white/20 text-xs uppercase tracking-widest mb-4 font-semibold">Legal</div>
              <div className="flex flex-col gap-3">
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Whitepaper</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Privacy Policy</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Trust & Safety</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Terms of Service</a>
              </div>
            </div>
            <div>
              <div className="text-white/20 text-xs uppercase tracking-widest mb-4 font-semibold">Product</div>
              <div className="flex flex-col gap-3">
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Tau Phone</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Tau OS</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Global Numbers</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Roadmap</a>
              </div>
            </div>
            <div>
              <div className="text-white/20 text-xs uppercase tracking-widest mb-4 font-semibold">Company</div>
              <div className="flex flex-col gap-3">
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">About</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Careers</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Press</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Contact</a>
              </div>
            </div>
            <div>
              <div className="text-white/20 text-xs uppercase tracking-widest mb-4 font-semibold">Reserve</div>
              <div className="flex flex-col gap-3">
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Get Your Number</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Fancy Numbers</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Prebook Tau Phone</a>
                <a href="#" className="text-white/50 hover:text-[#C9A84C] transition-colors">Founding Circle</a>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl space-y-3 mb-10 text-[11px] text-white/20 leading-relaxed">
          <p>
            Disclaimer: Numbr does not own telecom infrastructure. Connectivity is provided through partner networks and evolves over time. Platform capabilities are in development and will expand. Pricing and availability subject to change. First 30 founding subscriber pricing is limited and non-transferable.
          </p>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-8 border-t border-white/5">
          <p className="text-sm font-medium text-[#C9A84C]/80 tracking-wide">
            Numbr — A company of AR Holdings Group Corporation
          </p>
          <p className="text-xs text-white/20">
            © {new Date().getFullYear()} Numbr. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
