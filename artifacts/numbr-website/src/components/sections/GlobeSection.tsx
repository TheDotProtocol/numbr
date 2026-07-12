import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

function GlobeCanvas() {
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

    const cx = width / 2;
    const cy = height / 2;
    const globeR = Math.min(width, height) * 0.38;
    const NUM_LATS = 12;
    const NUM_LONS = 18;

    // Country highlight dots (lat/lon clusters)
    const hotspots = [
      { lat: 40.7, lon: -74, name: "New York" },
      { lat: 51.5, lon: -0.1, name: "London" },
      { lat: 35.7, lon: 139.7, name: "Tokyo" },
      { lat: -33.9, lon: 151.2, name: "Sydney" },
      { lat: 48.8, lon: 2.3, name: "Paris" },
      { lat: 1.3, lon: 103.8, name: "Singapore" },
      { lat: 25.2, lon: 55.3, name: "Dubai" },
      { lat: 19.4, lon: -99.1, name: "Mexico City" },
      { lat: -23.5, lon: -46.6, name: "São Paulo" },
      { lat: 28.6, lon: 77.2, name: "Delhi" },
      { lat: 31.2, lon: 121.5, name: "Shanghai" },
      { lat: -26.2, lon: 28.0, name: "Johannesburg" },
    ];

    function latLonTo2D(lat: number, lon: number, tiltDeg: number) {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + tiltDeg) * (Math.PI / 180);
      const x3 = Math.sin(phi) * Math.cos(theta);
      const z3 = Math.cos(phi);
      const depth = Math.sin(phi) * Math.sin(theta); // -1 back, +1 front
      const xS = cx + globeR * x3;
      const yS = cy - globeR * z3;
      return { x: xS, y: yS, depth, visible: depth > -0.15 };
    }

    let t = 0;

    function draw() {
      t += 0.006;
      ctx.clearRect(0, 0, width, height);

      const tiltDeg = t * 6; // degrees per second-ish

      // Background
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, width, height);

      // Outer atmosphere glow
      const atmosGrd = ctx.createRadialGradient(cx, cy, globeR * 0.8, cx, cy, globeR * 1.5);
      atmosGrd.addColorStop(0, "rgba(201,168,76,0.04)");
      atmosGrd.addColorStop(0.5, "rgba(201,168,76,0.02)");
      atmosGrd.addColorStop(1, "rgba(5,5,8,0)");
      ctx.fillStyle = atmosGrd;
      ctx.beginPath();
      ctx.arc(cx, cy, globeR * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Base sphere
      const sphereGrd = ctx.createRadialGradient(
        cx - globeR * 0.25, cy - globeR * 0.25, globeR * 0.05,
        cx, cy, globeR
      );
      sphereGrd.addColorStop(0, "rgba(18,18,30,1)");
      sphereGrd.addColorStop(0.6, "rgba(8,8,16,1)");
      sphereGrd.addColorStop(1, "rgba(3,3,8,1)");
      ctx.beginPath();
      ctx.arc(cx, cy, globeR, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrd;
      ctx.fill();

      // Latitude lines
      for (let i = 1; i < NUM_LATS; i++) {
        const lat = -90 + (180 / NUM_LATS) * i;
        const phi = (90 - lat) * (Math.PI / 180);
        const yr = cy - globeR * Math.cos(phi);
        const xr = globeR * Math.sin(phi);
        // fade based on whether it's front/back hemisphere
        ctx.beginPath();
        ctx.ellipse(cx, yr, xr, xr * 0.07, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(201,168,76,0.12)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // Longitude lines with front/back alpha
      for (let i = 0; i < NUM_LONS; i++) {
        const lon = (360 / NUM_LONS) * i + tiltDeg;
        const theta = lon * (Math.PI / 180);
        ctx.beginPath();
        let first = true;
        for (let step = 0; step <= 80; step++) {
          const phi = (step / 80) * Math.PI;
          const x3 = Math.sin(phi) * Math.cos(theta);
          const z3 = Math.cos(phi);
          const depth = Math.sin(phi) * Math.sin(theta);
          const alpha = depth > 0 ? 0.2 : 0.04;
          const xS = cx + globeR * x3;
          const yS = cy - globeR * z3;
          if (first) {
            ctx.moveTo(xS, yS);
            first = false;
          } else {
            ctx.strokeStyle = `rgba(201,168,76,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.lineTo(xS, yS);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(xS, yS);
          }
        }
      }

      // Communication arcs (animated)
      for (let i = 0; i < hotspots.length; i++) {
        const ci2 = (i + 4) % hotspots.length;
        const p1 = latLonTo2D(hotspots[i].lat, hotspots[i].lon, tiltDeg);
        const p2 = latLonTo2D(hotspots[ci2].lat, hotspots[ci2].lon, tiltDeg);
        if (!p1.visible || !p2.visible) continue;

        const progress = (Math.sin(t * 0.5 + i * 0.8) * 0.5 + 0.5);
        const midX = (p1.x + p2.x) / 2;
        const midY = Math.min(p1.y, p2.y) - 50;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(
          midX, midY,
          p1.x + (p2.x - p1.x) * progress,
          p1.y + (p2.y - p1.y) * progress
        );
        ctx.strokeStyle = `rgba(201,168,76,${0.06 + progress * 0.1})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Hotspot city dots
      hotspots.forEach((city, ci) => {
        const p = latLonTo2D(city.lat, city.lon, tiltDeg);
        if (!p.visible) return;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + ci * 1.1);
        const alpha = 0.4 + pulse * 0.5;

        // Ripple
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 + pulse * 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(201,168,76,${0.08 * pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${alpha})`;
        ctx.fill();

        // Gold glow on dot
        const dotGrd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 8);
        dotGrd.addColorStop(0, `rgba(232,201,109,${0.3 * pulse})`);
        dotGrd.addColorStop(1, "rgba(201,168,76,0)");
        ctx.fillStyle = dotGrd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
      });

      // Rim light on sphere edge
      const rimGrd = ctx.createRadialGradient(cx, cy, globeR * 0.88, cx, cy, globeR * 1.02);
      rimGrd.addColorStop(0, "rgba(201,168,76,0)");
      rimGrd.addColorStop(0.7, "rgba(201,168,76,0.08)");
      rimGrd.addColorStop(1, "rgba(201,168,76,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, globeR, 0, Math.PI * 2);
      ctx.strokeStyle = rimGrd;
      ctx.lineWidth = 10;
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full opacity-80"
      style={{ display: "block" }}
    />
  );
}

const stats = [
  { value: "190+", label: "Countries in vision" },
  { value: "1", label: "Persistent identity" },
  { value: "∞", label: "Possible connections" },
];

export function GlobeSection() {
  return (
    <section
      id="global"
      className="relative min-h-[110vh] w-full bg-[#050508] flex flex-col justify-between overflow-hidden py-32"
    >
      {/* Canvas Globe */}
      <div className="absolute inset-0 z-0">
        <GlobeCanvas />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050508] via-transparent to-[#050508] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050508] via-transparent to-[#050508] pointer-events-none" />
      </div>

      <div className="container relative z-10 mx-auto px-6 lg:px-12 text-center pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-4 text-[#C9A84C] text-xs font-semibold uppercase tracking-[0.3em]"
        >
          Global Vision
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white mb-6"
        >
          Connecting the World.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/20">
            One Identity at a Time.
          </span>
        </motion.h2>
      </div>

      <div className="container relative z-10 mx-auto px-6 lg:px-12 pb-20">
        <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-4xl mx-auto">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="text-center p-8 border border-white/5 bg-white/[0.02] backdrop-blur-xl"
            >
              <div className="text-5xl md:text-6xl font-bold text-[#C9A84C] mb-2">{stat.value}</div>
              <div className="text-sm uppercase tracking-widest text-white/50">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="max-w-3xl mx-auto text-center space-y-6"
        >
          <p className="text-white/40 text-sm md:text-base leading-relaxed">
            Numbr separates identity from geography — while working within applicable telecom regulations in every market.
            Connectivity is provided through partner infrastructure and evolves as the platform grows.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="px-4 py-1.5 border border-white/10 text-white/40 text-xs uppercase tracking-wider">Available Today</span>
            <span className="px-4 py-1.5 border border-[#C9A84C]/30 text-[#C9A84C] bg-[#C9A84C]/5 text-xs uppercase tracking-wider">Partner-Enabled</span>
            <span className="px-4 py-1.5 border border-white/10 text-white/40 text-xs uppercase tracking-wider">Expanding</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
