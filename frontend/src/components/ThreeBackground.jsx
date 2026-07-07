import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function ThreeBackground() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Geometry: 2D Grid of points for undulating terrain waves
    const cols = 55;
    const rows = 55;
    const particleCount = cols * rows;
    const spacing = 0.45;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount); // Custom size attribute per vertex

    // Grid color targets (Cyan to Purple)
    const colorCyan = new THREE.Color('#00f2fe');
    const colorPurple = new THREE.Color('#7c3aed');

    let idx = 0;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = (i - cols / 2) * spacing;
        const y = (j - rows / 2) * spacing;
        
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = 0; // Animated in loop

        const ratio = i / cols;
        const mixedColor = new THREE.Color().lerpColors(colorCyan, colorPurple, ratio);
        colors[idx * 3] = mixedColor.r;
        colors[idx * 3 + 1] = mixedColor.g;
        colors[idx * 3 + 2] = mixedColor.b;

        sizes[idx] = 0.04; // Baseline small size

        idx++;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // 3. Custom GLSL shaders to allow variable point sizing & circular shapes
    const vertexShader = `
      attribute float size;
      attribute vec3 customColor;
      varying vec3 vColor;
      void main() {
        vColor = customColor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // Size attenuation based on distance from camera
        gl_PointSize = size * (150.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      varying vec3 vColor;
      void main() {
        // Draw soft circular point shapes
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        float r = dot(cxy, cxy);
        if (r > 1.0) {
          discard;
        }
        float alpha = 1.0 - smoothstep(0.8, 1.0, r);
        gl_FragColor = vec4(vColor, alpha * 0.75);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const waveGrid = new THREE.Points(geometry, material);
    waveGrid.rotation.x = -Math.PI / 2.8; // Tilt grid towards camera
    scene.add(waveGrid);

    // Invisible plane matching grid tilt for raycasting mouse onto 3D coordinates
    const planeGeom = new THREE.PlaneGeometry(100, 100);
    const planeMat = new THREE.MeshBasicMaterial({ visible: false });
    const planeMesh = new THREE.Mesh(planeGeom, planeMat);
    planeMesh.rotation.x = -Math.PI / 2.8;
    scene.add(planeMesh);

    camera.position.y = 2.5;
    camera.position.z = 8;
    camera.lookAt(0, 0, 0);

    // Raycast state
    const raycaster = new THREE.Raycaster();
    const ndcMouse = new THREE.Vector2();
    const mouse3D = new THREE.Vector3(0, 0, 0);
    let hasMouse = false;

    // Interactive mouse parallax tilt targets
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event) => {
      ndcMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      ndcMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      mouseX = (event.clientX - window.innerWidth / 2) / 250;
      mouseY = (event.clientY - window.innerHeight / 2) / 250;

      raycaster.setFromCamera(ndcMouse, camera);
      const intersects = raycaster.intersectObject(planeMesh);
      if (intersects.length > 0) {
        mouse3D.copy(intersects[0].point);
        hasMouse = true;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      if (!camera || !renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // 4. Animation loop
    let animationFrameId;
    const posAttribute = geometry.attributes.position;
    const posArray = posAttribute.array;
    const colorAttribute = geometry.attributes.customColor;
    const colorArray = colorAttribute.array;
    const sizeAttribute = geometry.attributes.size;
    const sizesArray = sizeAttribute.array;
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsed = (performance.now() - startTime) * 0.001 * 0.8;

      const localMouse = mouse3D.clone();
      waveGrid.worldToLocal(localMouse);

      let idx = 0;
      const baseSize = 0.15; // Keep background points very small and clean

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = posArray[idx * 3];
          const y = posArray[idx * 3 + 1];
          
          // Undulating sine wave
          const z = Math.sin(x * 0.45 + elapsed) * Math.cos(y * 0.45 + elapsed) * 0.75;
          posArray[idx * 3 + 2] = z;

          // Proximity calculation
          const dx = x - localMouse.x;
          const dy = y - localMouse.y;
          const dz = z - localMouse.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          const ratio = i / cols;
          const baseColor = new THREE.Color().lerpColors(colorCyan, colorPurple, ratio);

          // Glow active within a 2.4 unit radius
          if (hasMouse && dist < 2.4) {
            const glowIntensity = 1.0 - dist / 2.4;
            const weight = Math.pow(glowIntensity, 1.4); // Punchy center curves

            // Transition to hyper-bright neon cyan-green (#00ffbb)
            const glowColor = new THREE.Color().lerpColors(baseColor, new THREE.Color('#00ffbb'), weight * 1.2);
            colorArray[idx * 3] = Math.min(glowColor.r, 1.0);
            colorArray[idx * 3 + 1] = Math.min(glowColor.g, 1.0);
            colorArray[idx * 3 + 2] = Math.min(glowColor.b, 1.0);

            // Make the hovered points swell up to 4.5x larger!
            sizesArray[idx] = baseSize + (0.16 - baseSize) * weight;
          } else {
            // Decay color and size back to quiet background states
            colorArray[idx * 3] += (baseColor.r - colorArray[idx * 3]) * 0.08;
            colorArray[idx * 3 + 1] += (baseColor.g - colorArray[idx * 3 + 1]) * 0.08;
            colorArray[idx * 3 + 2] += (baseColor.b - colorArray[idx * 3 + 2]) * 0.08;

            sizesArray[idx] += (baseSize - sizesArray[idx]) * 0.08;
          }

          idx++;
        }
      }
      posAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
      sizeAttribute.needsUpdate = true;

      // Mouse Parallax (slow tilt rotation)
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      waveGrid.rotation.z = targetX * 0.3;
      waveGrid.rotation.x = -Math.PI / 2.8 + (targetY * 0.15);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'absolute', 
        inset: 0, 
        zIndex: 0, 
        pointerEvents: 'none', 
        overflow: 'hidden' 
      }} 
    />
  );
}
