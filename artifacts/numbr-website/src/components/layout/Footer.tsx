import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-[#020204] pt-24 pb-12 border-t border-white/5 relative z-10">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
          <Link href="/" className="text-3xl font-serif italic font-bold tracking-tight text-white flex items-center gap-1 group">
            Nümbr
            <span className="w-1.5 h-1.5 rounded-full bg-primary mb-2"></span>
          </Link>
          
          <div className="flex flex-wrap gap-6 text-sm font-medium text-white/50">
            <a href="#" className="hover:text-primary transition-colors">Whitepaper</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Trust & Safety</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
          </div>
        </div>

        <div className="max-w-3xl space-y-4 mb-16 text-xs text-white/30 leading-relaxed">
          <p>
            Disclaimer: Numbr does not own telecom infrastructure. Connectivity is provided through partner networks. Platform capabilities are being developed and will expand over time.
          </p>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-8 border-t border-white/5">
          <p className="text-sm font-medium text-[#C9A84C]">
            Numbr — A company of AR Holdings Group Corporation
          </p>
          <p className="text-sm text-white/30">
            © {new Date().getFullYear()} Numbr. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
