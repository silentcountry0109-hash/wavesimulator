import { useRef, useEffect, useCallback } from "react";

const WAVE_SPEED = 2;
const WAVE_COLOR = "hsl(210, 92%, 45%)";
const SOURCE_X_RATIO = 0.08;
const NUM_POINTS = 800;

export default function WaveSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const sourceY = useRef(0);
  const waveData = useRef<number[]>(new Array(NUM_POINTS).fill(0));
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const canvasSizeRef = useRef({ w: 0, h: 0 });
  const accumulatorRef = useRef(0);

  const getCanvasPos = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      isDragging.current = true;
      const pos = getCanvasPos(e.clientX, e.clientY);
      const centerY = canvasSizeRef.current.h / 2;
      sourceY.current = pos.y - centerY;
    },
    [getCanvasPos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      const centerY = canvasSizeRef.current.h / 2;
      const maxAmp = centerY * 0.85;
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
      canvasSizeRef.current = {
        w: rect.width,
        h: rect.height,
      };
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = (timestamp: number) => {
      const { w, h } = canvasSizeRef.current;
      const dpr = window.devicePixelRatio || 1;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const dt = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = timestamp;

      const clampedDt = Math.min(dt, 0.05);
      accumulatorRef.current += clampedDt * WAVE_SPEED * 60;
      const steps = Math.min(Math.floor(accumulatorRef.current), 20);
      accumulatorRef.current -= steps;

      const data = waveData.current;

      for (let s = 0; s < steps; s++) {
        for (let i = data.length - 1; i > 0; i--) {
          data[i] = data[i - 1];
        }
        if (isDragging.current) {
          data[0] = sourceY.current;
        } else {
          data[0] = data[0] * 0.92;
        }
      }

      const centerY = h / 2;
      const sourceXPx = w * SOURCE_X_RATIO;
      const waveWidth = w - sourceXPx;

      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = "hsl(220, 13%, 7%)";
      ctx.fillRect(0, 0, w, h);

      const gridColor = "rgba(255,255,255,0.04)";
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      const gridSpacing = 40;
      for (let x = sourceXPx; x < w; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = centerY % gridSpacing; y < h; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      const glowGradient = ctx.createLinearGradient(sourceXPx, 0, w, 0);
      glowGradient.addColorStop(0, "hsla(210, 92%, 45%, 0.3)");
      glowGradient.addColorStop(1, "hsla(210, 92%, 45%, 0.0)");

      ctx.strokeStyle = glowGradient;
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < NUM_POINTS; i++) {
        const x = sourceXPx + (i / NUM_POINTS) * waveWidth;
        const y = centerY + data[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = WAVE_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < NUM_POINTS; i++) {
        const x = sourceXPx + (i / NUM_POINTS) * waveWidth;
        const y = centerY + data[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const dotCount = 30;
      const dotSpacing = Math.floor(NUM_POINTS / dotCount);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < NUM_POINTS; i += dotSpacing) {
        const x = sourceXPx + (i / NUM_POINTS) * waveWidth;
        const y = centerY + data[i];
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const midIndex = Math.floor(NUM_POINTS / 2);
      const midX = sourceXPx + (midIndex / NUM_POINTS) * waveWidth;
      const midY = centerY + data[midIndex];
      const midDisplacement = Math.abs(data[midIndex]);

      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(midX, centerY - 6);
      ctx.lineTo(midX, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (midDisplacement > 1) {
        const midArrowDir = data[midIndex] > 0 ? 1 : -1;
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.moveTo(midX - 4, centerY - midArrowDir * 8);
        ctx.lineTo(midX + 4, centerY - midArrowDir * 8);
        ctx.lineTo(midX, centerY - midArrowDir * 14);
        ctx.closePath();
        ctx.fill();
      }

      ctx.save();
      const glowIntensity = Math.min(midDisplacement / 40, 1);
      ctx.shadowColor = "white";
      ctx.shadowBlur = 16 + glowIntensity * 20;
      ctx.beginPath();
      ctx.arc(midX, midY, 7 + glowIntensity * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.7 + glowIntensity * 0.3})`;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(midX, midY, 4, 0, Math.PI * 2);
      ctx.fillStyle = WAVE_COLOR;
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "12px 'Open Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("介質質點", midX, midY < centerY ? midY + 26 : midY - 16);

      const srcDisplayY = centerY + data[0];

      ctx.save();
      ctx.shadowColor = WAVE_COLOR;
      ctx.shadowBlur = isDragging.current ? 25 : 12;
      ctx.beginPath();
      ctx.arc(sourceXPx, srcDisplayY, isDragging.current ? 14 : 10, 0, Math.PI * 2);
      ctx.fillStyle = WAVE_COLOR;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(sourceXPx, srcDisplayY, isDragging.current ? 14 : 10, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sourceXPx, 30);
      ctx.lineTo(sourceXPx, h - 30);
      ctx.stroke();
      ctx.setLineDash([]);

      const arrowSize = 10;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.moveTo(sourceXPx - arrowSize / 2, 40);
      ctx.lineTo(sourceXPx + arrowSize / 2, 40);
      ctx.lineTo(sourceXPx, 30);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(sourceXPx - arrowSize / 2, h - 40);
      ctx.lineTo(sourceXPx + arrowSize / 2, h - 40);
      ctx.lineTo(sourceXPx, h - 30);
      ctx.closePath();
      ctx.fill();

      if (!isDragging.current && Math.abs(data[0]) < 1) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "14px 'Open Sans', sans-serif";
        ctx.textAlign = "center";
        const isTouchDevice = "ontouchstart" in window;
        ctx.fillText(
          isTouchDevice ? "用手指按住並上下拖動" : "按住滑鼠並上下拖動",
          sourceXPx,
          srcDisplayY - 28,
        );
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const resetWave = useCallback(() => {
    waveData.current = new Array(NUM_POINTS).fill(0);
    sourceY.current = 0;
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[hsl(220,13%,7%)] text-white select-none overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10">
        <div>
          <h1
            className="text-lg sm:text-xl font-semibold tracking-tight"
            data-testid="text-title"
          >
            橫波傳播模擬器
          </h1>
          <p
            className="text-xs sm:text-sm text-white/50 mt-0.5"
            data-testid="text-subtitle"
          >
            Transverse Wave Propagation Simulator
          </p>
        </div>
        <button
          onClick={resetWave}
          className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          data-testid="button-reset"
        >
          重置
        </button>
      </header>

      <div
        ref={containerRef}
        className="flex-1 relative cursor-grab active:cursor-grabbing"
      >
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
