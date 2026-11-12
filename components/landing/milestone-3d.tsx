"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const STEPS = [
  ["Fund", "The client authorizes $2,400 through PayPal. The money is reserved on their account, and nothing is charged yet."],
  ["Verify", "Gemini scans the submitted repository against each acceptance criterion and writes a report with file references."],
  ["Release", "The client approves and the authorization is captured. In a dispute, only the agreed share is captured and the rest is voided."],
] as const;

const HUD = [
  { label: "Authorized · $2,400", dot: "bg-blue" },
  { label: "AI review in progress", dot: "bg-amber" },
  { label: "Captured · $2,400", dot: "bg-em" },
];

/** 320vh scroll section with a sticky stage. Scroll progress drives a three.js payment card. */
export function Milestone3D() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const prog = useRef<HTMLSpanElement>(null);
  const p = useRef(0);
  const [step, setStep] = useState(0);
  const [fail, setFail] = useState(false);

  // Scroll progress 0..1 across the section.
  useEffect(() => {
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = section.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const v = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
        p.current = v;
        setStep(v < 0.34 ? 0 : v < 0.67 ? 1 : 2);
        if (prog.current) prog.current.style.height = `calc((100% - 12px) * ${v.toFixed(3)})`;
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // three.js scene, core geometry only. Paused while off-screen.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        setFail(true);
        return;
      }
      if (disposed) return;
      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setFail(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      el.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0, 10);
      const C = { blue: new THREE.Color("#4f8dff"), em: new THREE.Color("#2fd39a"), amber: new THREE.Color("#f2c14e") };
      scene.add(new THREE.AmbientLight(0xffffff, 0.35));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(3, 4, 6);
      scene.add(key);
      const rimE = new THREE.PointLight(0x2fd39a, 40, 30);
      rimE.position.set(-4, -1.5, 3);
      scene.add(rimE);
      const rimB = new THREE.PointLight(0x4f8dff, 40, 30);
      rimB.position.set(4, 2.5, -2);
      scene.add(rimB);

      const group = new THREE.Group();
      scene.add(group);
      const s = new THREE.Shape(), w = 3.4, hh = 2.14, r = 0.24;
      s.moveTo(-w / 2 + r, -hh / 2);
      s.lineTo(w / 2 - r, -hh / 2);
      s.quadraticCurveTo(w / 2, -hh / 2, w / 2, -hh / 2 + r);
      s.lineTo(w / 2, hh / 2 - r);
      s.quadraticCurveTo(w / 2, hh / 2, w / 2 - r, hh / 2);
      s.lineTo(-w / 2 + r, hh / 2);
      s.quadraticCurveTo(-w / 2, hh / 2, -w / 2, hh / 2 - r);
      s.lineTo(-w / 2, -hh / 2 + r);
      s.quadraticCurveTo(-w / 2, -hh / 2, -w / 2 + r, -hh / 2);
      const cardGeo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 6, curveSegments: 24 });
      cardGeo.center();
      const cardMat = new THREE.MeshPhysicalMaterial({ color: C.blue.clone(), metalness: 0.45, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, emissive: new THREE.Color("#0b1d44"), emissiveIntensity: 0.6 });
      const card = new THREE.Mesh(cardGeo, cardMat);
      group.add(card);
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.03), new THREE.MeshStandardMaterial({ color: 0xe9d8a6, metalness: 1, roughness: 0.3 }));
      chip.position.set(-1.05, 0.32, 0.1);
      card.add(chip);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
      for (const [y, l] of [[-0.35, 1.9], [-0.62, 1.2]] as const) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(l, 0.07), lineMat);
        m.position.set(-1.31 + l / 2, y, 0.09);
        card.add(m);
      }
      const seal = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 16, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.15 }));
      seal.position.set(1.15, -0.6, 0.1);
      card.add(seal);
      const scanMat = new THREE.MeshBasicMaterial({ color: C.em, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const scan = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 0.05), scanMat);
      scan.position.z = 0.12;
      card.add(scan);
      const glowMat = new THREE.MeshBasicMaterial({ color: C.em, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const scanGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 0.5), glowMat);
      scanGlow.position.z = 0.11;
      card.add(scanGlow);
      const ringAMat = new THREE.MeshBasicMaterial({ color: C.em, transparent: true, opacity: 0.55 });
      const ringBMat = new THREE.MeshBasicMaterial({ color: C.blue, transparent: true, opacity: 0.45 });
      const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.012, 12, 240), ringAMat);
      const ringB = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.008, 12, 240), ringBMat);
      group.add(ringA, ringB);
      const nodes = [C.blue, C.amber, C.em].map((c) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 24), new THREE.MeshBasicMaterial({ color: c }));
        ringA.add(m);
        return m;
      });
      const N = 900, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const rr = 4 + Math.random() * 7, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th) * 0.6;
        pos[i * 3 + 2] = rr * Math.cos(ph) - 2;
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xa9c1ff, size: 0.035, transparent: true, opacity: 0.75, depthWrite: false }));
      scene.add(pts);

      const resize = () => {
        const W = el.clientWidth || 1, H = el.clientHeight || 1;
        renderer.setSize(W, H, false);
        camera.aspect = W / H;
        camera.fov = W / H < 1 ? 48 : 35;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();
      let vis = true;
      const io = new IntersectionObserver((es) => (vis = es[0]!.isIntersecting), { threshold: 0 });
      io.observe(el);
      const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      const onMove = (e: PointerEvent) => {
        mouse.tx = e.clientX / window.innerWidth - 0.5;
        mouse.ty = e.clientY / window.innerHeight - 0.5;
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      const sm = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      let raf = 0, cur = 0, last = performance.now(), t = 0;
      const tmp = new THREE.Color();
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!vis) return;
        t += dt;
        cur += (p.current - cur) * Math.min(1, dt * 5);
        mouse.x += (mouse.tx - mouse.x) * 0.06;
        mouse.y += (mouse.ty - mouse.y) * 0.06;
        const q = cur, verify = sm(0.25, 0.4, q) * (1 - sm(0.6, 0.75, q)), release = sm(0.66, 0.92, q);
        group.rotation.y = -0.55 + q * Math.PI * 1.75 + mouse.x * 0.5;
        group.rotation.x = 0.28 - q * 0.4 + mouse.y * 0.3;
        group.position.y = Math.sin(t * 1.1) * 0.07;
        card.rotation.z = Math.sin(t * 0.6) * 0.03;
        tmp.copy(C.blue).lerp(C.em, sm(0.5, 0.95, q));
        cardMat.color.copy(tmp);
        scanMat.opacity = verify * 0.95;
        glowMat.opacity = verify * 0.18;
        scan.position.y = scanGlow.position.y = Math.sin(t * 2.4) * 0.95;
        ringA.rotation.set(Math.PI / 2.25 + Math.sin(t * 0.3) * 0.1, 0, t * 0.35);
        ringB.rotation.set(1.1, t * 0.2, 0);
        ringA.scale.setScalar(1 + release * 0.4);
        ringB.scale.setScalar(1 + release * 0.6);
        ringAMat.opacity = 0.55 * (1 - release * 0.5);
        ringBMat.opacity = 0.45 * (1 - release * 0.6);
        nodes.forEach((n, i) => {
          const a = (i * Math.PI * 2) / 3;
          n.position.set(Math.cos(a) * 2.7, Math.sin(a) * 2.7, 0);
          n.scale.setScalar(1 + (i === Math.min(2, Math.floor(q * 3)) ? 0.8 : 0));
        });
        pts.rotation.y = t * 0.025 + q * 0.8;
        pts.position.z = release * 1.5;
        camera.position.z = 10 - q * 2.4;
        camera.position.x = mouse.x * 0.4;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(tick);
      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
        scene.traverse((o) => {
          const m = o as import("three").Mesh;
          m.geometry?.dispose?.();
          const mat = m.material as import("three").Material | import("three").Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose?.();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <section ref={section} id="experience" className="relative h-[320vh] border-t border-line">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="pointer-events-none absolute top-[55%] left-1/2 size-[min(1100px,140vw)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,var(--blueSoft),transparent_70%)]" />
        <div className="relative mx-auto flex h-full max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-4 px-[clamp(16px,3vw,40px)] pt-[clamp(84px,10vw,112px)] pb-6">
          <div className="flex max-w-[520px] min-w-0 flex-[1_1_360px] flex-col gap-[clamp(12px,2vw,24px)]">
            <span className="eyebrow text-em">Inside a milestone</span>
            <h2 className="m-0 text-[clamp(28px,4vw,48px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
              Follow one payment from authorization to capture.
            </h2>
            <div className="relative flex flex-col gap-[clamp(8px,1.6vw,18px)] pl-[22px]">
              <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-[1px] bg-line2" />
              <span ref={prog} className="absolute top-1.5 left-0 h-0 w-0.5 rounded-[1px] bg-gradient-to-b from-blue to-em" />
              {STEPS.map(([title, body], i) => (
                <div key={title} className="flex flex-col gap-1 transition-opacity duration-400" style={{ opacity: i === step ? 1 : 0.38 }}>
                  <span className="flex items-center gap-2.5 text-[clamp(16px,1.6vw,19px)] font-semibold">
                    <span className={cn("font-mono text-[12px]", i === step ? "text-em" : "text-faint")}>0{i + 1}</span>
                    {title}
                  </span>
                  {i === step && <span className="animate-fade-up text-[14.5px] text-pretty text-muted-foreground">{body}</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[300px] min-w-0 flex-[1.4_1_420px] self-stretch">
            <div ref={stage} aria-hidden="true" className="absolute inset-0" />
            {fail && (
              <div className="absolute inset-[10%] grid place-items-center rounded-3xl border border-dashed border-line2 font-mono text-[12px] text-muted-foreground">
                3D preview unavailable
              </div>
            )}
            <div className="pointer-events-none absolute top-2 left-2 flex flex-col gap-1.5">
              <span className="font-mono text-[11.5px] text-muted-foreground">LL-2041 · M2 · Invoice builder</span>
              <span className="flex items-center gap-2 self-start rounded-full border border-line2 bg-glass px-3 py-1.5 text-[13px] font-medium whitespace-nowrap backdrop-blur-[12px]">
                <span className={cn("size-[7px] rounded-full transition-colors duration-400", HUD[step]!.dot)} />
                {HUD[step]!.label}
              </span>
            </div>
            <span className="pointer-events-none absolute right-2 bottom-2 font-mono text-[11px] text-faint">Scroll to advance · move to tilt</span>
          </div>
        </div>
      </div>
    </section>
  );
}
