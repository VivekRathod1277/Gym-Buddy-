import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export default function NeuralBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.offsetWidth || window.innerWidth;
    const height = container.offsetHeight || window.innerHeight;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a0f, 50, 300);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 80);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a0f, 1);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.2,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    composer.addPass(bloomPass);

    // Neural network nodes
    const nodeCount = 60;
    const connectionDistance = 25;
    const nodes: THREE.Mesh[] = [];
    const nodePositions: THREE.Vector3[] = [];
    const nodeVelocities: THREE.Vector3[] = [];

    const nodeGeometry = new THREE.SphereGeometry(0.6, 8, 8);
    const nodeColors = [0xffaa00, 0x00e5ff, 0x7b2ff7];

    for (let i = 0; i < nodeCount; i++) {
      const color = nodeColors[Math.floor(Math.random() * nodeColors.length)];
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6 + Math.random() * 0.4,
      });
      const node = new THREE.Mesh(nodeGeometry, material);
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 120,
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 60
      );
      node.position.copy(pos);
      scene.add(node);
      nodes.push(node);
      nodePositions.push(pos);
      nodeVelocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ));
    }

    // Connections between nearby nodes
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.15,
    });
    const lines: THREE.Line[] = [];

    function updateConnections() {
      // Remove old lines
      lines.forEach(line => scene.remove(line));
      lines.length = 0;

      for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
          const dist = nodePositions[i].distanceTo(nodePositions[j]);
          if (dist < connectionDistance) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
              nodePositions[i],
              nodePositions[j],
            ]);
            const line = new THREE.Line(geometry, lineMaterial.clone());
            line.material.opacity = 0.15 * (1 - dist / connectionDistance);
            scene.add(line);
            lines.push(line);
          }
        }
      }
    }

    updateConnections();

    // Signal particles traveling along connections
    const signalCount = 15;
    const signals: {
      mesh: THREE.Mesh;
      from: number;
      to: number;
      progress: number;
      speed: number;
    }[] = [];

    const signalGeometry = new THREE.SphereGeometry(0.3, 6, 6);
    const signalMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

    for (let i = 0; i < signalCount; i++) {
      const from = Math.floor(Math.random() * nodeCount);
      let to = Math.floor(Math.random() * nodeCount);
      while (to === from) to = Math.floor(Math.random() * nodeCount);

      const signal = new THREE.Mesh(signalGeometry, signalMaterial.clone());
      signal.position.copy(nodePositions[from]);
      scene.add(signal);
      signals.push({
        mesh: signal,
        from,
        to,
        progress: Math.random(),
        speed: 0.003 + Math.random() * 0.005,
      });
    }

    // Camera orbit
    let angle = 0;
    const orbitRadius = 80;
    const orbitSpeed = 0.0003;

    // Animation
    let frameCount = 0;
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      frameCount++;

      // Update node positions (gentle drift)
      for (let i = 0; i < nodeCount; i++) {
        nodePositions[i].add(nodeVelocities[i]);
        nodes[i].position.copy(nodePositions[i]);

        // Bounce off boundaries
        if (Math.abs(nodePositions[i].x) > 60) nodeVelocities[i].x *= -1;
        if (Math.abs(nodePositions[i].y) > 40) nodeVelocities[i].y *= -1;
        if (Math.abs(nodePositions[i].z) > 30) nodeVelocities[i].z *= -1;

        // Pulse animation
        const scale = 1 + Math.sin(frameCount * 0.02 + i) * 0.15;
        nodes[i].scale.setScalar(scale);
      }

      // Update connections periodically (every 30 frames for performance)
      if (frameCount % 30 === 0) {
        updateConnections();
      }

      // Update signal positions
      for (const signal of signals) {
        signal.progress += signal.speed;
        if (signal.progress >= 1) {
          signal.progress = 0;
          signal.from = signal.to;
          signal.to = Math.floor(Math.random() * nodeCount);
          while (signal.to === signal.from) {
            signal.to = Math.floor(Math.random() * nodeCount);
          }
        }

        const from = nodePositions[signal.from];
        const to = nodePositions[signal.to];
        signal.mesh.position.lerpVectors(from, to, signal.progress);

        // Color based on progress
        const hue = 0.08 + signal.progress * 0.47;
        (signal.mesh.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1, 0.6);
      }

      // Orbit camera
      angle += orbitSpeed;
      camera.position.x = Math.sin(angle) * orbitRadius;
      camera.position.z = Math.cos(angle) * orbitRadius;
      camera.lookAt(0, 0, 0);

      composer.render();
    }

    animate();

    // Resize handler
    function onResize() {
      const w = container.offsetWidth || window.innerWidth;
      const h = container.offsetHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    }

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      composer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        opacity: 0.3,
        pointerEvents: 'none',
      }}
    />
  );
}
