import { useRef, useEffect, useCallback, useState } from "react";
import { Pause, Play } from "lucide-react";

const WAVE_SPEED = 2;
const TRANSVERSE_COLOR = "hsl(210, 92%, 45%)";
const LONGITUDINAL_COLOR = "hsl(30, 80%, 55%)";
const SOURCE_X_RATIO = 0.08;
const NUM_POINTS = 800;
const LONG_PARTICLE_COUNT = 52;

export default function WaveSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const isDragging = useRef(false);
  const sourceY = useRef(0);
  const waveData = useRef<number[]>(new Array(NUM_POINTS).fill(0));
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const canvasSizeRef = useRef({ w: 0, h: 0 });
  const accumulatorRef = useRef(0);

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      const { h } = canvasSizeRef.current;
      if (pos.y > h / 2) return;
      canvas.setPointerCapture(e.pointerId);
      isDragging.current = true;
      const centerY = h / 4;
      sourceY.current = pos.y - centerY;
    },
    [getCanvasPos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      const { h } = canvasSizeRef.current;
      const centerY = h / 4;
      const maxAmp = (h / 2) * 0.38;
      sourceY.current = Math.max(-maxAmp, Math.min(maxAmp, pos.y - centerY));
    },
    [getCanvasPos],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.scale(dpr, dpr);
      canvasSizeRef.current = { w: rect.width, h: rect.height };
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = (timestamp: number) => {
      const { w, h } = canvasSizeRef.current;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const dt = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = timestamp;

      let steps = 0;
      if (!pausedRef.current) {
        const clampedDt = Math.min(dt, 0.05);
        accumulatorRef.current += clampedDt * WAVE_SPEED * 60;
        steps = Math.min(Math.floor(accumulatorRef.current), 20);
        accumulatorRef.current -= steps;
      }

      const data = waveData.current;
      for (let s = 0; s < steps; s++) {
        for (let i = data.length - 1; i > 0; i--) data[i] = data[i - 1];
        if (isDragging.current) {
          data[0] = sourceY.current;
        } else {
          data[0] = data[0] * 0.92;
        }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "hsl(220, 13%, 7%)";
      ctx.fillRect(0, 0, w, h);

      const dividerY = h / 2;
      const sourceXPx = w * SOURCE_X_RATIO;
      const waveWidth = w - sourceXPx;

      // ─── Labels ───────────────────────────────────────────────
      ctx.font = "bold 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.textAlign = "left";
      ctx.fillText("橫波  Transverse Wave", sourceXPx + 8, 18);
      ctx.fillStyle = "rgba(255,200,100,0.45)";
      ctx.fillText("縱波  Longitudinal Wave", sourceXPx + 8, dividerY + 18);

      // ─── Divider ──────────────────────────────────────────────
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, dividerY);
      ctx.lineTo(w, dividerY);
      ctx.stroke();

      // ═══════════════════════════════════════════════
      //  TRANSVERSE WAVE (top half)
      // ═══════════════════════════════════════════════
      const tCenterY = h / 4;

      // grid (top half)
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      const gridSpacing = 40;
      for (let x = sourceXPx; x < w; x += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dividerY); ctx.stroke();
      }
      for (let y = tCenterY % gridSpacing; y < dividerY; y += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // equilibrium line
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(0, tCenterY); ctx.lineTo(w, tCenterY); ctx.stroke();
      ctx.setLineDash([]);

      // wave glow
      const tGlowGrad = ctx.createLinearGradient(sourceXPx, 0, w, 0);
      tGlowGrad.addColorStop(0, "hsla(210, 92%, 45%, 0.3)");
      tGlowGrad.addColorStop(1, "hsla(210, 92%, 45%, 0.0)");
      ctx.strokeStyle = tGlowGrad;
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < NUM_POINTS; i++) {
        const x = sourceXPx + (i / NUM_POINTS) * waveWidth;
        const y = tCenterY + data[i];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // wave line
      ctx.strokeStyle = TRANSVERSE_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < NUM_POINTS; i++) {
        const x = sourceXPx + (i / NUM_POINTS) * waveWidth;
        const y = tCenterY + data[i];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // dots on wave
      const tDotSpacing = Math.floor(NUM_POINTS / 30);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < NUM_POINTS; i += tDotSpacing) {
        const x = sourceXPx + (i / NUM_POINTS) * waveWidth;
        const y = tCenterY + data[i];
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      // midpoint highlight (transverse)
      const midIndex = Math.floor(NUM_POINTS / 2);
      const tMidX = sourceXPx + (midIndex / NUM_POINTS) * waveWidth;
      const tMidY = tCenterY + data[midIndex];
      const tMidDisp = Math.abs(data[midIndex]);

      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(tMidX, tCenterY - 6); ctx.lineTo(tMidX, tMidY); ctx.stroke();
      ctx.setLineDash([]);

      if (tMidDisp > 1) {
        const dir = data[midIndex] > 0 ? 1 : -1;
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.moveTo(tMidX - 4, tCenterY - dir * 8);
        ctx.lineTo(tMidX + 4, tCenterY - dir * 8);
        ctx.lineTo(tMidX, tCenterY - dir * 14);
        ctx.closePath(); ctx.fill();
      }

      ctx.save();
      const tGlowI = Math.min(tMidDisp / 40, 1);
      ctx.shadowColor = "white"; ctx.shadowBlur = 16 + tGlowI * 20;
      ctx.beginPath();
      ctx.arc(tMidX, tMidY, 7 + tGlowI * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.7 + tGlowI * 0.3})`; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(tMidX, tMidY, 4, 0, Math.PI * 2);
      ctx.fillStyle = TRANSVERSE_COLOR; ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "12px 'Open Sans', sans-serif"; ctx.textAlign = "center";
      ctx.fillText("介質質點", tMidX, tMidY < tCenterY ? tMidY + 26 : tMidY - 16);

      // source dot (transverse)
      const srcDisplayY = tCenterY + data[0];
      ctx.save();
      ctx.shadowColor = TRANSVERSE_COLOR;
      ctx.shadowBlur = isDragging.current ? 25 : 12;
      ctx.beginPath();
      ctx.arc(sourceXPx, srcDisplayY, isDragging.current ? 14 : 10, 0, Math.PI * 2);
      ctx.fillStyle = TRANSVERSE_COLOR; ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(sourceXPx, srcDisplayY, isDragging.current ? 14 : 10, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1;

      // guide line & arrows on source
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(sourceXPx, 30); ctx.lineTo(sourceXPx, dividerY - 30); ctx.stroke();
      ctx.setLineDash([]);
      const aS = 10;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.moveTo(sourceXPx - aS/2, 40); ctx.lineTo(sourceXPx + aS/2, 40); ctx.lineTo(sourceXPx, 30); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sourceXPx - aS/2, dividerY - 40); ctx.lineTo(sourceXPx + aS/2, dividerY - 40); ctx.lineTo(sourceXPx, dividerY - 30); ctx.closePath(); ctx.fill();

      if (!isDragging.current && Math.abs(data[0]) < 1) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "14px 'Open Sans', sans-serif"; ctx.textAlign = "center";
        const isTouch = "ontouchstart" in window;
        ctx.fillText(isTouch ? "用手指按住並上下拖動" : "按住滑鼠並上下拖動", sourceXPx, srcDisplayY - 28);
      }

      // ═══════════════════════════════════════════════
      //  LONGITUDINAL WAVE (bottom half)
      // ═══════════════════════════════════════════════
      const lCenterY = dividerY + h / 4;

      // grid (bottom half)
      ctx.strokeStyle = "rgba(255,180,80,0.04)";
      ctx.lineWidth = 1;
      for (let x = sourceXPx; x < w; x += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(x, dividerY); ctx.lineTo(x, h); ctx.stroke();
      }

      // equilibrium line
      ctx.strokeStyle = "rgba(255,180,80,0.15)";
      ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(sourceXPx, lCenterY); ctx.lineTo(w, lCenterY); ctx.stroke();
      ctx.setLineDash([]);

      // particles: sample waveData at evenly-spaced positions
      const particleSpacing = waveWidth / LONG_PARTICLE_COUNT;
      const maxDispScale = particleSpacing * 0.45;
      const particleR = 5;

      for (let p = 0; p < LONG_PARTICLE_COUNT; p++) {
        const nominalX = sourceXPx + (p + 0.5) * particleSpacing;
        const dataIndex = Math.round((p / LONG_PARTICLE_COUNT) * NUM_POINTS);
        const displacement = data[dataIndex] * maxDispScale / ((h / 4) * 0.38);
        const px = nominalX + displacement;

        const nextDataIndex = Math.round(((p + 1) / LONG_PARTICLE_COUNT) * NUM_POINTS);
        const nextDisp = data[Math.min(nextDataIndex, NUM_POINTS - 1)] * maxDispScale / ((h / 4) * 0.38);
        const nextX = sourceXPx + (p + 1.5) * particleSpacing + nextDisp;
        const gap = nextX - px;
        const minGap = particleSpacing * 0.3;
        const maxGap = particleSpacing * 1.7;
        const compressionRatio = Math.max(0, Math.min(1, (gap - minGap) / (maxGap - minGap)));

        const r = Math.round(220 + compressionRatio * 35);
        const g = Math.round(120 - compressionRatio * 70);
        const b = Math.round(40 + compressionRatio * 15);
        const alpha = 0.55 + (1 - compressionRatio) * 0.45;

        ctx.save();
        ctx.shadowColor = `rgba(${r},${g},${b},0.6)`;
        ctx.shadowBlur = 4 + (1 - compressionRatio) * 6;
        ctx.beginPath();
        ctx.arc(px, lCenterY, particleR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
        ctx.restore();
      }

      // midpoint highlight (longitudinal)
      const lMidP = Math.floor(LONG_PARTICLE_COUNT / 2);
      const lMidNomX = sourceXPx + (lMidP + 0.5) * particleSpacing;
      const lMidDataIdx = Math.round((lMidP / LONG_PARTICLE_COUNT) * NUM_POINTS);
      const lMidDisp = data[lMidDataIdx] * maxDispScale / ((h / 4) * 0.38);
      const lMidX = lMidNomX + lMidDisp;
      const lMidDispAbs = Math.abs(lMidDisp);

      ctx.strokeStyle = "rgba(255,200,100,0.2)";
      ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(lMidX, lCenterY - 18); ctx.lineTo(lMidX, lCenterY + 18); ctx.stroke();
      ctx.setLineDash([]);

      if (lMidDispAbs > 0.5) {
        const lDir = lMidDisp > 0 ? 1 : -1;
        ctx.fillStyle = "rgba(255,200,100,0.35)";
        ctx.beginPath();
        ctx.moveTo(lMidX + lDir * 14, lCenterY - 4);
        ctx.lineTo(lMidX + lDir * 14, lCenterY + 4);
        ctx.lineTo(lMidX + lDir * 20, lCenterY);
        ctx.closePath(); ctx.fill();
      }

      ctx.save();
      const lGlowI = Math.min(lMidDispAbs / 8, 1);
      ctx.shadowColor = "rgba(255,200,80,0.9)"; ctx.shadowBlur = 12 + lGlowI * 16;
      ctx.beginPath();
      ctx.arc(lMidX, lCenterY, 7 + lGlowI * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.65 + lGlowI * 0.35})`; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(lMidX, lCenterY, 4, 0, Math.PI * 2);
      ctx.fillStyle = LONGITUDINAL_COLOR; ctx.fill();
      ctx.fillStyle = "rgba(255,200,100,0.55)";
      ctx.font = "12px 'Open Sans', sans-serif"; ctx.textAlign = "center";
      ctx.fillText("介質質點", lMidX, lCenterY + 26);

      // source block for longitudinal (left edge)
      const lSrcDisp = data[0] * maxDispScale / ((h / 4) * 0.38);
      ctx.save();
      ctx.shadowColor = LONGITUDINAL_COLOR; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(sourceXPx + lSrcDisp, lCenterY, 10, 0, Math.PI * 2);
      ctx.fillStyle = LONGITUDINAL_COLOR; ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(sourceXPx + lSrcDisp, lCenterY, 10, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      pausedRef.current = !prev;
      return !prev;
    });
  }, []);

  const resetWave = useCallback(() => {
    waveData.current = new Array(NUM_POINTS).fill(0);
    sourceY.current = 0;
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[hsl(220,13%,7%)] text-white select-none overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight" data-testid="text-title">
            波動傳播模擬器
          </h1>
          <p className="text-xs sm:text-sm text-white/45 mt-0.5" data-testid="text-subtitle">
            Wave Propagation Simulator
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-lg transition-all duration-200 ${
              paused
                ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                : "bg-white/10 hover:bg-white/20"
            }`}
            data-testid="button-pause"
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
            {paused ? "繼續" : "暫停"}
          </button>
          <button
            onClick={resetWave}
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            data-testid="button-reset"
          >
            重置
          </button>
        </div>
      </header>

      <div ref={containerRef} className="flex-1 relative cursor-grab active:cursor-grabbing">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          data-testid="canvas-wave"
        />
      </div>
    </div>
  );
}
