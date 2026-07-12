import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    const onResize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener("resize", onResize);

    // Particles
    const NUM_PARTICLES = 180;
    const particles = Array.from({ length: NUM_PARTICLES }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      alpha: Math.random() * 0.55 + 0.1,
    }));

    // Globe arcs
    const cx = width * 0.72;
    const cy = height * 0.5;
    const globeR = Math.min(width, height) * 0.28;
    const NUM_LATS = 10;
    const NUM_LONS = 14;

    // Communication arcs between "cities"
    const cities = [
      { lat: 40.7, lon: -74 },
      { lat: 51.5, lon: -0.1 },
      { lat: 35.7, lon: 139.7 },
      { lat: -33.9, lon: 151.2 },
      { lat: 48.8, lon: 2.3 },
      { lat: 1.3, lon: 103.8 },
      { lat: 25.2, lon: 55.3 },
      { lat: 19.4, lon: -99.1 },
    ];

    function latLonTo2D(lat: number, lon: number, tilt: number) {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + tilt) * (Math.PI / 180);
      const x3 = Math.sin(phi) * Math.cos(theta);
      const z3 = Math.cos(phi);
      const xScreen = cx + globeR * x3;
      const yScreen = cy - globeR * z3;
      const visible = Math.sin(phi) * Math.sin(theta) > -0.1;
      return { x: xScreen, y: yScreen, visible };
    }

    let t = 0;

    function drawGlobe(tilt: number) {
      // Glow behind globe
      const grd = ctx!.createRadialGradient(cx, cy, 0, cx, cy, globeR * 1.6);
      grd.addColorStop(0, "rgba(201,168,76,0.06)");
      grd.addColorStop(1, "rgba(5,5,8,0)");
      ctx!.fillStyle = grd;
      ctx!.beginPath();
      ctx!.arc(cx, cy, globeR * 1.6, 0, Math.PI * 2);
      ctx!.fill();

      // Base sphere
      const sphereGrd = ctx!.createRadialGradient(cx - globeR * 0.2, cy - globeR * 0.2, globeR * 0.05, cx, cy, globeR);
      sphereGrd.addColorStop(0, "rgba(16,16,28,0.95)");
      sphereGrd.addColorStop(1, "rgba(5,5,8,0.98)");
      ctx!.beginPath();
      ctx!.arc(cx, cy, globeR, 0, Math.PI * 2);
      ctx!.fillStyle = sphereGrd;
      ctx!.fill();

      // Latitude lines
      ctx!.save();
      for (let i = 1; i < NUM_LATS; i++) {
        const lat = -90 + (180 / NUM_LATS) * i;
        const phi = (90 - lat) * (Math.PI / 180);
        const yr = cy - globeR * Math.cos(phi);
        const xr = globeR * Math.sin(phi);
        ctx!.beginPath();
        ctx!.ellipse(cx, yr, xr, xr * 0.08, 0, 0, Math.PI * 2);
        ctx!.strokeStyle = "rgba(201,168,76,0.1)";
        ctx!.lineWidth = 0.8;
        ctx!.stroke();
      }

      // Longitude lines
      for (let i = 0; i < NUM_LONS; i++) {
        const lon = (360 / NUM_LONS) * i + tilt;
        const theta = lon * (Math.PI / 180);
        ctx!.beginPath();
        let first = true;
        for (let step = 0; step <= 64; step++) {
          const phi = (step / 64) * Math.PI;
          const x3 = Math.sin(phi) * Math.cos(theta);
          const z3 = Math.cos(phi);
          const side = Math.sin(phi) * Math.sin(theta);
          const xS = cx + globeR * x3;
          const yS = cy - globeR * z3;
          const alpha = side > 0 ? 0.18 : 0.04;
          ctx!.strokeStyle = `rgba(201,168,76,${alpha})`;
          ctx!.lineWidth = 0.8;
          if (first) { ctx!.moveTo(xS, yS); first = false; }
          else ctx!.lineTo(xS, yS);
        }
        ctx!.stroke();
      }
      ctx!.restore();

      // City dots + comm arcs
      const tiltDeg = tilt;
      cities.forEach((city, ci) => {
        const p = latLonTo2D(city.lat, city.lon, tiltDeg);
        if (!p.visible) return;
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + ci * 0.9);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 2.5 + pulse * 1.5, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(201,168,76,${0.5 + pulse * 0.4})`;
        ctx!.fill();

        // Arc to next city
        const ci2 = (ci + 3) % cities.length;
        const p2 = latLonTo2D(cities[ci2].lat, cities[ci2].lon, tiltDeg);
        if (!p2.visible) return;

        const arcProgress = (Math.sin(t * 0.4 + ci * 0.7) * 0.5 + 0.5);
        const midX = (p.x + p2.x) / 2;
        const midY = (p.y + p2.y) / 2 - 60;
        ctx!.beginPath();
        ctx!.moveTo(p.x, p.y);
        ctx!.quadraticCurveTo(midX, midY, p.x + (p2.x - p.x) * arcProgress, p.y + (p2.y - p.y) * arcProgress);
        ctx!.strokeStyle = `rgba(201,168,76,${0.08 + arcProgress * 0.12})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      });

      // Edge glow ring
      const ringGrd = ctx!.createRadialGradient(cx, cy, globeR * 0.85, cx, cy, globeR * 1.05);
      ringGrd.addColorStop(0, "rgba(201,168,76,0)");
      ringGrd.addColorStop(0.7, "rgba(201,168,76,0.06)");
      ringGrd.addColorStop(1, "rgba(201,168,76,0)");
      ctx!.beginPath();
      ctx!.arc(cx, cy, globeR, 0, Math.PI * 2);
      ctx!.strokeStyle = ringGrd;
      ctx!.lineWidth = 8;
      ctx!.stroke();
    }

    function drawParticles() {
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(201,168,76,${p.alpha * 0.6})`;
        ctx!.fill();
      });
    }

    function tick() {
      t += 0.008;
      ctx!.clearRect(0, 0, width, height);

      // Background gradient
      const bg = ctx!.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#050508");
      bg.addColorStop(0.5, "#0a0a14");
      bg.addColorStop(1, "#050508");
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, width, height);

      drawParticles();
      drawGlobe(t * 8);

      // Radial vignette overlay
      const vignette = ctx!.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
      vignette.addColorStop(0, "rgba(5,5,8,0)");
      vignette.addColorStop(1, "rgba(5,5,8,0.75)");
      ctx!.fillStyle = vignette;
      ctx!.fillRect(0, 0, width, height);

      animRef.current = requestAnimationFrame(tick);
    }

    tick();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: "block" }}
    />
  );
}

export function HeroSection() {
  return (
    <section className="relative h-[100dvh] w-full overflow-hidden bg-[#050508] flex items-center" id="hero">
      <HeroCanvas />

      {/* Content */}
      <div className="container relative z-10 mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-12 items-center">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 border border-[#C9A84C]/20 bg-[#C9A84C]/5 text-[#C9A84C] text-xs font-medium uppercase tracking-widest rounded-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
              Tau Phone · Now in Preview
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.08]">
              The Phone That<br />
              Was Built For A<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] via-[#E8C96D] to-[#C9A84C]">Borderless World.</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-xl md:text-2xl text-white/60 mb-6 font-light"
          >
            Meet Tau Phone with Numbr.
          </motion.p>

          <div className="space-y-2 mb-12 text-2xl md:text-3xl font-medium text-white/90">
            {["One identity.", "One ecosystem.", "One experience."].map((text, i) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.3, duration: 0.6, ease: "easeOut" }}
              >
                {text}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <button
              onClick={() => document.getElementById("tau-phone")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-gradient-to-r from-[#C9A84C] to-[#E8C96D] text-[#050508] px-8 py-4 text-sm font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              Explore Tau Phone
            </button>
            <button className="border border-[#C9A84C] text-[#C9A84C] px-8 py-4 text-sm font-bold uppercase tracking-wider hover:bg-[#C9A84C]/10 transition-colors">
              Reserve Early Access
            </button>
          </motion.div>
        </div>

        {/* CSS Phone */}
        <motion.div
          className="hidden lg:flex justify-center items-center h-full relative"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 1.5, ease: "easeOut" }}
          style={{ perspective: "1200px" }}
        >
          <motion.div
            animate={{ y: [0, -14, 0], rotateY: [-5, 5, -5] }}
            transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
            className="w-[290px] h-[600px] relative"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Outer frame */}
            <div className="absolute inset-0 rounded-[44px] bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] border border-[#2a2a2a] shadow-[0_0_80px_rgba(201,168,76,0.18),0_0_120px_rgba(201,168,76,0.06)]" />
            {/* Gold chamfer ring */}
            <div className="absolute inset-[1px] rounded-[43px] border border-[#C9A84C]/30" />
            {/* Side buttons */}
            <div className="absolute -right-[3px] top-[120px] w-[3px] h-[60px] bg-gradient-to-b from-[#C9A84C]/60 to-[#C9A84C]/30 rounded-r-sm" />
            <div className="absolute -left-[3px] top-[100px] w-[3px] h-[40px] bg-[#222] rounded-l-sm" />
            <div className="absolute -left-[3px] top-[150px] w-[3px] h-[40px] bg-[#222] rounded-l-sm" />
            {/* Screen */}
            <div className="absolute inset-[6px] rounded-[38px] bg-[#020204] overflow-hidden flex flex-col">
              {/* Screen glow */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(201,168,76,0.12)_0%,transparent_60%)]" />
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80px] h-[28px] bg-[#0a0a0a] rounded-b-2xl z-10" />
              {/* Content */}
              <div className="relative flex flex-col items-center justify-center h-full gap-5 px-6">
                <div className="text-[#C9A84C] font-serif italic text-4xl tracking-wide">Nümbr</div>
                <div className="w-14 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent" />
                <div className="text-white/30 text-[10px] tracking-[0.3em] uppercase">Booting System</div>
                <motion.div
                  className="w-24 h-px bg-[#C9A84C]/30 relative overflow-hidden"
                  initial={{}}
                >
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#C9A84C]/60 to-[#E8C96D]"
                    animate={{ width: ["0%", "100%", "0%"] }}
                    transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 1 }}
      >
        <span className="text-[10px] uppercase tracking-widest text-white/30">Scroll</span>
        <div className="w-px h-12 bg-white/10 relative overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#C9A84C] to-transparent"
            animate={{ top: ["-50%", "100%"] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          />
        </div>
      </motion.div>
    </section>
  );
}
