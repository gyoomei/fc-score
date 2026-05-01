"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "square" | "star";
}

interface ScoreRevealParticlesProps {
  active: boolean;
  tierColor: string;
}

const GOLD = "#c9a227";
const GOLD_LIGHT = "#f0c040";
const WHITE = "#ffffff";

function getTierPalette(tierColor: string): string[] {
  return [
    tierColor,
    GOLD,
    GOLD_LIGHT,
    WHITE,
    tierColor + "cc",
    "#a855f7",
    "#3b82f6",
  ];
}

function createParticle(
  canvas: HTMLCanvasElement,
  colors: string[]
): Particle {
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.38; // near score ring center
  const angle = Math.random() * Math.PI * 2;
  const speed = 3 + Math.random() * 7;

  return {
    x: cx + (Math.random() - 0.5) * 60,
    y: cy + (Math.random() - 0.5) * 60,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 3, // slight upward bias
    size: 3 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 1,
    decay: 0.013 + Math.random() * 0.012,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.3,
    shape: (["circle", "square", "star"] as const)[
      Math.floor(Math.random() * 3)
    ],
  };
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  const spikes = 5;
  const outerR = size;
  const innerR = size * 0.4;
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(x, y - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(
      x + Math.cos(rot) * outerR,
      y + Math.sin(rot) * outerR
    );
    rot += step;
    ctx.lineTo(
      x + Math.cos(rot) * innerR,
      y + Math.sin(rot) * innerR
    );
    rot += step;
  }
  ctx.lineTo(x, y - outerR);
  ctx.closePath();
  ctx.fill();
}

export function ScoreRevealParticles({
  active,
  tierColor,
}: ScoreRevealParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const burstDoneRef = useRef(false);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const colors = getTierPalette(tierColor);
    burstDoneRef.current = false;

    // Initial burst — 120 particles
    for (let i = 0; i < 120; i++) {
      particlesRef.current.push(createParticle(canvas, colors));
    }

    // Secondary burst after 180ms
    const timer = setTimeout(() => {
      for (let i = 0; i < 60; i++) {
        particlesRef.current.push(createParticle(canvas, colors));
      }
    }, 180);

    function animate() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0.02);

      for (const p of particlesRef.current) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "square") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          drawStar(ctx, 0, 0, p.size / 2);
        }

        ctx.restore();

        // physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18; // gravity
        p.vx *= 0.98; // air drag
        p.alpha -= p.decay;
        p.rotation += p.rotationSpeed;
      }

      if (particlesRef.current.length > 0) {
        animRef.current = requestAnimationFrame(animate);
      }
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      clearTimeout(timer);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      particlesRef.current = [];
    };
  }, [active, tierColor]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
