import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STAGES, TOOLS } from '../game/content';
import { environment, factor, grams, material, support } from '../game/engine';
import type {
  AppScreen,
  CollapseMove,
  GamePhase,
  MatchState,
  SedimentId,
  StageId,
  ToolId,
} from '../game/types';
import { createDiorama, type DioramaController } from './diorama';
import { FlagAssembly } from './flagMesh';
import { ParticleSystem } from './particles';
import { buildPileGeometry } from './pileMesh';
import { createSedimentTextures, type SedimentTextures } from './textures';
import { Tool3DVisual } from './tool3d';

export interface SandViewportHandle {
  rebuildPile: () => void;
  syncScene: () => void;
  rotateBy: (dYaw: number, dPitch?: number) => void;
  zoomBy: (multiplier: number) => void;
  resetView: () => void;
  spawnHarvest: (from: [number, number, number], player: 0 | 1, count: number) => void;
  spawnCollapse: (moves: CollapseMove[]) => void;
  spawnImpact: (origin: [number, number, number]) => void;
  addTrauma: (amount: number) => void;
  clearParticles: () => void;
  setAiToolState: (
    visual: { active: boolean; tool: ToolId; point: [number, number, number] | null; phase: number } | null,
  ) => void;
}

export interface SandViewportProps {
  stateRef: React.MutableRefObject<MatchState>;
  screen: AppScreen;
  phase: GamePhase;
  tool: ToolId;
  cut: boolean;
  shipMotion: boolean;
  autoFlipTabletop: boolean;
  onDigStart: (point: [number, number, number], dir: [number, number, number]) => void;
  onDigPulse: (point: [number, number, number], dir: [number, number, number]) => void;
  onDigEnd: () => void;
  onDigCancel: (reason: string) => void;
  onUserInteract: () => void;
  onTickFrame: (dt: number, now: number) => void;
  controllerRef: React.MutableRefObject<SandViewportHandle | null>;
}

const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _target = new THREE.Vector3(0, 4.2, 0);
const _skyCol = new THREE.Color();
const _hazeCol = new THREE.Color();
const _nightSky = new THREE.Color('#0c172b');
const _nightHaze = new THREE.Color('#162642');
const _autumnTint = new THREE.Color('#d98d4a');
const _winterTint = new THREE.Color('#c8ddf2');
const _sunColorDay = new THREE.Color('#fff4d6');
const _sunColorSunset = new THREE.Color('#ffaa66');
const _moonColor = new THREE.Color('#8eb4e6');

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const SandViewport: React.FC<SandViewportProps> = ({
  stateRef,
  screen,
  phase,
  tool,
  cut,
  shipMotion,
  autoFlipTabletop,
  onDigStart,
  onDigPulse,
  onDigEnd,
  onDigCancel,
  onUserInteract,
  onTickFrame,
  controllerRef,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const propsRef = useRef({
    screen,
    phase,
    tool,
    cut,
    shipMotion,
    autoFlipTabletop,
    onDigStart,
    onDigPulse,
    onDigEnd,
    onDigCancel,
    onUserInteract,
    onTickFrame,
  });
  propsRef.current = {
    screen,
    phase,
    tool,
    cut,
    shipMotion,
    autoFlipTabletop,
    onDigStart,
    onDigPulse,
    onDigEnd,
    onDigCancel,
    onUserInteract,
    onTickFrame,
  };

  // Internal mutable scene handles
  const internalRef = useRef<{
    rebuildPile: () => void;
    syncScene: () => void;
    rotateBy: (dYaw: number, dPitch?: number) => void;
    zoomBy: (mult: number) => void;
    resetView: () => void;
    particles: ParticleSystem | null;
    addTrauma: (n: number) => void;
    aiTool: { active: boolean; tool: ToolId; point: [number, number, number] | null; phase: number } | null;
  }>({
    rebuildPile: () => {},
    syncScene: () => {},
    rotateBy: () => {},
    zoomBy: () => {},
    resetView: () => {},
    particles: null,
    addTrauma: () => {},
    aiTool: null,
  });

  useImperativeHandle(controllerRef, () => ({
    rebuildPile: () => internalRef.current.rebuildPile(),
    syncScene: () => internalRef.current.syncScene(),
    rotateBy: (dYaw, dPitch = 0) => internalRef.current.rotateBy(dYaw, dPitch),
    zoomBy: (mult) => internalRef.current.zoomBy(mult),
    resetView: () => internalRef.current.resetView(),
    spawnHarvest: (from, player, count) => {
      const s = stateRef.current;
      internalRef.current.particles?.spawnHarvest(from, player, count, material(s).color, factor(s));
    },
    spawnCollapse: (moves) => {
      const s = stateRef.current;
      internalRef.current.particles?.spawnCollapse(moves, material(s).color, factor(s));
    },
    spawnImpact: (origin) => {
      const s = stateRef.current;
      internalRef.current.particles?.spawnImpactBurst(origin, material(s).color, factor(s));
    },
    addTrauma: (amt) => internalRef.current.addTrauma(amt),
    clearParticles: () => internalRef.current.particles?.clearGrains(),
    setAiToolState: (v) => {
      internalRef.current.aiTool = v;
    },
  }));

  // Trigger pile rebuild when cross-section changes
  useEffect(() => {
    internalRef.current.rebuildPile();
  }, [cut]);

  // Mount Three.js once and never tear down on React HUD re-renders
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('data-testid', 'sand-canvas');
    renderer.domElement.setAttribute(
      'aria-label',
      '3D 모래 언덕 경기장. 좌클릭 또는 한 손가락 유지로 채굴, 우클릭 또는 두 손가락 드래그로 시점 회전.',
    );

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = isSoftwareGl ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#95c8e8');
    scene.fog = new THREE.FogExp2('#e4edd2', 0.0065);

    // Mandatory studio environment map for crisp metallic/wet PBR highlights
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.4, 320);

    // 3-point + Hemisphere lighting rig
    const hemiLight = new THREE.HemisphereLight('#c4e3ff', '#b5986d', 0.92);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fff4d6', 2.05);
    sunLight.position.set(28, 36, 22);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 4;
    sunLight.shadow.camera.far = 110;
    sunLight.shadow.camera.left = -26;
    sunLight.shadow.camera.right = 26;
    sunLight.shadow.camera.top = 26;
    sunLight.shadow.camera.bottom = -26;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.03;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#8ec5e8', 0.48);
    rimLight.position.set(-24, 18, -26);
    scene.add(rimLight);

    // Visible celestial body (Sun / Moon) in the sky dome
    const sunOrbMat = new THREE.MeshBasicMaterial({ color: '#fff6c2', fog: false });
    const sunOrb = new THREE.Mesh(new THREE.SphereGeometry(2.8, 16, 12), sunOrbMat);
    scene.add(sunOrb);

    // Root world group (rocks gently on ocean-ship / river-boat stages)
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const diorama: DioramaController = createDiorama();
    worldGroup.add(diorama.group);

    // Sand pile mesh + scaled container
    const pileContainer = new THREE.Group();
    worldGroup.add(pileContainer);

    const pileMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
      bumpScale: 0.16,
    });
    const pileMesh = new THREE.Mesh(new THREE.BufferGeometry(), pileMat);
    pileMesh.castShadow = true;
    pileMesh.receiveShadow = true;
    pileContainer.add(pileMesh);

    const flagAssembly = new FlagAssembly(maxAnisotropy);
    pileContainer.add(flagAssembly.group);

    const particles = new ParticleSystem();
    worldGroup.add(particles.group);

    const toolVisual = new Tool3DVisual();
    worldGroup.add(toolVisual.group);

    const sedimentTexCache = new Map<SedimentId, SedimentTextures>();
    let currentStageId: StageId | null = null;
    let currentSedimentId: SedimentId | null = null;
    let currentFactor = 0;

    function applySedimentMaterial(sedimentId: SedimentId) {
      let pair = sedimentTexCache.get(sedimentId);
      if (!pair) {
        pair = createSedimentTextures(sedimentId, maxAnisotropy);
        sedimentTexCache.set(sedimentId, pair);
      }
      const spec = material(stateRef.current);
      pileMat.map = pair.map;
      pileMat.bumpMap = pair.bumpMap;
      pileMat.roughness = spec.roughness;
      pileMat.bumpScale = spec.bumpScale;
      pileMat.needsUpdate = true;
      currentSedimentId = sedimentId;
    }

    function rebuildPile() {
      const s = stateRef.current;
      const f = factor(s);
      pileContainer.scale.setScalar(f);
      const nextGeo = buildPileGeometry(s, propsRef.current.cut);
      pileMesh.geometry.dispose();
      pileMesh.geometry = nextGeo;
      diorama.updateHarvestBins(grams(s, s.scores[0]), grams(s, s.scores[1]), material(s).color);
    }

    function syncScene() {
      const s = stateRef.current;
      const f = factor(s);
      if (currentStageId !== s.stage || Math.abs(currentFactor - f) > 0.001) {
        currentStageId = s.stage;
        currentFactor = f;
        diorama.setStage(s.stage, f);
      }
      if (currentSedimentId !== s.sediment) {
        applySedimentMaterial(s.sediment);
      }
      flagAssembly.syncSpec(s.flag);
      rebuildPile();
    }

    // Camera orbital state with smooth exponential damping
    let targetYaw = -0.68;
    let targetPitch = 0.56;
    let targetDist = 38;
    let curYaw = targetYaw;
    let curPitch = targetPitch;
    let curDist = targetDist;
    let curRoll = 0;
    let trauma = 0;

    internalRef.current.rebuildPile = rebuildPile;
    internalRef.current.syncScene = syncScene;
    internalRef.current.particles = particles;
    internalRef.current.addTrauma = (amt: number) => {
      trauma = Math.min(1, trauma + amt);
    };
    internalRef.current.rotateBy = (dYaw: number, dPitch = 0) => {
      targetYaw += dYaw;
      targetPitch = THREE.MathUtils.clamp(targetPitch + dPitch, 0.24, 1.28);
    };
    internalRef.current.zoomBy = (mult: number) => {
      targetDist = THREE.MathUtils.clamp(targetDist * mult, 18, 66);
    };
    internalRef.current.resetView = () => {
      targetYaw = -0.68;
      targetPitch = 0.56;
      targetDist = 38;
    };

    syncScene();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting helper against the live sand mound mesh
    const raycaster = new THREE.Raycaster();
    let hoverHit: { point: [number, number, number]; dir: [number, number, number] } | null = null;

    function pickSand(clientX: number, clientY: number): { point: [number, number, number]; dir: [number, number, number] } | null {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_ndc, camera);

      const hits = raycaster.intersectObject(pileMesh, false);
      if (!hits.length) return null;

      // Convert hit point & ray direction into voxel grid space (0..25, 0..17, 0..25)
      const invMat = pileContainer.matrixWorld.clone().invert();
      _rayOrigin.copy(hits[0].point).applyMatrix4(invMat);
      _rayDir.copy(raycaster.ray.direction).transformDirection(invMat).normalize();

      const gx = _rayOrigin.x + 12.5;
      const gy = _rayOrigin.y;
      const gz = _rayOrigin.z + 12.5;
      return {
        point: [gx, gy, gz],
        dir: [_rayDir.x, _rayDir.y, _rayDir.z],
      };
    }

    // Pointer / Mouse-Chord / Multi-Touch Pinch Input State
    const pointers = new Map<number, { x: number; y: number }>();
    let drag:
      | { mode: 'dig'; id: number; x: number; y: number; rotating: boolean; nextDigAt: number; pulseStart: number }
      | { mode: 'rotate'; id: number; x: number; y: number }
      | { mode: 'pinch' }
      | { mode: 'pinch-wait' }
      | null = null;

    const canvas = renderer.domElement;

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2 && drag?.mode === 'dig') {
        drag.rotating = true;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (drag?.mode !== 'dig') return;
      if (e.button === 0) {
        drag = null;
        pointers.clear();
        propsRef.current.onDigEnd();
      } else if (e.button === 2) {
        drag.rotating = false;
        drag.nextDigAt = performance.now() + TOOLS[propsRef.current.tool].interval;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      propsRef.current.onUserInteract();
      if (propsRef.current.screen !== 'playing') return;
      const p = propsRef.current.phase;
      if (p === 'settle' || p === 'ai-thinking' || p === 'ai-dig' || stateRef.current.result) return;
      if (e.pointerType !== 'touch' && e.button !== 0 && e.button !== 2) return;

      // Two-finger touch switches seamlessly to pinch/rotate and rolls back unconfirmed dig
      if (e.pointerType === 'touch' && pointers.size === 1) {
        const prevEntry = [...pointers.entries()][0];
        if (drag?.mode === 'dig') {
          propsRef.current.onDigCancel('두 손가락으로 시점을 회전합니다.');
        }
        drag = { mode: 'pinch' };
        pointers.clear();
        pointers.set(prevEntry[0], prevEntry[1]);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic pointer events
        }
        return;
      }

      if (pointers.size > 0 || drag) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic pointer events
      }

      if (e.button === 2) {
        drag = { mode: 'rotate', id: e.pointerId, x: e.clientX, y: e.clientY };
        return;
      }

      // Left-click / single-finger press: arm digging!
      const hit = pickSand(e.clientX, e.clientY);
      hoverHit = hit;
      const now = performance.now();
      drag = {
        mode: 'dig',
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        rotating: false,
        nextDigAt: now + TOOLS[propsRef.current.tool].interval,
        pulseStart: now,
      };
      if (hit) {
        propsRef.current.onDigStart(hit.point, hit.dir);
      } else {
        // Arm dig even over empty background (matching original rule: left drag over empty never rotates)
        propsRef.current.onDigStart([12.5, -10, 12.5], [0, -1, 0]);
      }
    };

    let lastHoverPick = 0;

    const onPointerMove = (e: PointerEvent) => {
      const old = pointers.get(e.pointerId);
      const rollSign = Math.cos(curRoll) < 0 ? -1 : 1;

      if (e.pointerType === 'mouse' && e.buttons !== undefined) {
        if (drag?.mode === 'dig' && !(e.buttons & 1)) {
          drag = null;
          pointers.clear();
          propsRef.current.onDigEnd();
          return;
        }
        if (drag?.mode === 'rotate' && !(e.buttons & 2)) {
          drag = null;
          pointers.clear();
          return;
        }
        if (drag?.mode === 'dig') {
          if (e.buttons & 2) {
            targetYaw += (e.clientX - drag.x) * 0.007 * rollSign;
            targetPitch = THREE.MathUtils.clamp(targetPitch + (e.clientY - drag.y) * 0.0045 * rollSign, 0.24, 1.28);
            drag.x = e.clientX;
            drag.y = e.clientY;
            drag.rotating = true;
            return;
          } else if (drag.rotating) {
            drag.rotating = false;
            drag.nextDigAt = performance.now() + TOOLS[propsRef.current.tool].interval;
          }
        }
      }

      if (old && drag?.mode === 'pinch' && pointers.size === 2) {
        const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)?.[1];
        if (other) {
          const prevDist = Math.hypot(old.x - other.x, old.y - other.y);
          const nextDist = Math.hypot(e.clientX - other.x, e.clientY - other.y);
          if (prevDist > 6) {
            targetDist = THREE.MathUtils.clamp(targetDist * (prevDist / nextDist), 18, 66);
          }
          targetYaw += (e.clientX - old.x) * 0.005 * rollSign;
          targetPitch = THREE.MathUtils.clamp(targetPitch + (e.clientY - old.y) * 0.0035 * rollSign, 0.24, 1.28);
        }
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        return;
      }

      if (old) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (drag?.mode === 'rotate' && drag.id === e.pointerId) {
        targetYaw += (e.clientX - drag.x) * 0.007 * rollSign;
        targetPitch = THREE.MathUtils.clamp(targetPitch + (e.clientY - drag.y) * 0.0045 * rollSign, 0.24, 1.28);
        drag.x = e.clientX;
        drag.y = e.clientY;
      } else if (drag?.mode === 'dig' && drag.id === e.pointerId) {
        drag.x = e.clientX;
        drag.y = e.clientY;
        hoverHit = pickSand(e.clientX, e.clientY);
      } else if (!drag && propsRef.current.screen === 'playing' && propsRef.current.phase === 'observe') {
        const now = performance.now();
        if (now - lastHoverPick > 32) {
          lastHoverPick = now;
          hoverHit = pickSand(e.clientX, e.clientY);
        }
      }
    };

    const releasePointer = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      if (e.pointerType !== 'touch' && drag?.mode === 'dig' && e.button !== 0) {
        drag.rotating = false;
        drag.nextDigAt = performance.now() + TOOLS[propsRef.current.tool].interval;
        return;
      }
      if (e.pointerType !== 'touch' && drag?.mode === 'rotate' && e.button !== 2) return;

      pointers.delete(e.pointerId);
      if (drag?.mode === 'dig') {
        drag = null;
        propsRef.current.onDigEnd();
      } else if (drag?.mode === 'pinch') {
        drag = pointers.size ? { mode: 'pinch-wait' } : null;
      } else {
        drag = null;
      }
    };

    const onPointerCancel = () => {
      if (drag?.mode === 'dig') {
        propsRef.current.onDigCancel('중단된 조작은 수확에 반영하지 않았습니다.');
      }
      drag = null;
      pointers.clear();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (propsRef.current.phase === 'dig') return;
      targetDist = THREE.MathUtils.clamp(targetDist * Math.exp(e.deltaY * 0.001), 18, 66);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (propsRef.current.screen !== 'playing' || propsRef.current.phase === 'dig') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') targetYaw -= 0.16;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') targetYaw += 0.16;
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') targetPitch = Math.min(1.28, targetPitch + 0.1);
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') targetPitch = Math.max(0.24, targetPitch - 0.1);
      else if (e.key === '+' || e.key === '=') targetDist = Math.max(18, targetDist * 0.88);
      else if (e.key === '-') targetDist = Math.min(66, targetDist * 1.12);
    };

    const onWindowBlur = () => {
      if (drag?.mode === 'dig') {
        propsRef.current.onDigCancel('화면 포커스가 벗어나 채굴을 취소했습니다.');
      }
      drag = null;
      pointers.clear();
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
      syncScene();
    };

    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowBlur);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    // Live ResizeObserver
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Render loop with software-WebGL afterDraw pacing
    let frameId = 0;
    let disposed = false;
    let lastNow = performance.now();
    let sceneElapsed = 0;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (status === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const rawDt = (now - lastNow) / 1000;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      lastNow = now;
      sceneElapsed += dt;

      const s = stateRef.current;
      const p = propsRef.current;

      // Advance timers, AI, and settling animation in parent controller
      p.onTickFrame(dt, now);

      // Continuous held dig pulses
      if (p.screen === 'playing' && p.phase === 'dig' && drag?.mode === 'dig' && !drag.rotating) {
        let pulses = 0;
        const interval = TOOLS[p.tool].interval;
        while (now >= drag.nextDigAt && pulses < 4) {
          const hit = pickSand(drag.x, drag.y);
          hoverHit = hit;
          if (hit) {
            drag.pulseStart = now;
            p.onDigPulse(hit.point, hit.dir);
          }
          drag.nextDigAt += interval;
          pulses++;
        }
        if (pulses === 4 && now >= drag.nextDigAt) {
          drag.nextDigAt = now + interval;
        }
      }

      // Scenic slow orbit on Title screen
      if (p.screen === 'title' && !reducedMotion) {
        targetYaw += dt * 0.18;
        targetPitch = 0.52 + Math.sin(sceneElapsed * 0.35) * 0.05;
        targetDist = 36;
      }

      // Exponential camera damping
      const dampLambda = isSoftwareGl ? 18 : 8.5;
      curYaw = THREE.MathUtils.damp(curYaw, targetYaw, dampLambda, dt);
      curPitch = THREE.MathUtils.damp(curPitch, targetPitch, dampLambda, dt);
      curDist = THREE.MathUtils.damp(curDist, targetDist, dampLambda, dt);

      // Smooth 180-degree Tabletop perspective roll for Player 2 facing across the table!
      const desiredRoll =
        p.screen === 'playing' &&
        s.playMode === 'tabletop' &&
        p.autoFlipTabletop &&
        s.player === 1
          ? Math.PI
          : 0;
      const rollLambda = isSoftwareGl ? 22 : 9.5;
      curRoll = reducedMotion
        ? desiredRoll
        : THREE.MathUtils.damp(curRoll, desiredRoll, rollLambda, dt);

      const f = factor(s);
      // Responsive framing: zoom out automatically on narrow portrait phones and dual-dock Tabletop mode
      const portraitBoost = camera.aspect < 1 ? Math.min(2.05, 1.04 / Math.max(0.48, camera.aspect)) : 1;
      const tabletopBoost =
        p.screen === 'playing' && s.playMode === 'tabletop'
          ? camera.aspect < 1
            ? 1.12
            : 1.22
          : 1;
      const scaledDist = curDist * Math.max(0.95, Math.min(2.1, f * 0.92)) * portraitBoost * tabletopBoost;

      // Decaying trauma^2 camera shake on collapses / flag fall
      trauma = Math.max(0, trauma - dt * 1.8);
      const shake = reducedMotion ? 0 : trauma * trauma * 0.75;
      const shakeX = shake * Math.sin(sceneElapsed * 43);
      const shakeY = shake * Math.cos(sceneElapsed * 37);

      _target.set(0, (s.playMode === 'tabletop' ? 5.2 : 4.4) * f, 0);
      const horiz = Math.cos(curPitch) * scaledDist;
      camera.position.set(
        _target.x + Math.sin(curYaw) * horiz + shakeX,
        _target.y + Math.sin(curPitch) * scaledDist + shakeY,
        _target.z + Math.cos(curYaw) * horiz,
      );

      // Compute camera up vector rotated by curRoll around forward view axis
      _camForward.subVectors(_target, camera.position).normalize();
      _camRight.crossVectors(_camForward, _worldUp).normalize();
      _camUp.crossVectors(_camRight, _camForward).normalize();
      const cosR = Math.cos(curRoll);
      const sinR = Math.sin(curRoll);
      camera.up
        .set(
          _camUp.x * cosR + _camRight.x * sinR,
          _camUp.y * cosR + _camRight.y * sinR,
          _camUp.z * cosR + _camRight.z * sinR,
        )
        .normalize();
      camera.lookAt(_target);

      // Dynamic environment lighting (day/night + seasons + stage colors)
      const stageSpec = STAGES.find((st) => st.id === s.stage) || STAGES[0];
      const env = environment(s);

      _skyCol.set(stageSpec.sky).lerp(_nightSky, 1 - env.daylight);
      _hazeCol.set(stageSpec.haze).lerp(_nightHaze, 1 - env.daylight);
      if (env.season === 'autumn') {
        _skyCol.lerp(_autumnTint, 0.14);
        _hazeCol.lerp(_autumnTint, 0.16);
      } else if (env.season === 'winter') {
        _skyCol.lerp(_winterTint, 0.18);
        _hazeCol.lerp(_winterTint, 0.22);
      }
      (scene.background as THREE.Color).copy(_skyCol);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(_hazeCol);
        scene.fog.density = env.weather === 'rain' ? 0.0085 : env.weather === 'snow' ? 0.0095 : 0.0058;
      }

      // Sun/Moon arc + warm/cool directional contrast
      const sunAngle = (1 - env.daylight) * Math.PI * 0.72 + 0.35;
      sunLight.position.set(
        Math.cos(sunAngle) * 34,
        14 + env.daylight * 28,
        Math.sin(sunAngle) * 28,
      );
      sunOrb.position.copy(sunLight.position).multiplyScalar(2.4);
      const isNight = env.daylight < 0.35;
      sunLight.color
        .copy(isNight ? _moonColor : _sunColorSunset)
        .lerp(_sunColorDay, Math.max(0, (env.daylight - 0.35) / 0.65));
      sunLight.intensity = 0.65 + env.daylight * 1.55;
      hemiLight.intensity = 0.42 + env.daylight * 0.58;
      sunOrbMat.color.set(isNight ? '#dce9ff' : '#fff4bf');

      // Ship gentle rocking motion (visual only — never alters physics)
      const motionStrength = p.shipMotion && !reducedMotion ? stageSpec.motion || 0 : 0;
      worldGroup.rotation.z = Math.sin(sceneElapsed * 0.72) * 0.028 * motionStrength;
      worldGroup.position.y = Math.sin(sceneElapsed * 1.05) * 0.25 * motionStrength;

      // Update animated water, flag cloth, particles, and 3D tool visual
      diorama.updateWater(sceneElapsed);
      const supRatio = support(s).ratio;
      flagAssembly.update(s.flag, env, sceneElapsed, supRatio, reducedMotion);
      particles.update(dt, sceneElapsed, env, reducedMotion);

      const aiVis = internalRef.current.aiTool;
      if (aiVis?.active && aiVis.point) {
        toolVisual.update({
          visible: true,
          digging: true,
          tool: aiVis.tool,
          player: 1,
          point: aiVis.point,
          digPhase: aiVis.phase,
          pileFactor: f,
          reducedMotion,
        });
      } else {
        const isDigging = p.screen === 'playing' && p.phase === 'dig' && drag?.mode === 'dig' && !drag.rotating;
        const digPhase =
          isDigging && drag?.mode === 'dig'
            ? Math.min(1, (now - drag.pulseStart) / Math.max(160, TOOLS[p.tool].interval))
            : 0;
        toolVisual.update({
          visible:
            p.screen === 'playing' &&
            (p.phase === 'observe' || isDigging) &&
            !s.result &&
            Boolean(hoverHit),
          digging: isDigging,
          tool: p.tool,
          player: s.player,
          point: hoverHit?.point ?? null,
          digPhase,
          pileFactor: f,
          reducedMotion,
        });
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      frameId = window.setTimeout(tick, 16);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', releasePointer);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onWindowBlur);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      diorama.dispose();
      flagAssembly.dispose();
      particles.dispose();
      toolVisual.dispose();
      pileMesh.geometry.dispose();
      pileMat.dispose();
      sunOrb.geometry.dispose();
      sunOrbMat.dispose();
      envTex.dispose();
      for (const pair of sedimentTexCache.values()) {
        pair.map.dispose();
        pair.bumpMap.dispose();
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#162a26]">
      <div ref={mountRef} className="w-full h-full" />
      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#162a26]/90 text-[#f7f3ea] p-6 text-center">
          <div className="max-w-sm rounded-2xl bg-[#1f3b35] border border-[#e4c274]/30 p-6">
            <h2 className="font-display text-xl font-bold mb-2">3D 그래픽 컨텍스트 복구 중</h2>
            <p className="text-sm text-[#d6e2dc]">잠시 후 화면이 자동으로 복원됩니다.</p>
          </div>
        </div>
      )}
    </div>
  );
};
