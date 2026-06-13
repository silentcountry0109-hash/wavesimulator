import { useRef, useEffect, useCallback, useState } from "react";
import { Pause, Play, Layers } from "lucide-react";
import { Slider } from "@/components/ui/slider";

const TRANSVERSE_COLOR = "hsl(210, 92%, 45%)";
const TRANSVERSE_GLOW = "hsla(210, 92%, 45%, 0.3)";
const WAVE_B_COLOR = "hsl(160, 84%, 42%)";
const WAVE_B_GLOW = "hsla(160, 84%, 42%, 0.3)";
const LONGITUDINAL_COLOR = "hsl(30, 80%, 55%)";
const SOURCE_X_RATIO = 0.08;
const NUM_POINTS = 800;
const LONG_PARTICLE_COUNT = 52;

interface WaveParams {
  speed: number; // 傳播速度倍率(每秒 shift speed*60 格)
  freq: number; // 波源頻率 Hz
  amp: number; // 波源振幅 px;0 = 純手動拖曳
}

const DEFAULT_PARAMS: WaveParams = { speed: 1.0, freq: 0.5, amp: 60 };

interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  testId: string;
}

function ParamSlider({ label, value, min, max, step, format, onChange, testId }: ParamSliderProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/55 w-7 shrink-0">{label}</span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="w-24 sm:w-32"
        data-testid={testId}
      />
      <span className="text-xs text-white/80 tabular-nums w-12 shrink-0">{format(value)}</span>
    </div>
  );
}

interface SliderGroupProps {
  title: string;
  accentClass: string;
  params: WaveParams;
  onChange: (p: WaveParams) => void;
  idPrefix: string;
}

function SliderGroup({ title, accentClass, params, onChange, idPrefix }: SliderGroupProps) {
  return (
    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
      <span className={`text-xs font-bold w-10 shrink-0 ${accentClass}`}>{title}</span>
      <ParamSlider
        label="波速"
        value={params.speed}
        min={0.5}
        max={4}
        step={0.1}
        format={(v) => `${v.toFixed(1)}×`}
        onChange={(v) => onChange({ ...params, speed: v })}
        testId={`slider-${idPrefix}-speed`}
      />
      <ParamSlider
        label="頻率"
        value={params.freq}
        min={0.1}
        max={2}
        step={0.1}
        format={(v) => `${v.toFixed(1)} Hz`}
        onChange={(v) => onChange({ ...params, freq: v })}
        testId={`slider-${idPrefix}-freq`}
      />
      <ParamSlider
        label="振幅"
        value={params.amp}
        min={0}
        max={120}
        step={5}
        format={(v) => (v === 0 ? "手動" : String(v))}
        onChange={(v) => onChange({ ...params, amp: v })}
        testId={`slider-${idPrefix}-amp`}
      />
    </div>
  );
}

export default function WaveSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [compare, setCompare] = useState(false);
  const [paramsA, setParamsA] = useState<WaveParams>(DEFAULT_PARAMS);
  const [paramsB, setParamsB] = useState<WaveParams>(DEFAULT_PARAMS);

  const pausedRef = useRef(false);
  const compareRef = useRef(false);
  const paramsARef = useRef(paramsA);
  const paramsBRef = useRef(paramsB);
  compareRef.current = compare;
  paramsARef.current = paramsA;
  paramsBRef.current = paramsB;

  const dragTarget = useRef<null | "A" | "B">(null);
  const dragY = useRef(0);
  const dataA = useRef<number[]>(new Array(NUM_POINTS).fill(0));
  const dataB = useRef<number[]>(new Array(NUM_POINTS).fill(0));
  const phaseA = useRef(0);
  const phaseB = useRef(0);
  const accA = useRef(0);
  const accB = useRef(0);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const canvasSizeRef = useRef({ w: 0, h: 0 });

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
      const target = pos.y < h / 2 ? "A" : compareRef.current ? "B" : null;
      if (!target) return;
      canvas.setPointerCapture(e.pointerId);
      dragTarget.current = target;
      const centerY = target === "A" ? h / 4 : (3 * h) / 4;
      const maxAmp = (h / 2) * 0.38;
      dragY.current = Math.max(-maxAmp, Math.min(maxAmp, pos.y - centerY));
    },
    [getCanvasPos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragTarget.current) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      const { h } = canvasSizeRef.current;
      const centerY = dragTarget.current === "A" ? h / 4 : (3 * h) / 4;
      const maxAmp = (h / 2) * 0.38;
      dragY.current = Math.max(-maxAmp, Math.min(maxAmp, pos.y - centerY));
    },
    [getCanvasPos],
  );

  const handlePointerUp = useCallback(() => {
    dragTarget.current = null;
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

    // 推進一組波:shift 波形陣列 + 依參數產生波源(拖曳優先於自動震盪)
    const advanceWave = (
      data: number[],
      params: WaveParams,
      phaseRef: React.MutableRefObject<number>,
      accRef: React.MutableRefObject<number>,
      dragging: boolean,
      clampedDt: number,
      maxAmp: number,
    ) => {
      accRef.current += clampedDt * params.speed * 60;
      const steps = Math.min(Math.floor(accRef.current), 40);
      accRef.current -= steps;
      // 相位每步推進 2πf/(每秒步數),確保實際時間頻率 = f,與波速無關
      const phasePerStep = (2 * Math.PI * params.freq) / (params.speed * 60);
      for (let s = 0; s < steps; s++) {
        for (let i = data.length - 1; i > 0; i--) data[i] = data[i - 1];
        phaseRef.current += phasePerStep;
        if (dragging) {
          data[0] = dragY.current;
        } else if (params.amp > 0) {
          data[0] = Math.min(params.amp, maxAmp) * Math.sin(phaseRef.current);
        } else {
          data[0] = data[0] * 0.92;
        }
      }
    };

    // 畫一組橫波(指定上下區域與顏色)
    const drawTransverse = (
      data: number[],
      regionTop: number,
      regionH: number,
      w: number,
      stroke: string,
      glow: string,
      label: string,
      dragging: boolean,
      showHint: boolean,
    ) => {
      const centerY = regionTop + regionH / 2;
      const sourceXPx = w * SOURCE_X_RATIO;
      const waveWidth = w - sourceXPx;
      const gridSpacing = 40;

      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let x = sourceXPx; x < w; x += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(x, regionTop); ctx.lineTo(x, regionTop + regionH); ctx.stroke();
      }
      for (let y = regionTop + ((centerY - regionTop) % gridSpacing); y < regionTop + regionH; y += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // label
      ctx.font = "bold 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.textAlign = "left";
      ctx.fillText(label, sourceXPx + 8, regionTop + 18);

      // equilibrium line
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(w, centerY); ctx.stroke();
      ctx.setLineDash([]);

      // wave glow
      const glowGrad = ctx.createLinearGradient(sourceXPx, 0, w, 0);
      glowGrad.addColorStop(0, glow);
      glowGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.strokeStyle = glowGrad;
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < NUM_POINTS; i++) {
        const x = sourceXPx + (i / NUM_POINTS) * waveWidth;
        const y = centerY + data[i];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // wave line
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < NUM_POINTS; i++) {
        const x = sourceXPx + (i / NUM_POINTS) * waveWidth;
        const y = centerY + data[i];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // dots on wave
      const dotSpacing = Math.floor(NUM_POINTS / 30);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < NUM_POINTS; i += dotSpacing) {
        const x = sourceXPx + (i / NUM_POINTS) * waveWidth;
        const y = centerY + data[i];
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      // midpoint highlight
      const midIndex = Math.floor(NUM_POINTS / 2);
      const midX = sourceXPx + (midIndex / NUM_POINTS) * waveWidth;
      const midY = centerY + data[midIndex];
      const midDisp = Math.abs(data[midIndex]);

      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(midX, centerY - 6); ctx.lineTo(midX, midY); ctx.stroke();
      ctx.setLineDash([]);

      if (midDisp > 1) {
        const dir = data[midIndex] > 0 ? 1 : -1;
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.moveTo(midX - 4, centerY - dir * 8);
        ctx.lineTo(midX + 4, centerY - dir * 8);
        ctx.lineTo(midX, centerY - dir * 14);
        ctx.closePath(); ctx.fill();
      }

      ctx.save();
      const glowI = Math.min(midDisp / 40, 1);
      ctx.shadowColor = "white"; ctx.shadowBlur = 16 + glowI * 20;
      ctx.beginPath();
      ctx.arc(midX, midY, 7 + glowI * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.7 + glowI * 0.3})`; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(midX, midY, 4, 0, Math.PI * 2);
      ctx.fillStyle = stroke; ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "12px 'Open Sans', sans-serif"; ctx.textAlign = "center";
      ctx.fillText("介質質點", midX, midY < centerY ? midY + 26 : midY - 16);

      // source dot
      const srcDisplayY = centerY + data[0];
      ctx.save();
      ctx.shadowColor = stroke;
      ctx.shadowBlur = dragging ? 25 : 12;
      ctx.beginPath();
      ctx.arc(sourceXPx, srcDisplayY, dragging ? 14 : 10, 0, Math.PI * 2);
      ctx.fillStyle = stroke; ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(sourceXPx, srcDisplayY, dragging ? 14 : 10, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1;

      // guide line & arrows on source
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(sourceXPx, regionTop + 30); ctx.lineTo(sourceXPx, regionTop + regionH - 30); ctx.stroke();
      ctx.setLineDash([]);
      const aS = 10;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.moveTo(sourceXPx - aS / 2, regionTop + 40); ctx.lineTo(sourceXPx + aS / 2, regionTop + 40); ctx.lineTo(sourceXPx, regionTop + 30); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sourceXPx - aS / 2, regionTop + regionH - 40); ctx.lineTo(sourceXPx + aS / 2, regionTop + regionH - 40); ctx.lineTo(sourceXPx, regionTop + regionH - 30); ctx.closePath(); ctx.fill();

      if (showHint && !dragging && Math.abs(data[0]) < 1) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "14px 'Open Sans', sans-serif"; ctx.textAlign = "center";
        const isTouch = "ontouchstart" in window;
        ctx.fillText(isTouch ? "用手指按住並上下拖動" : "按住滑鼠並上下拖動", sourceXPx, srcDisplayY - 28);
      }
    };

    // 畫縱波(下半部,跟隨指定波形資料)
    const drawLongitudinal = (data: number[], regionTop: number, regionH: number, w: number, h: number) => {
      const lCenterY = regionTop + regionH / 2;
      const sourceXPx = w * SOURCE_X_RATIO;
      const waveWidth = w - sourceXPx;
      const gridSpacing = 40;

      ctx.strokeStyle = "rgba(255,180,80,0.04)";
      ctx.lineWidth = 1;
      for (let x = sourceXPx; x < w; x += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(x, regionTop); ctx.lineTo(x, regionTop + regionH); ctx.stroke();
      }

      ctx.font = "bold 11px 'Open Sans', sans-serif";
      ctx.fillStyle = "rgba(255,200,100,0.45)";
      ctx.textAlign = "left";
      ctx.fillText("縱波  Longitudinal Wave", sourceXPx + 8, regionTop + 18);

      ctx.strokeStyle = "rgba(255,180,80,0.15)";
      ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(sourceXPx, lCenterY); ctx.lineTo(w, lCenterY); ctx.stroke();
      ctx.setLineDash([]);

      const particleSpacing = waveWidth / LONG_PARTICLE_COUNT;
      const maxDispScale = particleSpacing * 0.45;
      const particleR = 5;
      const ampNorm = (h / 4) * 0.38;

      for (let p = 0; p < LONG_PARTICLE_COUNT; p++) {
        const nominalX = sourceXPx + (p + 0.5) * particleSpacing;
        const dataIndex = Math.round((p / LONG_PARTICLE_COUNT) * NUM_POINTS);
        const displacement = (-data[dataIndex] * maxDispScale) / ampNorm;
        const px = nominalX + displacement;

        const nextDataIndex = Math.round(((p + 1) / LONG_PARTICLE_COUNT) * NUM_POINTS);
        const nextDisp = (-data[Math.min(nextDataIndex, NUM_POINTS - 1)] * maxDispScale) / ampNorm;
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

      // midpoint highlight
      const lMidP = Math.floor(LONG_PARTICLE_COUNT / 2);
      const lMidNomX = sourceXPx + (lMidP + 0.5) * particleSpacing;
      const lMidDataIdx = Math.round((lMidP / LONG_PARTICLE_COUNT) * NUM_POINTS);
      const lMidDisp = (-data[lMidDataIdx] * maxDispScale) / ampNorm;
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

      // source block
      const lSrcDisp = (-data[0] * maxDispScale) / ampNorm;
      ctx.save();
      ctx.shadowColor = LONGITUDINAL_COLOR; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(sourceXPx + lSrcDisp, lCenterY, 10, 0, Math.PI * 2);
      ctx.fillStyle = LONGITUDINAL_COLOR; ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(sourceXPx + lSrcDisp, lCenterY, 10, 0, Math.PI * 2);
      ctx.fillStyle = "white"; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
    };

    const draw = (timestamp: number) => {
      const { w, h } = canvasSizeRef.current;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const dt = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = timestamp;
      const clampedDt = pausedRef.current ? 0 : Math.min(dt, 0.05);

      const maxAmp = (h / 2) * 0.38;
      if (clampedDt > 0) {
        advanceWave(dataA.current, paramsARef.current, phaseA, accA, dragTarget.current === "A", clampedDt, maxAmp);
        if (compareRef.current) {
          advanceWave(dataB.current, paramsBRef.current, phaseB, accB, dragTarget.current === "B", clampedDt, maxAmp);
        }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "hsl(220, 13%, 7%)";
      ctx.fillRect(0, 0, w, h);

      const dividerY = h / 2;

      // divider
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, dividerY);
      ctx.lineTo(w, dividerY);
      ctx.stroke();

      if (compareRef.current) {
        const pA = paramsARef.current;
        const pB = paramsBRef.current;
        drawTransverse(
          dataA.current, 0, dividerY, w, TRANSVERSE_COLOR, TRANSVERSE_GLOW,
          `波 A｜波速 ${pA.speed.toFixed(1)}×｜頻率 ${pA.freq.toFixed(1)} Hz｜振幅 ${pA.amp}`,
          dragTarget.current === "A", false,
        );
        drawTransverse(
          dataB.current, dividerY, h - dividerY, w, WAVE_B_COLOR, WAVE_B_GLOW,
          `波 B｜波速 ${pB.speed.toFixed(1)}×｜頻率 ${pB.freq.toFixed(1)} Hz｜振幅 ${pB.amp}`,
          dragTarget.current === "B", false,
        );
      } else {
        drawTransverse(
          dataA.current, 0, dividerY, w, TRANSVERSE_COLOR, TRANSVERSE_GLOW,
          "橫波  Transverse Wave",
          dragTarget.current === "A", paramsARef.current.amp === 0,
        );
        drawLongitudinal(dataA.current, dividerY, h - dividerY, w, h);
      }

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
    dataA.current = new Array(NUM_POINTS).fill(0);
    dataB.current = new Array(NUM_POINTS).fill(0);
    phaseA.current = 0;
    phaseB.current = 0;
    dragY.current = 0;
  }, []);

  const toggleCompare = useCallback(() => {
    setCompare((prev) => {
      const next = !prev;
      if (next) {
        // 開啟比較:B 複製 A 當下參數,從相同條件開始改變單一變因
        setParamsB(paramsARef.current);
        dataB.current = new Array(NUM_POINTS).fill(0);
        phaseB.current = 0;
        accB.current = 0;
      }
      compareRef.current = next;
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[hsl(220,13%,7%)] text-white select-none overflow-hidden">
      <header
        className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10"
        style={{ borderTop: "2px solid var(--eureka-matcha)" }}
      >
        <div className="flex items-center gap-3">
          {/* 尤瑞卡科學品牌:水波紋標誌(深色底用反白版)— 同心圓擴散呼應波動主題 */}
          <img
            src="/eureka/mark-reversed.svg"
            alt="尤瑞卡科學 Eureka Science"
            className="w-9 h-9 sm:w-10 sm:h-10 shrink-0"
            data-testid="img-brand-mark"
          />
          <div className="flex flex-col">
            <h1
              className="text-lg sm:text-xl tracking-tight leading-tight"
              style={{ fontFamily: "var(--eureka-cjk)", fontWeight: 500 }}
              data-testid="text-title"
            >
              波動傳播模擬器
            </h1>
            <p className="flex items-center gap-2 mt-0.5 leading-none" data-testid="text-subtitle">
              <span
                className="text-xs sm:text-sm"
                style={{
                  fontFamily: "var(--eureka-cjk)",
                  fontWeight: 300,
                  letterSpacing: "0.18em",
                  color: "var(--eureka-soft)",
                }}
              >
                尤瑞卡科學
              </span>
              <span
                className="text-[10px] sm:text-xs"
                style={{
                  fontFamily: "var(--eureka-latin)",
                  letterSpacing: "0.28em",
                  color: "var(--eureka-matcha)",
                }}
              >
                EUREKA SCIENCE
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleCompare}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-lg transition-all duration-200 ${
              compare
                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                : "bg-white/10 hover:bg-white/20"
            }`}
            data-testid="button-compare"
          >
            <Layers size={14} />
            {compare ? "關閉比較" : "比較"}
          </button>
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

      <div className="px-4 py-2 sm:px-6 border-b border-white/10 flex flex-col gap-1.5">
        <SliderGroup
          title="波 A"
          accentClass="text-blue-400"
          params={paramsA}
          onChange={setParamsA}
          idPrefix="a"
        />
        {compare && (
          <SliderGroup
            title="波 B"
            accentClass="text-emerald-400"
            params={paramsB}
            onChange={setParamsB}
            idPrefix="b"
          />
        )}
      </div>

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
