import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Star, Zap, Globe, Phone, Crown, Shuffle } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateRandom5(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

const fancyNumbers = [
  { number: "11111", price: 2500, label: "Quintuple", rarity: "Ultra Rare" },
  { number: "12345", price: 1800, label: "Sequential", rarity: "Rare" },
  { number: "00001", price: 3500, label: "Origin", rarity: "Legendary" },
  { number: "88888", price: 2000, label: "Lucky Eight", rarity: "Rare" },
  { number: "11100", price: 1500, label: "Century", rarity: "Uncommon" },
  { number: "99999", price: 2800, label: "Infinity", rarity: "Ultra Rare" },
  { number: "10000", price: 1500, label: "Milestone", rarity: "Uncommon" },
  { number: "77777", price: 1900, label: "Lucky Seven", rarity: "Rare" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function PricingCard({
  tier,
  badge,
  spotsLeft,
  price,
  period,
  features,
  highlight,
  cta,
  onSelect,
}: {
  tier: string;
  badge?: string;
  spotsLeft?: number;
  price: string | number;
  period: string;
  features: string[];
  highlight: boolean;
  cta: string;
  onSelect: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative flex flex-col p-8 border transition-all duration-300 ${
        highlight
          ? "border-[#C9A84C] bg-gradient-to-b from-[#C9A84C]/8 to-transparent shadow-[0_0_60px_rgba(201,168,76,0.12)]"
          : "border-white/10 bg-white/[0.02] hover:border-white/20"
      }`}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#C9A84C] to-[#E8C96D] text-[#050508] text-[10px] font-black uppercase tracking-widest px-4 py-1">
          {badge}
        </div>
      )}

      <div className="mb-6">
        <div className="text-xs text-white/40 uppercase tracking-[0.3em] font-semibold mb-2">{tier}</div>
        <div className="flex items-end gap-2">
          <span className="text-5xl font-black text-white">
            {typeof price === "number" ? `$${price}` : price}
          </span>
          <span className="text-white/40 text-sm mb-2">{period}</span>
        </div>
        {spotsLeft !== undefined && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-sm ${
                    i < spotsLeft / 3 ? "bg-[#C9A84C]" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <span className="text-[#C9A84C] text-xs font-semibold">{spotsLeft} spots remaining</span>
          </div>
        )}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? "text-[#C9A84C]" : "text-white/40"}`} />
            <span className="text-white/70 leading-snug">{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        className={`w-full py-4 text-sm font-bold uppercase tracking-wider transition-all ${
          highlight
            ? "bg-gradient-to-r from-[#C9A84C] to-[#E8C96D] text-[#050508] hover:opacity-90"
            : "border border-white/20 text-white hover:border-[#C9A84C] hover:text-[#C9A84C]"
        }`}
      >
        {cta}
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Number Picker
// ---------------------------------------------------------------------------
function NumberPicker({ onNumberChange }: { onNumberChange: (n: string) => void }) {
  const [digits, setDigits] = useState(""); // empty = auto-assign

  const handleDigit = useCallback(
    (val: string) => {
      const cleaned = val.replace(/\D/g, "").slice(0, 5);
      setDigits(cleaned);
      onNumberChange(cleaned);
    },
    [onNumberChange]
  );

  const randomize = () => {
    const r = generateRandom5();
    setDigits(r);
    onNumberChange(r);
  };

  const display = digits.padEnd(5, "_");

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-white/40 text-xs uppercase tracking-[0.3em] font-semibold">Your Numbr ID</div>
      <div className="flex items-center gap-3 font-mono">
        <span className="text-3xl text-white/30 font-light">+1739</span>
        <span className="text-4xl font-black text-white tracking-widest">
          {display.split("").map((ch, i) => (
            <span key={i} className={ch === "_" ? "text-white/15" : "text-[#C9A84C]"}>
              {ch}
            </span>
          ))}
        </span>
      </div>
      <div className="flex gap-3 items-center">
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="Enter 5 digits"
          value={digits}
          onChange={(e) => handleDigit(e.target.value)}
          className="bg-white/5 border border-white/10 text-white text-center text-sm px-4 py-2 w-36 outline-none focus:border-[#C9A84C]/40 placeholder:text-white/20 font-mono"
        />
        <button
          onClick={randomize}
          className="p-2 border border-white/10 text-white/40 hover:text-[#C9A84C] hover:border-[#C9A84C]/30 transition-all"
          title="Randomize"
        >
          <Shuffle className="w-4 h-4" />
        </button>
      </div>
      <p className="text-white/25 text-[11px] text-center max-w-xs">
        Leave blank to auto-assign. You can choose a specific 5-digit suffix (availability confirmed at checkout).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reservation Form Modal
// ---------------------------------------------------------------------------
function ReservationModal({
  plan,
  number,
  onClose,
  mode,
}: {
  plan: "founding" | "standard" | "phone" | null;
  number: string;
  onClose: () => void;
  mode?: "phone";
}) {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [includePhone, setIncludePhone] = useState(mode === "phone");

  const planLabel =
    plan === "founding"
      ? "Founding Member — $20 Lifetime"
      : plan === "phone"
      ? "Tau Phone Pre-Book"
      : "Standard Plan — $60/month";

  const displayNumber = number ? `+1739 ${number}` : "+1739 (auto-assigned)";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0a0a10] border border-[#C9A84C]/20 p-8 max-w-md w-full relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors text-xl leading-none"
        >
          ×
        </button>

        {!submitted ? (
          <>
            <div className="mb-6">
              <div className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] mb-1">Reservation</div>
              <h3 className="text-2xl font-bold text-white">{planLabel}</h3>
              <div className="mt-2 font-mono text-white/50 text-sm">{displayNumber}</div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-white/40 text-xs uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 text-sm outline-none focus:border-[#C9A84C]/40 placeholder:text-white/20"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-white/40 text-xs uppercase tracking-wider block mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 text-sm outline-none focus:border-[#C9A84C]/40 placeholder:text-white/20"
                  placeholder="your@email.com"
                />
              </div>
              {plan !== "phone" && (
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includePhone}
                    onChange={(e) => setIncludePhone(e.target.checked)}
                    className="mt-1 accent-[#C9A84C]"
                  />
                  <span className="text-white/50 text-sm group-hover:text-white/70 transition-colors">
                    Also pre-book the <span className="text-[#C9A84C]">Tau Phone</span> with this number
                  </span>
                </label>
              )}

              <div className="border-t border-white/5 pt-4 text-xs text-white/30 leading-relaxed">
                By reserving, you agree to our Terms of Service. You will be contacted for payment details. Your spot is held for 48 hours after confirmation.
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#C9A84C] to-[#E8C96D] text-[#050508] py-4 font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                Confirm Reservation
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full border-2 border-[#C9A84C] flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-[#C9A84C]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">You're Reserved</h3>
            <p className="text-white/50 text-sm mb-2">
              Welcome to the founding circle, {name.split(" ")[0]}.
            </p>
            <div className="font-mono text-[#C9A84C] text-lg font-bold my-4">{displayNumber}</div>
            <p className="text-white/30 text-xs">
              We'll reach out to {email} within 24 hours with next steps.
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Fancy Numbers
// ---------------------------------------------------------------------------
function FancyNumberCard({
  num,
  onReserve,
}: {
  num: (typeof fancyNumbers)[0];
  onReserve: () => void;
}) {
  const rarityColor =
    num.rarity === "Legendary"
      ? "text-purple-400 border-purple-400/30 bg-purple-400/5"
      : num.rarity === "Ultra Rare"
      ? "text-[#E8C96D] border-[#E8C96D]/30 bg-[#E8C96D]/5"
      : num.rarity === "Rare"
      ? "text-[#C9A84C] border-[#C9A84C]/30 bg-[#C9A84C]/5"
      : "text-white/50 border-white/20 bg-white/3";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="border border-white/8 bg-white/[0.02] hover:border-[#C9A84C]/25 transition-all p-5 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-2xl font-black text-white tracking-wider">+1739 {num.number}</div>
          <div className="text-white/40 text-xs mt-1">{num.label}</div>
        </div>
        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 border ${rarityColor}`}>
          {num.rarity}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-white font-bold text-lg">${num.price.toLocaleString()}</div>
        <button
          onClick={onReserve}
          className="text-xs font-bold uppercase tracking-wider px-4 py-2 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors"
        >
          Reserve
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Section
// ---------------------------------------------------------------------------
export function ReserveSection() {
  const [selectedNumber, setSelectedNumber] = useState("");
  const [modal, setModal] = useState<{
    plan: "founding" | "standard" | "phone" | null;
    number: string;
  } | null>(null);

  const FOUNDING_SPOTS = 18; // demo — remaining out of 30

  return (
    <section id="reserve" className="py-32 bg-[#020204] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#C9A84C]/5 blur-[160px] rounded-full" />
      </div>

      <div className="container mx-auto px-6 lg:px-12">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="text-[#C9A84C] text-xs font-semibold uppercase tracking-[0.3em] mb-4">Early Access</div>
          <h2 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Reserve Your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] via-[#E8C96D] to-[#C9A84C]">
              Global Number.
            </span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            One number. Every country. Forever yours. Choose your Numbr ID — starting with <span className="text-[#C9A84C] font-mono font-semibold">+1739</span>.
          </p>
        </motion.div>

        {/* ── Number Picker ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-20"
        >
          <div className="border border-[#C9A84C]/15 bg-[#C9A84C]/3 px-10 py-8 inline-flex flex-col items-center gap-2">
            <NumberPicker onNumberChange={setSelectedNumber} />
          </div>
        </motion.div>

        {/* ── Pricing Tiers ── */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-24">
          <PricingCard
            tier="Founding Member"
            badge={`${FOUNDING_SPOTS} of 30 spots left`}
            spotsLeft={FOUNDING_SPOTS}
            price={20}
            period="one-time lifetime"
            highlight={true}
            cta="Reserve Founding Spot"
            onSelect={() => setModal({ plan: "founding", number: selectedNumber })}
            features={[
              "Unlimited 5G data across all countries",
              "Unlimited free calls to all networks globally",
              "Your chosen Numbr ID (+1739 XXXXX)",
              "Lifetime access — never pay again",
              "Founding Member badge & early feature access",
              "Priority onboarding & dedicated support",
            ]}
          />
          <PricingCard
            tier="Standard Plan"
            price={60}
            period="per month"
            highlight={false}
            cta="Reserve Standard Access"
            onSelect={() => setModal({ plan: "standard", number: selectedNumber })}
            features={[
              "Unlimited 5G data across all countries",
              "Unlimited calls to all networks globally",
              "Your chosen Numbr ID (+1739 XXXXX)",
              "Full Tau OS integration",
              "Cloud Contacts & Travel Mode",
              "Cancel anytime",
            ]}
          />
        </div>

        {/* ── Pre-book Tau Phone ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="mb-28"
        >
          <div className="border border-white/8 bg-white/[0.015] p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 max-w-4xl mx-auto">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Phone className="w-5 h-5 text-[#C9A84C]" />
                <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-semibold">Hardware</span>
              </div>
              <h3 className="text-3xl font-bold text-white mb-3">Pre-Book Tau Phone</h3>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                Reserve your Tau Phone now and have it arrive with your Numbr ID already activated. Pick your number at checkout — your identity ships with your device.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                {["Tau Phone + Numbr Bundle", "eSIM Pre-loaded", "Numbr ID Included", "Priority Shipping"].map((tag) => (
                  <span key={tag} className="border border-white/10 text-white/40 px-3 py-1 uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-center">
              <div className="text-white/30 text-xs uppercase tracking-wider mb-1">Starting from</div>
              <div className="text-4xl font-black text-white mb-1">TBA</div>
              <div className="text-white/30 text-xs mb-6">Pricing announced at launch</div>
              <button
                onClick={() => setModal({ plan: "phone", number: selectedNumber })}
                className="bg-gradient-to-r from-[#C9A84C] to-[#E8C96D] text-[#050508] px-8 py-3.5 text-sm font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                Pre-Book Now
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Fancy Numbers ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Crown className="w-5 h-5 text-[#C9A84C]" />
              <span className="text-[#C9A84C] text-xs uppercase tracking-[0.3em] font-semibold">Premium</span>
            </div>
            <h3 className="text-4xl md:text-5xl font-bold text-white mb-4">Fancy Numbers</h3>
            <p className="text-white/40 text-sm max-w-lg mx-auto">
              Own a one-of-a-kind Numbr ID. These rare number patterns are available exclusively to those who move first — starting at $1,500.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {fancyNumbers.map((fn, i) => (
              <FancyNumberCard
                key={i}
                num={fn}
                onReserve={() => setModal({ plan: "founding", number: fn.number })}
              />
            ))}
          </div>

          <div className="text-center mt-10">
            <p className="text-white/25 text-xs">
              Custom premium numbers available on request. Contact us for bespoke number acquisition. Minimum $1,500.
            </p>
          </div>
        </motion.div>

        {/* ── Trust signals ── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-20 pt-12 border-t border-white/5 grid sm:grid-cols-3 gap-8 text-center"
        >
          {[
            { icon: <Zap className="w-5 h-5 text-[#C9A84C]" />, title: "Instant Reservation", desc: "Your spot is secured immediately. No payment until launch." },
            { icon: <Globe className="w-5 h-5 text-[#C9A84C]" />, title: "Global Coverage", desc: "One number that works in every country, on every network." },
            { icon: <Star className="w-5 h-5 text-[#C9A84C]" />, title: "Founding Privileges", desc: "First 30 members get lifetime access at $20 — locked in forever." },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-3">
              <div className="p-3 border border-[#C9A84C]/20 bg-[#C9A84C]/5">{item.icon}</div>
              <div className="text-white font-semibold text-sm">{item.title}</div>
              <div className="text-white/35 text-xs leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <ReservationModal
            plan={modal.plan}
            number={modal.number}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
