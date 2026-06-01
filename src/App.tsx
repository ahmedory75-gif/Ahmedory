/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Snowflake, Feather, Waves, Star, Target, X, Camera, CameraOff, Music, Upload, Flower2, Shell, Network, Droplets, Eye, EyeOff } from 'lucide-react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

function randomGaussian() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

class ParticleEngine {
    canvas: HTMLCanvasElement;
    numParticles: number;
    shapes: any[];
    currentShapeIndex: number;
    transitioning: boolean;
    rotationSpeed: number;
    targetRotationSpeed: number = 0.0015;
    morphInterval: number;
    internalMorphTime: number = 0;
    targetSize: number = 1.0;
    targetWaveSpeed: number = 0.4;
    targetColorShift: number = 0.4;
    targetGlobalHue: number = 0;
    currentGlobalHue: number = 0;
    targetCoolTones: number = 0;
    currentCoolTones: number = 0;
    targetWaterfallBlend: number = 0;
    currentWaterfallBlend: number = 0;
    allowedShapes: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    targetBloom: number = 1.0;
    isBreathingMode: boolean = false;
    breathPhase: number = 0;
    breathValue: number = 0;
    breathText: string = "吸气";
    breathStartTime: number = 0;
    currentBreathPattern: number = 0;
    savedShapeIndex: number = 0;
    savedCoolTones: number = 0;
    audioAnalyser: AnalyserNode | null = null;
    dataArray: Uint8Array | null = null;
    smoothedAudioPulse: number = 0;
    smoothedBass: number = 0;
    smoothedMid: number = 0;
    smoothedTreble: number = 0;
    audioColorTime: number = 0;
    energyHistory: number[] = [];
    energyHistoryIndex: number = 0;
    lastBeatTime: number = 0;
    beatCooldown: number = 15.0; // Very slow auto-morphs for graceful feel
    autoMorphEnabled: boolean = true;
    currentMorphStage: number = 0;
    isMusicPlaying: boolean = false;
    currentMusicBlend: number = 0.0;
    onMorphCallback: ((stage: number) => void) | null = null;
    onShapeChangeCallback: ((index: number) => void) | null = null;
    scene!: THREE.Scene;
    camera!: THREE.PerspectiveCamera;
    renderer!: THREE.WebGLRenderer;
    composer!: EffectComposer;
    bloomPass!: UnrealBloomPass;
    afterimagePass!: AfterimagePass;
    particleSystem!: THREE.Points;
    stars!: THREE.Points;
    shootingStars!: any[];
    clock!: THREE.Clock;
    animationId!: number;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.numParticles = 100000;
        this.shapes = [];
        this.currentShapeIndex = 0;
        this.transitioning = false;
        this.rotationSpeed = 0.0015; // Significantly slowed down for elegant freezing effect
        this.morphInterval = 12.5; // 12.5 seconds per morph stage
        this.onWindowResize = this.onWindowResize.bind(this);
        this.animate = this.animate.bind(this);
        
        this.init();
    }
    
    init() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.015);
        
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 35;
        
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Post-processing
        const renderScene = new RenderPass(this.scene, this.camera);
        
        this.afterimagePass = new AfterimagePass();
        this.afterimagePass.uniforms['damp'].value = 0.85; // Default trail intensity
        
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.0, 0.4, 0.85);
        this.bloomPass.threshold = 0.1;
        this.bloomPass.strength = 1.0;
        this.bloomPass.radius = 0.5;
        
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(this.afterimagePass);
        this.composer.addPass(this.bloomPass);
        
        this.generateShapes();
        this.createParticles();
        this.createBackground();
        
        this.clock = new THREE.Clock();
        this.animate();
        
        window.addEventListener('resize', this.onWindowResize);
    }

    setTrailIntensity(intensity: number) {
        if (this.afterimagePass) {
            this.afterimagePass.uniforms['damp'].value = intensity;
        }
    }

    generateShapes() {
        const cA = new THREE.Color();
        const cB = new THREE.Color();
        const cC = new THREE.Color();
        const finalColor = new THREE.Color();

        for (let s = 0; s < 9; s++) {
            const positions = new Float32Array(this.numParticles * 3);
            const colors = new Float32Array(this.numParticles * 3);

            // Dreamy Monet's Garden Palettes
            if (s === 0) { 
                cA.setHex(0xffa6c9); cB.setHex(0x89cff0); cC.setHex(0xe6e6fa); // Water Lilies (Pink/Blue/Lavender)
            } else if (s === 1) { 
                cA.setHex(0xe65c00); cB.setHex(0xffbb00); cC.setHex(0xffffff); // Deep Amber Gold / Brilliant Yellow-Gold / Radiant Pale Gold (强烈金色渐变)
            } else if (s === 2) { 
                cA.setHex(0xffffff); cB.setHex(0xa0c4ff); cC.setHex(0x4facfe); // Silver-White-Blue (银白蓝色)
            } else if (s === 3) { 
                cA.setHex(0xff6a88); cB.setHex(0xd07cfa); cC.setHex(0x7852ff); // Pink / Purple / Deep Violet (粉紫渐变)
            } else if (s === 4) { 
                cA.setHex(0xffe100); cB.setHex(0x7ade40); cC.setHex(0x0a7051); // Bright Yellow / Fresh Green / Deep Green (中间黄，周围绿)
            } else if (s === 5) {
                cA.setHex(0xd1498b); cB.setHex(0xda7cae); cC.setHex(0xbdd154); // Muted Deep Pink / Muted Soft Pink / Muted Yellow-Green (降低饱和度)
            } else if (s === 6) {
                cA.setHex(0x8a3a1c); cB.setHex(0xffeedd); cC.setHex(0x00d4ff); // Deep Rust / Pearl / Cyan glow (鹦鹉螺)
            } else if (s === 7) {
                cA.setHex(0x111625); cB.setHex(0x8899aa); cC.setHex(0xffffff); // Night sky / Ethereal Silver / Pure White Dew (优雅蛛网)
            } else if (s === 8) {
                cA.setHex(0x888888); cB.setHex(0xcccccc); cC.setHex(0xffffff); // Grayscale for Waterfall
            }

            // Determine absolute symmetry branches
            let branches = 1;
            if (s === 0) branches = 6; // Snowflake
            else if (s === 1) branches = 6; // Feathers (Changed from 4 to 6)
            else if (s === 2) branches = 12; // Ripples
            else if (s === 3) branches = 16; // Geometric Folded Star (16 branches = 8 perfectly symmetrical petals)
            else if (s === 4) branches = 1; // Tree Rings
            else if (s === 5) branches = 8; // Green/Purple Flower
            else if (s === 6) branches = 6; // Radial Rotational Symmetrical Nautilus (Hexagram/Star)
            else if (s === 7) branches = 16; // Spider Web (16 radial threads for delicate realism)
            else if (s === 8) branches = 1; // Waterfall (no symmetry needed)

            const particlesPerBranch = Math.ceil(this.numParticles / branches);

            for (let i = 0; i < this.numParticles; i++) {
                const b = i % branches;
                const localIndex = Math.floor(i / branches);
                
                const baseAngle = b * (Math.PI * 2 / branches);
                const isMirrored = b % 2 === 1; // Mirror matrix for alternating branches

                let x = 0, y = 0, z = 0;
                let tColor = 0;

                const t = localIndex / particlesPerBranch; 
                
                // Pseudo-random based on localIndex for absolute symmetry across branches
                const rand1 = Math.abs(Math.sin(localIndex * 12.9898) * 43758.5453) % 1;
                const rand2 = Math.abs(Math.cos(localIndex * 78.233) * 43758.5453) % 1;
                const rand3 = Math.abs(Math.sin(localIndex * 45.164) * 43758.5453) % 1;

                if (s === 0) { // 冰晶雪花 (Ice Snowflake)
                    const radius = Math.pow(t, 1.5) * 16;
                    const leafWidth = Math.sin(t * Math.PI) * 3.5;
                    const isVein = rand1 > 0.4;
                    let localAngle = 0;
                    if (isVein) {
                        const veinDir = rand2 > 0.5 ? 1 : -1;
                        localAngle = veinDir * Math.pow(t, 0.5) * 0.8 * leafWidth;
                    } else {
                        localAngle = (rand3 - 0.5) * 0.3 * leafWidth;
                    }
                    
                    if (isMirrored) localAngle = -localAngle;

                    x = radius * Math.cos(localAngle);
                    y = radius * Math.sin(localAngle);
                    z = (rand1 - 0.5) * 1.5;
                    tColor = t;
                } else if (s === 1) { // 黄金羽翼 (Golden Feather)
                    // t goes from 0 to 1 along the length of the feather
                    const length = 20.0;
                    const baseY = t * length - length * 0.4; // Shift down slightly
                    
                    // Overall graceful curve of the feather
                    const mainCurveX = Math.sin(t * Math.PI * 0.8) * 6.0;
                    
                    // Feather width profile (tapers at ends, wider in middle)
                    const widthProfile = Math.pow(Math.sin(t * Math.PI), 0.8) * 5.0;
                    
                    const isShaft = rand2 > 0.85; // 15% of particles form the central shaft
                    
                    let xOffset = 0;
                    let yOffset = 0;
                    let zOffset = 0;
                    
                    if (isShaft) {
                        // Dense, bright central shaft
                        xOffset = (rand1 - 0.5) * 0.3;
                        zOffset = (rand3 - 0.5) * 0.3 + 0.5; // Shaft slightly raised
                        tColor = t * 0.6; // Smooth gradient from base to tip (0.0 to 0.6)
                    } else {
                        // Vanes (barbs)
                        // rand1 determines distance from shaft
                        const distRatio = Math.pow(rand1, 1.2);
                        const distFromShaft = distRatio * widthProfile;
                        xOffset = distFromShaft;
                        
                        // Barbs angle upwards and outwards
                        const barbAngle = 0.6; // radians
                        yOffset = distFromShaft * Math.tan(barbAngle);
                        
                        // Secondary barbs (fine texture)
                        const barbTexture = Math.sin(t * 150.0) * 0.2 * distRatio;
                        xOffset += barbTexture;
                        
                        // Vanes curl downwards at the edges
                        zOffset = -Math.pow(distRatio, 2.0) * 2.0 + (rand3 - 0.5) * 0.4;
                        
                        // Rich, unclipped mathematical gradient
                        // Strictly bounded between 0.0 and 1.0 to prevent color clipping (harsh edges)
                        // Uses an easing curve so the deep gold breathes before reaching pure white at the extreme tips
                        tColor = (t * 0.4) + (Math.pow(distRatio, 1.5) * 0.6);
                    }
                    
                    if (isMirrored) {
                        xOffset = -xOffset;
                    }

                    x = mainCurveX + xOffset;
                    y = baseY + yOffset;
                    z = zOffset + Math.sin(t * Math.PI) * 2.0; // Overall Z curve
                } else if (s === 2) { // 银白涟漪 (Silver Ripples)
                    const rings = 10;
                    const ringIndex = Math.floor(t * rings);
                    const ringT = (t * rings) % 1; 
                    
                    const baseRadius = (ringIndex + 1) * 1.6;
                    const localTheta = ringT * (Math.PI * 2 / branches);
                    
                    const wave = Math.sin(localTheta * branches * 2) * 1.2;
                    const radius = baseRadius + wave + (rand1 - 0.5) * 0.2;
                    
                    let finalTheta = localTheta;
                    if (isMirrored) finalTheta = (Math.PI * 2 / branches) - localTheta;

                    x = radius * Math.cos(finalTheta);
                    y = radius * Math.sin(finalTheta);
                    z = Math.cos(baseRadius * 2) * 1.5;
                    tColor = ringIndex / rings;
                } else if (s === 3) { // 幽蓝星芒 (Blue Star / Geometric Folded Mandala)
                    const maxTheta = Math.PI * 2 / branches;
                    
                    // Create 5 distinct concentric geometric layers (origami folds)
                    const numLayers = 5;
                    const layer = Math.floor(rand1 * numLayers);
                    const layerScale = 1.0 - (layer / numLayers) * 0.7; // 1.0 down to 0.3
                    
                    // Base curve of the petal: sharp, exponential for a crystalline look
                    const petalCurve = Math.pow(t, 1.5); 
                    
                    // Add a geometric zig-zag fold along the edge
                    const folds = 3;
                    const zigZag = Math.abs(Math.sin(t * Math.PI * folds));
                    
                    // Combine base curve and zig-zag for the outer edge
                    const edgeRadius = 18 * layerScale * (petalCurve * 0.8 + zigZag * 0.2);
                    
                    // Fill the interior with a gradient of particles, concentrating on the edges (origami lines)
                    let fill = 1.0;
                    if (rand2 > 0.5) {
                        // 50% of particles form the solid glowing edges
                        fill = 1.0;
                    } else {
                        // 50% fill the interior smoothly
                        fill = Math.pow(rand2 / 0.5, 0.5);
                    }
                    
                    const radius = edgeRadius * fill;
                    
                    // The angle within the half-petal
                    let localTheta = t * maxTheta;
                    
                    // Add a slight twist to the fold for a dynamic "flowing" look
                    const twist = Math.sin(radius * 0.3) * 0.15 * (1.0 - layerScale);
                    localTheta += twist;
                    
                    // Mirror matrix for absolute symmetry
                    if (isMirrored) {
                        localTheta = maxTheta - localTheta;
                    }

                    x = radius * Math.cos(localTheta);
                    y = radius * Math.sin(localTheta);
                    
                    // 3D Origami Z-folding
                    // The center is deep, the tips fold upwards, and the zig-zags create sharp ridges
                    const zRidge = (fill === 1.0) ? (zigZag * 2.0) : 0;
                    z = (layerScale * 4.0) - 2.0 + (petalCurve * 3.0) + zRidge + (rand3 - 0.5) * 0.4;
                    
                    // Color gradient based on layer and position
                    tColor = (layer / numLayers) * 0.4 + t * 0.6;
                } else if (s === 4) { // 岁月年轮 (Tree Rings)
                    // We increase branches slightly to give the rings a natural radial splitting/cracking texture
                    const numRings = 40; 
                    const baseRing = Math.floor(Math.pow(rand1, 1.2) * numRings); // Skew slightly towards center
                    const ringNormalized = baseRing / numRings;
                    
                    const theta = rand2 * Math.PI * 2;
                    let radius = (ringNormalized * 15.0) + 0.5; 
                    
                    // Complex, organic wobble (simulating how trees grow asymmetrically)
                    const wobbleBase = Math.sin(theta * 3.0 + ringNormalized * 5.0) * 0.5;
                    const wobbleDetail = Math.cos(theta * 11.0) * Math.sin(theta * 7.0) * 0.3;
                    const ageWobble = (wobbleBase + wobbleDetail) * Math.pow(ringNormalized, 0.8) * 3.0;
                    
                    radius += ageWobble;
                    
                    // Create distinctive, sharp ring edges and fuzzy cambium layers between them
                    let ringWidth;
                    if (rand3 > 0.85) {
                        ringWidth = (Math.random() - 0.5) * 1.5; // Soft wood (between rings)
                    } else {
                        ringWidth = (Math.random() - 0.5) * 0.15; // Hard latewood (dense ring line)
                    }
                    radius += ringWidth;
                    
                    // Natural heartwood splitting/cracking lines radiating outwards
                    const crackAngle = Math.floor(theta / (Math.PI/4)) * (Math.PI/4); // 8 potential major cracks
                    const isCrack = Math.abs(theta - crackAngle) < 0.05 && rand1 > 0.3;
                    if (isCrack) {
                        radius *= (1.0 + (rand1 * 0.1)); // Extend particles outwards slightly
                    }
                    
                    // 3D elevation: center is slightly higher, overall shape is slightly dished/warped like old wood
                    const dishShape = Math.pow(ringNormalized, 2.0) * -2.0; 
                    const ringRidges = Math.sin(ringNormalized * Math.PI * numRings) * 0.15;
                    
                    z = dishShape + ringRidges + (isCrack ? -0.5 : 0) + (rand3 - 0.5) * 0.2;
                    if (ringNormalized < 0.05) z += 1.5; // Heartwood center bump
                    
                    x = radius * Math.cos(theta);
                    y = radius * Math.sin(theta);
                    
                    // Color mapping: edge is lighter, dense rings are darker
                    tColor = ringNormalized + (rand3 > 0.85 ? 0.3 : 0.0);
                } else if (s === 5) { // 幽绿幻花 (Green/Purple Flower)
                    // Complex multi-layered orchid/lily structure
                    const isCenter = rand1 > 0.85; // 15% stamen
                    const isOuter = rand1 < 0.3; // 30% outer tendrils
                    
                    if (isCenter) {
                        // Delicate stamen
                        const stamenLength = t * 9.0;
                        const stamenCurve = Math.pow(t, 2.0) * 2.0;
                        let localAngle = Math.sin(t * Math.PI * 4.0) * 0.2;
                        if (isMirrored) localAngle = -localAngle;
                        
                        x = stamenLength * Math.cos(localAngle);
                        y = stamenLength * Math.sin(localAngle);
                        z = stamenCurve + (rand2 - 0.5) * 2.0;
                        tColor = 1.0; // Bright center
                    } else if (isOuter) {
                        // Sweeping outer tendrils
                        const tendrilT = t;
                        const radius = tendrilT * 22.0;
                        const sweep = Math.pow(tendrilT, 1.5) * Math.PI * 0.8;
                        let localAngle = sweep;
                        if (isMirrored) localAngle = -localAngle;
                        
                        x = radius * Math.cos(localAngle);
                        y = radius * Math.sin(localAngle);
                        z = -tendrilT * 5.0 + Math.sin(tendrilT * Math.PI * 8.0) * 1.0;
                        tColor = tendrilT * 0.3; // Darker edges
                    } else {
                        // Main overlapping petals
                        const petalT = t;
                        const radius = petalT * 16.0;
                        const width = Math.sin(petalT * Math.PI) * Math.pow(1.0 - petalT, 0.5) * 8.0;
                        
                        // Delicate internal veins
                        const vein = Math.sin(petalT * Math.PI * 20.0) * 0.15 * width;
                        
                        let localAngle = (rand2 - 0.5) * width * 0.1 + vein;
                        if (isMirrored) localAngle = -localAngle;
                        
                        x = radius * Math.cos(localAngle);
                        y = radius * Math.sin(localAngle);
                        
                        // Elegant cup shape
                        z = Math.sin(petalT * Math.PI) * 4.0 - petalT * 2.0;
                        tColor = 0.4 + petalT * 0.5;
                    }
                } else if (s === 6) { // 鹦鹉螺 (Nautilus Shell) - Masterpiece Rebirth
                    // A single, glorious macroscopic Nautilus shell. 
                    // Half-cut mathematically to reveal the intricate septa and siphuncle.
                    const turns = 3.8;
                    const maxTheta = turns * 2.0 * Math.PI;
                    const b = 0.17; // Classic nautilus logarithmic growth rate
            
                    const elementType = rand1; 
                    
                    if (elementType > 0.3) {
                        // 1. Outer Shell (70% particles)
                        const theta = Math.pow(t, 0.6) * maxTheta;
                        const R_center = Math.exp(b * theta);
                        const r_tube = R_center * 0.53; 
                        
                        // Cutaway View: For older whorls, only render the back half of the shell
                        // to expose the inner chambers. The massive living chamber is fully rendered.
                        let rand2_mod = rand2;
                        if (theta < maxTheta - Math.PI) {
                            // Map to [0.5, 1.0] so phi explores PI to 2PI (the back half, cut across Z-axis)
                            rand2_mod = 0.5 + 0.5 * rand2;
                        }
                        const phi = rand2_mod * Math.PI * 2.0;
            
                        let distort = 1.0;
                        if (Math.cos(phi) < 0) distort = 1.0 + 0.35 * Math.cos(phi); 
            
                        const surfaceR = distort + Math.sin(theta * 200.0) * 0.015; // Growth lines
                        
                        const crossX = r_tube * surfaceR * Math.cos(phi);
                        const crossZ = r_tube * surfaceR * Math.sin(phi) * 0.65; // Flattened side
            
                        x = R_center * Math.cos(theta) + crossX * Math.cos(theta);
                        y = R_center * Math.sin(theta) + crossX * Math.sin(theta);
                        z = crossZ;
            
                        let isStripe = false;
                        if (Math.cos(phi) > -0.3) {
                            const stripeTheta = theta * 14.0;
                            const wave = Math.sin(phi * 4.0 + theta * 3.0);
                            if (Math.sin(stripeTheta + Math.abs(phi * 1.5) * 2.0 + wave * 1.5) > 0.5) isStripe = true;
                        }
            
                        if (isStripe) {
                            tColor = 0.05 + rand3 * 0.1; // Deep Rust Tiger Stripes
                        } else {
                            tColor = 0.4 + Math.pow(Math.sin(phi * 2.0 + theta), 2.0) * 0.1 + rand3 * 0.1; // Pearl
                        }
            
                    } else if (elementType > 0.05) {
                        // 2. Translucent Septa (Inner Chambers) (25%)
                        const numChambers = 38;
                        const chamberIndex = Math.floor(Math.pow(t, 1.3) * numChambers);
                        // Stop chambers before the open living chamber
                        const theta = (chamberIndex / numChambers) * (maxTheta - Math.PI * 1.0);
                        
                        const R_center = Math.exp(b * theta);
                        // Fit perfectly inside the shell
                        const r_tube = R_center * 0.52;
            
                        const r_fill = Math.sqrt(rand2);
                        const phi = rand3 * Math.PI * 2.0;
                        
                        let distort = 1.0;
                        if (Math.cos(phi) < 0) distort = 1.0 + 0.35 * Math.cos(phi);
            
                        // Concave bowing of the biological membrane
                        const finalTheta = theta - 0.4 * Math.sin(r_fill * Math.PI) * 0.25;
            
                        const crossX = r_tube * r_fill * distort * Math.cos(phi);
                        const crossZ = r_tube * r_fill * distort * Math.sin(phi) * 0.65;
            
                        x = R_center * Math.cos(finalTheta) + crossX * Math.cos(finalTheta);
                        y = R_center * Math.sin(finalTheta) + crossX * Math.sin(finalTheta);
                        z = crossZ;
            
                        // Vibrant glowing cyan/blue bioluminescence
                        tColor = 0.75 + (chamberIndex / numChambers) * 0.25; 
            
                    } else {
                        // 3. Siphuncle Core (Central Energy Tube) (5%)
                        const theta = t * (maxTheta - Math.PI * 1.0);
                        const R_center = Math.exp(b * theta);
                        const r_tube = R_center * 0.52;
                        
                        const siphX = r_tube * 0.15; // Pass closer to inner curve
                        const R_siph = r_tube * 0.06;
                        
                        const r_fill = Math.sqrt(rand2) * R_siph;
                        const phi = rand3 * Math.PI * 2.0;
                        
                        const crossX = siphX + r_fill * Math.cos(phi);
                        const crossZ = r_fill * Math.sin(phi) * 0.65;
                        
                        x = R_center * Math.cos(theta) + crossX * Math.cos(theta);
                        y = R_center * Math.sin(theta) + crossX * Math.sin(theta);
                        z = crossZ;
                        
                        tColor = 1.0; // Pure white/cyan intense glow
                    }
            
                    // --- GLOBAL SCALING & ELEGANT POSING ---
                    const max_R = Math.exp(b * maxTheta);
                    // User requested 12.0 scale instead of 18.0
                    const scale = 12.0 / max_R;
                    
                    x *= scale;
                    y *= scale;
                    z *= scale;
            
                    // Rotate into the classic golden ratio spiral display angle
                    const rotZ = Math.PI * 0.8 - maxTheta; 
                    const xr = x * Math.cos(rotZ) - y * Math.sin(rotZ);
                    const yr = x * Math.sin(rotZ) + y * Math.cos(rotZ);
                    x = xr; y = yr;
            
                    // Tilt to beautifully show off the half-cut insides and outer shell simultaneously
                    const tiltX = -0.45; // Tilt forward
                    const y2 = y * Math.cos(tiltX) - z * Math.sin(tiltX);
                    const z2 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
                    y = y2; z = z2;
            
                    const tiltY = 0.35; // Swivel slightly
                    const x3 = x * Math.cos(tiltY) + z * Math.sin(tiltY);
                    const z3 = -x * Math.sin(tiltY) + z * Math.cos(tiltY);
                    x = x3; z = z3;
            
                    // Push outwards slightly so the 6 spiral origins form a beautiful central hex-knot
                    x += 3.6; 
                    y -= 3.1;
                } else if (s === 7) { // 蛛网 (Spider Web)
                    // Structural framework of a spider web (Orb Weaver style)
                    const numConcentricRings = 24; // Reverted back to original density
                    const isRadialThread = rand1 > 0.85; // Reverted back to 15%
                    
                    if (isRadialThread) {
                        // Thick, taut radial threads
                        // Radius from 1 to 19 to leave a tiny delicate hub (Reverted shape)
                        const radius = 1.0 + Math.pow(t, 0.7) * 19.0; 
                        const localTheta = 0; // Exactly on the branch boundary (Reverted)
                        
                        x = radius * Math.cos(localTheta);
                        y = radius * Math.sin(localTheta);
                        
                        // A graceful 3D concave shape like a web pushed by a gentle night breeze
                        const concavity = -Math.pow(radius / 32.0, 1.5) * 5.0; // Reverted
                        z = concavity;
                        
                        // BUT: We increase brightness significantly
                        tColor = (radius/32.0) * 0.6 + 0.5; // Made brighter
                    } else {
                        // Concentric (spiral) sticky threads
                        const ringIndex = Math.floor(rand2 * numConcentricRings);
                        const ringProgress = (ringIndex + rand1 * 0.1) / numConcentricRings; // Reverted fuzziness
                        
                        // Leave empty hub, space threads outward logarithmically
                        const radiusBase = 2.0 + Math.pow(ringProgress, 0.9) * 18.0; // Reverted
                        
                        const maxTheta = Math.PI * 2 / branches;
                        const localTheta = t * maxTheta;
                        const normalizedSag = localTheta / maxTheta; // 0 to 1
                        
                        // Sag depth increases as rings get larger (gravity effect on longer threads)
                        const sagDepth = 0.5 + Math.pow(ringProgress, 1.5) * 2.5; // Reverted
                        const droop = normalizedSag * (1.0 - normalizedSag) * 4.0 * sagDepth; // Reverted
                        
                        const sagRadius = radiusBase - droop;
                        
                        x = sagRadius * Math.cos(localTheta);
                        y = sagRadius * Math.sin(localTheta);
                        
                        // Match concavity of the radial threads
                        const concavity = -Math.pow(sagRadius / 32.0, 1.5) * 5.0; // Reverted
                        
                        // Dew drops slide towards the lowest point of the sag (normalizedSag ~ 0.5)
                        const distToLowest = Math.abs(normalizedSag - 0.5);
                        // Reverted distribution
                        const isDew = rand3 > 0.94 && ringProgress > 0.3 && distToLowest < 0.25;
                        
                        z = concavity + (isDew ? (rand3 - 0.5) * 0.8 : (Math.random() - 0.5) * 0.08); // Reverted
                        
                        // BUT: Keep it extremely bright
                        tColor = ringProgress * 1.5 + (isDew ? 6.0 : 0.0); // Extreme brightness factor for bloom
                    }
                } else if (s === 8) { // 粒子瀑布 (Waterfall)
                    // The actual waterfall animation is handled in the vertex shader.
                    // Here we just distribute the particles in a dense block so the shader can pick them up.
                    x = (rand1 - 0.5) * 40.0;
                    y = (rand2 - 0.5) * 80.0;
                    z = (rand3 - 0.5) * 20.0;
                    tColor = rand1;
                }

                // Apply rotation matrix for the branch
                const cosB = Math.cos(baseAngle);
                const sinB = Math.sin(baseAngle);
                const finalX = x * cosB - y * sinB;
                const finalY = x * sinB + y * cosB;
                const finalZ = z;

                // Symmetrical color blending
                let noisyTColor = tColor + (rand1 - 0.5) * 0.2;
                noisyTColor = Math.max(0, Math.min(1, noisyTColor));

                if (noisyTColor < 0.5) {
                    finalColor.lerpColors(cA, cB, noisyTColor * 2);
                } else {
                    finalColor.lerpColors(cB, cC, (noisyTColor - 0.5) * 2);
                }

                positions[i * 3] = finalX;
                positions[i * 3 + 1] = finalY;
                positions[i * 3 + 2] = finalZ;
                colors[i * 3] = finalColor.r;
                colors[i * 3 + 1] = finalColor.g;
                colors[i * 3 + 2] = finalColor.b;
            }
            this.shapes.push({ positions, colors });
        }
    }

    createParticles() {
        const geo = new THREE.BufferGeometry();
        const initialShape = this.shapes[0];
        
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(initialShape.positions), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(initialShape.colors), 3));
        
        geo.setAttribute('targetPosition', new THREE.BufferAttribute(new Float32Array(initialShape.positions), 3));
        geo.setAttribute('targetColor', new THREE.BufferAttribute(new Float32Array(initialShape.colors), 3));
        
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uTransitionProgress: { value: 0 },
                uSize: { value: 2.0 },
                uSymmetryFolds: { value: 12.0 },
                uWaveSpeed: { value: 1.0 },
                uColorShift: { value: 0.4 },
                uGlobalHue: { value: 0.0 },
                uCoolTones: { value: 0.0 },
                uWaterfallBlend: { value: 0.0 },
                uMorphTime: { value: 0.0 },
                uAudioColorTime: { value: 0.0 },
                uAudioPulse: { value: 0.0 },
                uAudioBass: { value: 0.0 },
                uAudioMid: { value: 0.0 },
                uAudioTreble: { value: 0.0 },
                uMusicBlend: { value: 0.0 }
            },
            vertexShader: `
                attribute vec3 color;
                attribute vec3 targetPosition;
                attribute vec3 targetColor;
                uniform float uTime;
                uniform float uTransitionProgress;
                uniform float uSize;
                uniform float uSymmetryFolds;
                uniform float uWaveSpeed;
                uniform float uWaterfallBlend;
                uniform float uMorphTime;
                uniform float uAudioPulse;
                uniform float uAudioBass;
                uniform float uAudioMid;
                uniform float uAudioTreble;
                varying vec3 vColor;
                varying float vTwinkle;
                varying float vPrismaticPhase;
                varying float vAudioPulse;
                varying float vAudioBass;
                varying float vAudioMid;
                varying float vAudioTreble;
                varying float vWaterfallBlend;
                
                // Advanced Easing functions
                float easeInOutExpo(float x) {
                    return x == 0.0 ? 0.0 : x == 1.0 ? 1.0 : x < 0.5 ? pow(2.0, 20.0 * x - 10.0) / 2.0 : (2.0 - pow(2.0, -20.0 * x + 10.0)) / 2.0;
                }

                float easeInOutSine(float x) {
                    return -(cos(3.14159265 * x) - 1.0) / 2.0;
                }

                float easeOutBack(float x) {
                    float c1 = 1.70158;
                    float c3 = c1 + 1.0;
                    return 1.0 + c3 * pow(x - 1.0, 3.0) + c1 * pow(x - 1.0, 2.0);
                }

                void main() {
                    // 1. Calculate Spatial Delay for "Flower Flow"
                    float radius = length(position);
                    float targetRadius = length(targetPosition);
                    float avgRadius = (radius + targetRadius) * 0.5;
                    
                    float angle = atan(position.y, position.x);
                    
                    // Delay components: outward bloom + spiral + noise
                    float radialDelay = (avgRadius / 20.0) * 0.3; 
                    float spiralDelay = (sin(angle * 5.0 + avgRadius * 1.0) * 0.5 + 0.5) * 0.2;
                    float randomDelay = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453) * 0.1;
                    
                    float delay = clamp(radialDelay + spiralDelay + randomDelay, 0.0, 0.8);
                    
                    // 2. Calculate Local Progress
                    float duration = 2.0; // Faster but still smooth transition
                    float p = clamp((uTransitionProgress - delay) / duration, 0.0, 1.0);
                    
                    // 3. Apply Advanced Easing
                    // Smootherstep for the ultimate buttery transition
                    float easedP = p * p * p * (p * (p * 6.0 - 15.0) + 10.0);
                    
                    // 4. Interpolate Position
                    vec3 pos = mix(position, targetPosition, easedP);
                    
                    // 5. Add "Geometric Folding" Twist during transition
                    // The twist peaks at the middle of the transition.
                    // We use easeInOutSine to make the twist curve smoother and more organic.
                    float twistProgress = sin(p * 3.14159265);
                    float twistAmount = twistProgress * 3.14 * (1.0 - avgRadius/35.0); // Beautiful 180-degree swirling vortex
                    float cosT = cos(twistAmount);
                    float sinT = sin(twistAmount);
                    
                    // Apply 3D fold
                    pos.xy = mat2(cosT, -sinT, sinT, cosT) * pos.xy;
                    pos.xz = mat2(cosT, -sinT, sinT, cosT) * pos.xz;
                    
                    // Continuous Flowing & Geometric Folding Transformation
                    // Radius-based to preserve absolute symmetry
                    float r = length(pos.xy);
                    float thetaFlow = atan(pos.y, pos.x);
                    
                    // Universal symmetry multiplier for the flow (Kaleidoscope effect)
                    float sym = cos(thetaFlow * uSymmetryFolds) * 0.5 + 0.5;
                    
                    // Magnificent Radiant Light Waves (Overlapping harmonics)
                    float wave1 = sin(r * 0.4 - uTime * 0.3 * uWaveSpeed);
                    float wave2 = cos(r * 0.15 + uTime * 0.15 * uWaveSpeed);
                    float radiantWave = wave1 * wave2 * (1.0 + sym);
                    
                    // Radial Twist (Complex Elegant Visual Flow) - SLOWED DOWN
                    float flowTwistAngle = sin(r * 0.05 - uTime * 0.02) * cos(r * 0.1 + uTime * 0.01) * 0.8;
                    float cFlow = cos(flowTwistAngle);
                    float sFlow = sin(flowTwistAngle);
                    pos.xy = mat2(cFlow, -sFlow, sFlow, cFlow) * pos.xy;
                    
                    // --- NEW: Ethereal Flowing Bend (Subtle curl animation) ---
                    // Applies a gentle, flowing wave along the Y axis, making feathers and rays look alive
                    float curl = sin(pos.y * 0.15 - uTime * 0.4) * 1.2;
                    float curlMask = smoothstep(0.0, 25.0, abs(pos.y)); // Apply more curl towards the tips
                    pos.x += curl * curlMask;
                    pos.z += cos(pos.y * 0.15 - uTime * 0.4) * 0.8 * curlMask;
                    
                    // Add subtle barb flutter (wind ripple effect on the edges)
                    float flutter = sin(pos.x * 2.0 + uTime * 1.5) * 0.2 * curlMask;
                    pos.z += flutter;
                    
                    // Geometric Z-Folding (Breathing/Blooming effect with radiant waves)
                    float zFold = cos(r * 0.3 - uTime * 0.1) * 1.0;
                    pos.z += zFold + radiantWave * 1.5;
                    
                    // Graceful expansion: bass pushes the particles outward powerfully
                    float scale = 1.0 + radiantWave * 0.05 + uAudioBass * 1.5;
                    pos.xy *= scale;
                    
                    // Audio-driven twist: mid frequencies gently rotate the shape
                    float audioTwist = uAudioMid * 0.3 * sin(r * 0.1 - uTime * 0.5);
                    float cosA = cos(audioTwist);
                    float sinA = sin(audioTwist);
                    pos.xy = mat2(cosA, -sinA, sinA, cosA) * pos.xy;
                    
                    // Z-axis ripple: bass creates a forward-flowing wave
                    float audioRipple = sin(r * 0.5 - uTime * 3.0);
                    pos.z += uAudioBass * 4.0 * audioRipple;
                    
                    // --- NEW: Continuous Morphing between Exquisite Forms ---
                    float morphStage = mod(uMorphTime, 4.0);
                    float morphBlend = smoothstep(0.2, 0.8, fract(morphStage));
                    
                    vec3 p0 = pos; // Form 0: The Radiant Plane
                    
                    // Form 1: The Cosmic Dome
                    float phi = r * 0.08;
                    float domeR = 25.0;
                    vec3 p1 = vec3(
                        domeR * sin(phi) * cos(thetaFlow),
                        domeR * sin(phi) * sin(thetaFlow),
                        domeR * cos(phi) - domeR + pos.z * 0.6
                    );
                    
                    // Form 2: The Quantum Vortex
                    float vortex = r * 0.15 - uTime * 0.2;
                    vec3 p2 = vec3(
                        r * cos(thetaFlow + vortex) * (1.0 - r*0.01),
                        r * sin(thetaFlow + vortex) * (1.0 - r*0.01),
                        pos.z * 1.5 + r * 0.5 + sin(thetaFlow * uSymmetryFolds + uTime * 0.5) * 5.0
                    );
                    
                    // Form 3: The Sacred Chalice (Lotus/Crown)
                    float cup = smoothstep(10.0, 40.0, r) * 30.0;
                    float petal = sin(thetaFlow * uSymmetryFolds) * (cup * 0.2);
                    vec3 p3 = vec3(
                        pos.x * (1.0 - cup * 0.015),
                        pos.y * (1.0 - cup * 0.015),
                        pos.z + cup + petal
                    );
                    
                    vec3 morphedPos;
                    if (morphStage < 1.0) {
                        morphedPos = mix(p0, p1, morphBlend);
                    } else if (morphStage < 2.0) {
                        morphedPos = mix(p1, p2, morphBlend);
                    } else if (morphStage < 3.0) {
                        morphedPos = mix(p2, p3, morphBlend);
                    } else {
                        morphedPos = mix(p3, p0, morphBlend);
                    }
                    pos = morphedPos;
                    
                    // --- NEW: Waterfall Logic ---
                    if (uWaterfallBlend > 0.0) {
                        float seed1 = fract(sin(dot(targetPosition.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
                        float seed2 = fract(cos(dot(targetPosition.xyz, vec3(39.346, 11.135, 83.155))) * 43758.5453);
                        float seed3 = fract(sin(dot(targetPosition.xyz, vec3(73.156, 52.235, 9.151))) * 43758.5453);
                        
                        float fallSpeed = 0.5 + seed1 * 0.8 + uAudioBass * 0.5;
                        float phase = fract(seed2 + uTime * fallSpeed * 0.15); // 0 to 1 falling
                        
                        vec3 wPos;
                        wPos.y = 40.0 - phase * 80.0; // Fall from 40 to -40
                        
                        // Width and depth (denser in the middle)
                        float spread = pow(seed1, 1.5);
                        wPos.x = (seed2 - 0.5) * 40.0 * spread;
                        wPos.z = (seed3 - 0.5) * 20.0 * spread;
                        
                        // Add fluid turbulence
                        float noise1 = sin(wPos.y * 0.15 + uTime) * cos(wPos.x * 0.1);
                        float noise2 = cos(wPos.y * 0.1 - uTime * 1.2) * sin(wPos.z * 0.1);
                        wPos.x += noise1 * 6.0;
                        wPos.z += noise2 * 6.0;
                        
                        // Splash at the bottom
                        float splashStart = 0.85;
                        if (phase > splashStart) {
                            float splashP = (phase - splashStart) / (1.0 - splashStart); // 0 to 1
                            // Bounce up
                            wPos.y = -28.0 + sin(splashP * 3.14159) * 12.0 * seed1;
                            // Spread out radially
                            float angle = seed2 * 6.28 + splashP * 3.0;
                            float radius = splashP * 35.0 * (0.5 + seed3 * 0.5);
                            wPos.x += cos(angle) * radius;
                            wPos.z += sin(angle) * radius;
                        }
                        
                        pos = mix(pos, wPos, uWaterfallBlend);
                    }
                    
                    // Prismatic Color Phase (Spectacular prismatic color shifts)
                    vPrismaticPhase = r * 0.15 - uTime * 0.1 + thetaFlow * 3.0;
                    
                    // 7. Twinkle Effect Calculation (Ice crystal glint)
                    float seed = dot(targetPosition, vec3(12.9898, 78.233, 45.164));
                    float rand = fract(sin(seed) * 43758.5453);
                    vTwinkle = 0.5 + 0.5 * sin(uTime * (0.1 + rand * 0.15) + rand * 6.28);
        
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Size attenuation with pulse and radiant wave intensity
                    float pulseSize = uSize * (0.8 + 0.6 * vTwinkle + abs(radiantWave) * 0.5 + uAudioBass * 0.8 + uAudioTreble * 0.3);
                    gl_PointSize = pulseSize * (25.0 / -mvPosition.z);
                    gl_PointSize = max(gl_PointSize, 0.5);
                    
                    vColor = mix(color, targetColor, easedP);
                    vAudioPulse = uAudioPulse;
                    vAudioBass = uAudioBass;
                    vAudioMid = uAudioMid;
                    vAudioTreble = uAudioTreble;
                    vWaterfallBlend = uWaterfallBlend;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uAudioColorTime;
                uniform float uColorShift;
                uniform float uGlobalHue;
                uniform float uCoolTones;
                uniform float uMusicBlend;
                varying vec3 vColor;
                varying float vTwinkle;
                varying float vPrismaticPhase;
                varying float vAudioPulse;
                varying float vAudioBass;
                varying float vAudioMid;
                varying float vAudioTreble;
                varying float vWaterfallBlend;
                
                vec3 hueShift(vec3 color, float hue) {
                    const vec3 k = vec3(0.57735, 0.57735, 0.57735);
                    float cosAngle = cos(hue);
                    return vec3(color * cosAngle + cross(k, color) * sin(hue) + k * dot(k, color) * (1.0 - cosAngle));
                }
                
                void main() {
                    vec2 uv = gl_PointCoord - vec2(0.5);
                    float d = length(uv);
                    if (d > 0.5) discard;
                    
                    // Dreamy Opalescent Brightness Shift
                    float brightnessShift = 0.9 + 0.3 * sin(vPrismaticPhase);
                    vec3 opalescentTint = vec3(
                        1.0 + 0.15 * sin(vPrismaticPhase),
                        1.0 + 0.15 * sin(vPrismaticPhase + 2.094),
                        1.0 + 0.15 * sin(vPrismaticPhase + 4.188)
                    );
                    
                    // Blend original color with dreamy brightness and soft tint
                    // Add intense audio-reactive color burst, heavily synced to bass/mid
                    vec3 audioBurstColor = mix(vec3(1.0, 0.2, 0.5), vec3(0.2, 1.0, 0.8), sin(vPrismaticPhase * 2.0) * 0.5 + 0.5);
                    vec3 baseColor = vColor * mix(vec3(1.0), opalescentTint * brightnessShift, uColorShift);
                    // Make the color burst extremely responsive to the beat, only when music plays
                    baseColor = mix(baseColor, audioBurstColor, clamp(vAudioBass * 1.2 + vAudioMid * 0.5, 0.0, 1.0) * uMusicBlend);
                    
                    // Apply global hue shift PLUS a spatial gradient
                    // Audio color time drives the gradient flow, mid frequencies gently expand the color variance
                    float spatialHue = sin(vPrismaticPhase * 0.3 - uAudioColorTime * 0.5) * (0.25 + vAudioMid * 0.4); 
                    float dynamicHue = uGlobalHue + spatialHue + uAudioColorTime * 0.2;
                    // Only apply dynamic moving hue if music plays, otherwise use steady global hue (0.0 unless set)
                    baseColor = hueShift(baseColor, mix(uGlobalHue, dynamicHue, uMusicBlend));
                    
                    // Cool tones override (Specific 4-stage gradient sequence)
                    float luminance = dot(baseColor, vec3(0.299, 0.587, 0.114));
                    vec3 baseSilver = vec3(luminance) * vec3(0.9, 0.95, 1.0);
                    
                    // Temporal progression (Music driven)
                    float tProgress = uAudioColorTime * 0.5; // Smooth, graceful cycle speed
                    float stage = mod(tProgress, 4.0);
                    float f = 0.5 - 0.5 * cos(fract(stage) * 3.14159265); // Cosine interpolation for perfect natural blending
                    
                    // Define the core colors
                    vec3 cSilver = vec3(0.75, 0.85, 0.95);
                    vec3 cWhite  = vec3(1.0, 1.0, 1.0);
                    vec3 cBlue   = vec3(0.05, 0.35, 1.0);
                    vec3 cPurple = vec3(0.5, 0.05, 0.9);
                    
                    // Define the 4 gradient pairs requested:
                    // 0: 银白色渐变 (Silver -> White)
                    vec3 A0 = cSilver; vec3 B0 = cWhite;
                    // 1: 银色与蓝色渐变 (Silver -> Blue)
                    vec3 A1 = cSilver; vec3 B1 = cBlue;
                    // 2: 蓝紫色渐变 (Blue -> Purple)
                    vec3 A2 = cBlue;   vec3 B2 = cPurple;
                    // 3: 银紫色渐变 (Silver -> Purple)
                    vec3 A3 = cSilver; vec3 B3 = cPurple;
                    
                    vec3 currentA, currentB;
                    if (stage < 1.0) {
                        currentA = mix(A0, A1, f); currentB = mix(B0, B1, f);
                    } else if (stage < 2.0) {
                        currentA = mix(A1, A2, f); currentB = mix(B1, B2, f);
                    } else if (stage < 3.0) {
                        currentA = mix(A2, A3, f); currentB = mix(B2, B3, f);
                    } else {
                        currentA = mix(A3, A0, f); currentB = mix(B3, B0, f);
                    }
                    
                    // Spatial distribution for the gradient (center vs edges, plus swirl)
                    float spatialMix = 0.5 + 0.5 * sin(vPrismaticPhase * 0.5 + luminance * 2.0);
                    
                    vec3 coolTint = mix(currentA, currentB, spatialMix);
                    
                    // Add a subtle shimmer
                    coolTint = mix(coolTint, vec3(1.0), sin(vPrismaticPhase * 0.8 + uAudioColorTime) * 0.1);
                    
                    // Combine with luminance to preserve 3D volume
                    vec3 coolColor = mix(baseSilver, coolTint, 0.85) * 1.2;
                    // Only apply cool color override if music is playing
                    baseColor = mix(baseColor, mix(baseColor, coolColor, uCoolTones), uMusicBlend);
                    
                    // Waterfall grayscale override
                    if (vWaterfallBlend > 0.0) {
                        float gray = dot(baseColor, vec3(0.299, 0.587, 0.114));
                        gray = smoothstep(0.0, 0.8, gray) * 1.5; // High contrast fluid look
                        vec3 waterfallColor = vec3(gray) * vec3(0.9, 0.95, 1.0); // Slight icy/water tint
                        baseColor = mix(baseColor, waterfallColor, vWaterfallBlend);
                    }
                    
                    // 1. Exponential Glow (softer, more natural light falloff)
                    float glow = exp(-d * (6.0 - vAudioBass * 2.5));
                    
                    // 2. Bright Core (white hot center)
                    float core = exp(-d * (25.0 - vAudioBass * 8.0));
                    
                    // 3. Complex Star Rays (Kaleidoscope reflections) - SHARPENED FOR ICE CRYSTAL LOOK
                    float angle = atan(uv.y, uv.x);
                    float rays = pow(abs(cos(angle * 4.0)), 16.0) * exp(-d * 4.0) * (0.9 + vAudioTreble * 0.2);
                    float rays2 = pow(abs(cos(angle * 4.0 + 0.78539)), 24.0) * exp(-d * 6.0) * (0.5 + vAudioTreble * 0.1);
                    
                    // Combine effects
                    float alpha = (glow + core + rays + rays2) * vTwinkle;
                    
                    // Color mix: shift towards white at the core, dynamic on the rays
                    vec3 finalColor = mix(baseColor, vec3(1.0), core * 0.8);
                    finalColor += baseColor * rays * 0.5;
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.particleSystem = new THREE.Points(geo, mat);
        this.scene.add(this.particleSystem);
    }

    createBackground() {
        // Stars
        const starGeo = new THREE.BufferGeometry();
        const starPos = new Float32Array(8000 * 3);
        const starColors = new Float32Array(8000 * 3);
        for(let i=0; i<8000; i++) {
            starPos[i*3] = (Math.random() - 0.5) * 200;
            starPos[i*3+1] = (Math.random() - 0.5) * 200;
            starPos[i*3+2] = (Math.random() - 0.5) * 200;
            
            const shade = Math.random() * 0.5 + 0.5;
            starColors[i*3] = shade;
            starColors[i*3+1] = shade;
            starColors[i*3+2] = shade;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
        
        const starMat = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        this.stars = new THREE.Points(starGeo, starMat);
        this.scene.add(this.stars);
        
        // Shooting stars
        this.shootingStars = [];
        for(let i=0; i<8; i++) {
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(6);
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const mat = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending
            });
            const line = new THREE.Line(geo, mat);
            this.scene.add(line);
            
            const resetStar = (star: any) => {
                star.x = (Math.random() - 0.5) * 150;
                star.y = Math.random() * 100 + 50;
                star.z = (Math.random() - 0.5) * 100 - 50;
                star.vx = -0.5 - Math.random() * 1.5;
                star.vy = -1.0 - Math.random() * 2.0;
                star.vz = 0;
                star.length = Math.random() * 8 + 4;
                star.active = Math.random() > 0.5;
                star.timer = Math.random() * 200;
            };
            
            const starObj = { mesh: line, reset: resetStar, x:0, y:0, z:0, vx:0, vy:0, vz:0, length:0, active:false, timer:0 };
            resetStar(starObj);
            this.shootingStars.push(starObj);
        }
    }

    setShape(index: number, isInternal: boolean = false, instant: boolean = false) {
        if (index === this.currentShapeIndex) return;
        // Do not allow external shape changes while in breathing mode
        if (this.isBreathingMode && !isInternal) return;
        
        this.currentShapeIndex = index;
        
        if (this.onShapeChangeCallback) {
            this.onShapeChangeCallback(index);
        }
        
        const geo = this.particleSystem.geometry;
        const posAttr = geo.attributes.position;
        const targetPosAttr = geo.attributes.targetPosition;
        const colAttr = geo.attributes.color;
        const targetColAttr = geo.attributes.targetColor;
        
        const newShape = this.shapes[index];
        
        if (instant) {
            for(let i=0; i<this.numParticles; i++) {
                posAttr.setXYZ(i, newShape.positions[i*3], newShape.positions[i*3+1], newShape.positions[i*3+2]);
                colAttr.setXYZ(i, newShape.colors[i*3], newShape.colors[i*3+1], newShape.colors[i*3+2]);
            }
            targetPosAttr.array.set(newShape.positions);
            targetColAttr.array.set(newShape.colors);
            
            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
            targetPosAttr.needsUpdate = true;
            targetColAttr.needsUpdate = true;
            
            this.targetWaterfallBlend = (index === 8) ? 1.0 : 0.0;
            this.currentWaterfallBlend = this.targetWaterfallBlend;
            (this.particleSystem.material as THREE.ShaderMaterial).uniforms.uWaterfallBlend.value = this.currentWaterfallBlend;
            
            (this.particleSystem.material as THREE.ShaderMaterial).uniforms.uTransitionProgress.value = 3.0;
            this.transitioning = false;
        } else {
            // When interrupting a transition, we just snap to the current target positions
            for(let i=0; i<this.numParticles; i++) {
                posAttr.setXYZ(i, targetPosAttr.getX(i), targetPosAttr.getY(i), targetPosAttr.getZ(i));
                colAttr.setXYZ(i, targetColAttr.getX(i), targetColAttr.getY(i), targetColAttr.getZ(i));
            }
            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
            
            targetPosAttr.array.set(newShape.positions);
            targetColAttr.array.set(newShape.colors);
            targetPosAttr.needsUpdate = true;
            targetColAttr.needsUpdate = true;
            
            this.targetWaterfallBlend = (index === 8) ? 1.0 : 0.0;
            
            (this.particleSystem.material as THREE.ShaderMaterial).uniforms.uTransitionProgress.value = 0;
            this.transitioning = true;
        }
    }

    setTargetRotationSpeed(speed: number) {
        this.targetRotationSpeed = speed;
    }

    setTargetSize(size: number) {
        this.targetSize = size;
    }

    setTargetWaveSpeed(speed: number) {
        this.targetWaveSpeed = speed;
    }

    setBreathingMode(active: boolean) {
        if (this.isBreathingMode === active) return;
        this.isBreathingMode = active;
        if (active) {
            this.savedShapeIndex = this.currentShapeIndex;
            this.savedCoolTones = this.targetCoolTones;
            
            // Randomly select one of the first 8 modes (exclude mode 9 which is index 8)
            const randomShape = Math.floor(Math.random() * 8);
            this.setShape(randomShape, true, true); // instant = true
            
            this.targetCoolTones = 1.0; // Force cool tones for calming effect
            this.breathStartTime = this.clock.getElapsedTime();
            this.currentBreathPattern = Math.random() > 0.5 ? 0 : 1;
        } else {
            this.setShape(this.savedShapeIndex, true, true); // instant = true
            this.targetCoolTones = this.savedCoolTones;
        }
    }

    setTargetColorShift(shift: number) {
        this.targetColorShift = shift;
    }

    setSize(size: number) {
        this.targetSize = size;
        if (this.particleSystem) {
            (this.particleSystem.material as THREE.ShaderMaterial).uniforms.uSize.value = size;
        }
    }

    setBloom(intensity: number) {
        this.targetBloom = intensity;
    }

    setAudioAnalyser(analyser: AnalyserNode | null) {
        this.audioAnalyser = analyser;
        if (analyser) {
            analyser.fftSize = 256;
            this.dataArray = new Uint8Array(analyser.frequencyBinCount);
        } else {
            this.dataArray = null;
        }
    }
    
    setIsMusicPlaying(playing: boolean) {
        this.isMusicPlaying = playing;
    }

    setGlobalHue(hue: number) {
        this.targetGlobalHue = hue;
    }

    setCoolTones(active: boolean) {
        this.targetCoolTones = active ? 1.0 : 0.0;
    }

    setAllowedShapes(shapes: number[]) {
        this.allowedShapes = shapes;
    }

    setMorphCallback(callback: (stage: number) => void) {
        this.onMorphCallback = callback;
        callback(this.currentMorphStage);
    }

    setShapeChangeCallback(callback: (index: number) => void) {
        this.onShapeChangeCallback = callback;
    }

    setRotationSpeed(speed: number) {
        this.targetRotationSpeed = speed;
    }

    setSymmetryFolds(folds: number) {
        if (this.particleSystem) {
            (this.particleSystem.material as THREE.ShaderMaterial).uniforms.uSymmetryFolds.value = folds;
        }
    }

    setWaveSpeed(speed: number) {
        this.targetWaveSpeed = speed;
    }

    setColorShift(shift: number) {
        this.targetColorShift = shift;
        if (this.particleSystem) {
            (this.particleSystem.material as THREE.ShaderMaterial).uniforms.uColorShift.value = shift;
        }
    }

    setMorphInterval(interval: number) {
        this.morphInterval = interval;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        this.animationId = requestAnimationFrame(this.animate);
        
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        
        // Rotate main particle system
        if (this.particleSystem) {
            this.rotationSpeed += (this.targetRotationSpeed - this.rotationSpeed) * 0.1;
            // Add a punchy bass kick to rotation for rhythm synchronization
            this.particleSystem.rotation.z += this.rotationSpeed + (this.smoothedBass * 0.025);
            this.particleSystem.rotation.y = Math.sin(time * 0.1) * 0.15 + (this.smoothedMid * 0.05);
            this.particleSystem.rotation.x = Math.cos(time * 0.15) * 0.1 + (this.smoothedBass * 0.05);
            
            const material = this.particleSystem.material as THREE.ShaderMaterial;
            material.uniforms.uTime.value = time;
            
            // Update internal linear time
            this.internalMorphTime += delta * (1.0 / this.morphInterval);
            
            // Calculate ease-in-out for the fractional part to smooth transitions
            const stage = Math.floor(this.internalMorphTime);
            const progress = this.internalMorphTime - stage;
            
            // Update UI morph stage slightly early (at 50% transition) so text isn't lagging behind graphics
            const visualStage = Math.floor(this.internalMorphTime + 0.5);
            const currentStage = visualStage % 4;
            
            if (currentStage !== this.currentMorphStage) {
                this.currentMorphStage = currentStage;
                if (this.onMorphCallback) this.onMorphCallback(currentStage);
            }
            
            // Cubic ease-in-out function for fluid morphing
            const easedProgress = progress < 0.5 
                ? 4 * progress * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                
            material.uniforms.uMorphTime.value = stage + easedProgress;
            
            if (this.isBreathingMode) {
                const activeTime = time - this.breathStartTime;
                const introDuration = 3.0; // 3 seconds intro text
                
                let bValue = 0;
                
                if (activeTime < introDuration) {
                    this.breathText = "开始呼吸模式";
                    bValue = 0.0;
                    this.breathPhase = 0;
                } else {
                    const t_time = activeTime - introDuration;
                    if (this.currentBreathPattern === 0) {
                        // Pattern 0: Relaxing 4-7-8 Breathing (4s In, 7s Hold, 8s Out)
                        const cycleDuration = 19.0;
                        const t = t_time % cycleDuration;
                        this.breathPhase = t / cycleDuration;
                        
                        if (t < 4.0) {
                            const p = t / 4.0;
                            bValue = p * p * (3 - 2 * p);
                            const secondsLeft = Math.ceil(4.0 - t);
                            this.breathText = `吸气 ${secondsLeft}s`;
                        } else if (t < 11.0) {
                            bValue = 1.0;
                            const secondsLeft = Math.ceil(11.0 - t);
                            this.breathText = `保持 ${secondsLeft}s`;
                        } else {
                            const p = (t - 11.0) / 8.0;
                            bValue = 1.0 - (p * p * (3 - 2 * p));
                            const secondsLeft = Math.ceil(19.0 - t);
                            this.breathText = `呼气 ${secondsLeft}s`;
                        }
                    } else {
                        // Pattern 1: Balanced Box Breathing (4-4-4-4)
                        const cycleDuration = 16.0;
                        const t = t_time % cycleDuration;
                        this.breathPhase = t / cycleDuration;
                        
                        if (t < 4.0) {
                            const p = t / 4.0;
                            bValue = p * p * (3 - 2 * p);
                            const secondsLeft = Math.ceil(4.0 - t);
                            this.breathText = `吸气 ${secondsLeft}s`;
                        } else if (t < 8.0) {
                            bValue = 1.0;
                            const secondsLeft = Math.ceil(8.0 - t);
                            this.breathText = `保持 ${secondsLeft}s`;
                        } else if (t < 12.0) {
                            const p = (t - 8.0) / 4.0;
                            bValue = 1.0 - (p * p * (3 - 2 * p));
                            const secondsLeft = Math.ceil(12.0 - t);
                            this.breathText = `呼气 ${secondsLeft}s`;
                        } else {
                            bValue = 0.0;
                            const secondsLeft = Math.ceil(16.0 - t);
                            this.breathText = `保持 ${secondsLeft}s`;
                        }
                    }
                }
                
                this.breathValue = bValue;
                
                // Override smoothing targets directly
                this.smoothedBass = bValue * 0.8;
                this.smoothedMid = bValue * 0.3;
                this.smoothedTreble = 0.0;
                this.smoothedAudioPulse = bValue * 0.6;
                
                // Force cool tones to transition smoothly
                this.currentCoolTones += (this.targetCoolTones - this.currentCoolTones) * 0.02;
                
                this.audioColorTime += delta * 0.2; // Slow color shift
            } else {
                let rawAudioPulse = 0;
                let rawBass = 0;
                let rawMid = 0;
                let rawTreble = 0;
                
                if (this.audioAnalyser && this.dataArray) {
                    this.audioAnalyser.getByteFrequencyData(this.dataArray);
                    
                    // Calculate frequency bands
                    let sumBass = 0, sumMid = 0, sumTreble = 0;
                    for(let i=0; i<10; i++) sumBass += this.dataArray[i];
                    for(let i=10; i<40; i++) sumMid += this.dataArray[i];
                    for(let i=40; i<100; i++) sumTreble += this.dataArray[i];
                    
                    rawBass = (sumBass / 10) / 255.0;
                    rawMid = (sumMid / 30) / 255.0;
                    rawTreble = (sumTreble / 60) / 255.0;
                    
                    // Exaggerate the peaks for a much tighter, punchier rhythm sync (Isolate the kicks)
                    rawBass = Math.pow(rawBass, 3.0);
                    rawMid = Math.pow(rawMid, 2.0);
                    rawTreble = Math.pow(rawTreble, 1.8);
                    
                    rawAudioPulse = (rawBass * 0.5 + rawMid * 0.3 + rawTreble * 0.2);
                    
                    // Advanced Beat Detection (Energy Variance)
                    const historySize = 40;
                    if (this.energyHistory.length < historySize) {
                        this.energyHistory.push(rawBass);
                    } else {
                        this.energyHistory[this.energyHistoryIndex] = rawBass;
                        this.energyHistoryIndex = (this.energyHistoryIndex + 1) % historySize;
                    }
                    
                    let localAverageEnergy = 0;
                    for(let i=0; i<this.energyHistory.length; i++) {
                        localAverageEnergy += this.energyHistory[i];
                    }
                    localAverageEnergy /= this.energyHistory.length;
                    
                    // --- State Transition Buffer (Dynamic Mode Switching) ---
                    // Calculate energy stability (variance) to prevent abrupt/frequent mode changes
                    let energyVariance = 0;
                    for(let i=0; i<this.energyHistory.length; i++) {
                        energyVariance += Math.pow(this.energyHistory[i] - localAverageEnergy, 2);
                    }
                    energyVariance /= this.energyHistory.length;
                    
                    // Automatically adjust cooldown based on rhythm stability
                    // Stable (low variance): ~8 seconds cooldown
                    // Chaotic (high variance): ~15-20+ seconds cooldown
                    this.beatCooldown = 8.0 + (energyVariance * 100.0);
                    
                    // Beat detection for automatic shape switching
                    if (this.autoMorphEnabled && time - this.lastBeatTime > this.beatCooldown) {
                        // Dynamic threshold ensures we only react to drops proportional to current chaos level
                        const dynamicThreshold = 1.35 + (energyVariance * 5.0); 
                        
                        if (rawBass > 0.6 && rawBass > localAverageEnergy * dynamicThreshold) {
                            const currentIndexInAllowed = this.allowedShapes.indexOf(this.currentShapeIndex);
                            const nextIndex = currentIndexInAllowed === -1 ? 0 : (currentIndexInAllowed + 1) % this.allowedShapes.length;
                            const nextShape = this.allowedShapes[nextIndex];
                            
                            // Check if lyric sync mode is active, if so don't auto-switch, let lyrics control it.
                            // But ParticleEngine doesn't know about lyrics. 
                            // We will simply let it switch since the prompt asks to optimize the mode switching of playing music based on frequency changes!
                            this.setShape(nextShape);
                            this.lastBeatTime = time;
                        }
                    }
                }
                
                // Asymmetric smoothing: INSTANT attack (perfect beat sync), FASTER decay (snaps back to the beat)
                this.smoothedAudioPulse += (rawAudioPulse - this.smoothedAudioPulse) * (rawAudioPulse > this.smoothedAudioPulse ? 0.95 : 0.15);
                this.smoothedBass += (rawBass - this.smoothedBass) * (rawBass > this.smoothedBass ? 0.95 : 0.18); 
                this.smoothedMid += (rawMid - this.smoothedMid) * (rawMid > this.smoothedMid ? 0.85 : 0.12); 
                this.smoothedTreble += (rawTreble - this.smoothedTreble) * (rawTreble > this.smoothedTreble ? 0.9 : 0.15); 
                
                // Speed up morphing based on overall energy (softened)
                this.internalMorphTime += delta * (1.0 / this.morphInterval) * (1.0 + this.smoothedBass * 0.05);
                
                // Accumulate color time based on audio energy for smooth, jitter-free color flow
                this.audioColorTime += delta * (0.05 + this.smoothedMid * 0.8 + this.smoothedTreble * 0.5);
            }
            
            // Smoothly interpolate uniforms towards targets (60fps lerp)
            const targetCurrentSize = this.isBreathingMode 
                ? this.targetSize * (1.0 + this.breathValue * 0.8) // Expand by 80% during inhale
                : this.targetSize * (1.0 + this.smoothedBass * 0.6); // Increased bass impact
                
            material.uniforms.uSize.value += (targetCurrentSize - material.uniforms.uSize.value) * 0.15;
            material.uniforms.uAudioPulse.value = this.smoothedAudioPulse;
            material.uniforms.uAudioColorTime.value = this.audioColorTime;
            material.uniforms.uAudioBass.value = this.smoothedBass;
            material.uniforms.uAudioMid.value = this.smoothedMid;
            material.uniforms.uAudioTreble.value = this.smoothedTreble;
            
            // Gentle modulation of wave speed and color shift based on smoothed audio pulse
            const currentWaveSpeed = this.targetWaveSpeed * (1.0 + this.smoothedMid * 0.05);
            material.uniforms.uWaveSpeed.value += (currentWaveSpeed - material.uniforms.uWaveSpeed.value) * 0.05;
            
            const currentColorShift = this.targetColorShift + this.smoothedTreble * 0.02;
            material.uniforms.uColorShift.value += (currentColorShift - material.uniforms.uColorShift.value) * 0.05;
            
            this.currentGlobalHue += (this.targetGlobalHue - this.currentGlobalHue) * 0.002;
            material.uniforms.uGlobalHue.value = this.currentGlobalHue;
            
            this.currentCoolTones += (this.targetCoolTones - this.currentCoolTones) * 0.005;
            material.uniforms.uCoolTones.value = this.currentCoolTones;
            
            // Smoother blend specifically for the waterfall (mode 9)
            this.currentWaterfallBlend += (this.targetWaterfallBlend - this.currentWaterfallBlend) * 0.015;
            material.uniforms.uWaterfallBlend.value = this.currentWaterfallBlend;
            
            this.currentMusicBlend += ((this.isMusicPlaying ? 1.0 : 0.0) - this.currentMusicBlend) * 0.05;
            material.uniforms.uMusicBlend.value = this.currentMusicBlend;
            
            if (this.bloomPass) {
                // Make the bloom flash intensely with the bass for a strong visual beat
                const targetBloomWithAudio = this.targetBloom * (1.0 + this.smoothedBass * 3.5); // Make bloom pop more
                this.bloomPass.strength += (targetBloomWithAudio - this.bloomPass.strength) * 0.25; // Faster bloom pop
            }
            
            if (this.transitioning) {
                // Smooth transition (takes exactly 6 seconds total to reach 3.0)
                (this.particleSystem.material as THREE.ShaderMaterial).uniforms.uTransitionProgress.value += delta * 0.5;
                if ((this.particleSystem.material as THREE.ShaderMaterial).uniforms.uTransitionProgress.value >= 3.0) { // duration (2.0) + max delay (~0.8)
                    (this.particleSystem.material as THREE.ShaderMaterial).uniforms.uTransitionProgress.value = 3.0;
                    this.transitioning = false;
                }
            }
        }
        
        // Rotate background stars slowly
        if (this.stars) {
            this.stars.rotation.y += 0.0005;
            this.stars.rotation.x += 0.0002;
        }
        
        // Update shooting stars
        this.shootingStars.forEach(star => {
            if (!star.active) {
                star.timer -= 1;
                if (star.timer <= 0) star.active = true;
                star.mesh.visible = false;
                return;
            }
            star.mesh.visible = true;
            star.x += star.vx;
            star.y += star.vy;
            
            if (star.y < -100 || star.x < -100) {
                star.reset(star);
            }
            
            const positions = star.mesh.geometry.attributes.position.array;
            positions[0] = star.x;
            positions[1] = star.y;
            positions[2] = star.z;
            positions[3] = star.x - star.vx * star.length;
            positions[4] = star.y - star.vy * star.length;
            positions[5] = star.z - star.vz * star.length;
            star.mesh.geometry.attributes.position.needsUpdate = true;
        });
        
        this.composer.render();
    }

    dispose() {
        window.removeEventListener('resize', this.onWindowResize);
        cancelAnimationFrame(this.animationId);
        this.renderer.dispose();
        this.composer.dispose();
        this.scene.clear();
    }
}

const shapesList = [
  { name: '模式1', icon: Snowflake },
  { name: '模式2', icon: Feather },
  { name: '模式3', icon: Waves },
  { name: '模式4', icon: Star },
  { name: '模式5', icon: Target },
  { name: '模式6', icon: Flower2 },
  { name: '模式7', icon: Shell },
  { name: '模式8', icon: Network },
  { name: '模式9', icon: Droplets },
];

const MORPH_POEMS = [
  // Mode 0: 冰晶雪花
  [
    "芥子凝霜，微尘敛影",
    "冰穹流转，倒映星河",
    "寒渊倒卷，旋入太虚",
    "圣莲绽放，充盈无极"
  ],
  // Mode 1: 羽翼
  [
    "毫末流光，隐于无形",
    "圣翼舒展，庇护星辰",
    "扶摇旋舞，拥抱浩瀚",
    "神冠加冕，笼盖八荒"
  ],
  // Mode 2: 涟漪
  [
    "一滴微澜，深藏万象",
    "幻幕升腾，倒悬天际",
    "暗流盘旋，归于深邃",
    "净水花开，漫溢洪荒"
  ],
  // Mode 3: 星之花
  [
    "星尘沉睡，凝为花种",
    "八瓣初舒，层层交绽",
    "星芒化蕊，照彻绝境",
    "几何繁花，辉映星河"
  ],
  // Mode 4: 岁月年轮
  [
    "灵根内蕴，铭刻光阴",
    "圈层重叠，如木生纹",
    "生长的回声，盘旋无尽",
    "岁月涟漪，年轮成形"
  ],
  // Mode 5: 曼陀罗花
  [
    "法相初现，瓣如梵音",
    "千层交叠，结缔莲台",
    "轮转无休，衍化虚空",
    "曼陀罗华，妙观自在"
  ],
  // Mode 6: 鹦鹉螺
  [
    "深海沉潜，岁月留痕",
    "螺旋交织，珠光内蕴",
    "千层隔舱，藏纳浩瀚",
    "造化神工，鹦鹉螺纹"
  ],
  // Mode 7: 深渊 -> 蛛网
  [
    "丝缕蔓延，交织如网",
    "露珠倒悬，映射危光",
    "困顿其中，挣扎欲出",
    "晨风破阵，千层解缚"
  ],
  // Mode 8: 粒子瀑布
  [
    "九天降水，倾泻而下",
    "飞流直落，碎玉飞溅",
    "激流勇进，汇聚成渊",
    "水波不兴，万物归一"
  ]
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentShape, setCurrentShape] = useState(0);
  const [particleSize, setParticleSize] = useState(1.0);
  const [bloomIntensity, setBloomIntensity] = useState(1.0);
  const [rotationSpeed, setRotationSpeed] = useState(0.002);
  const [trailIntensity, setTrailIntensity] = useState(0.85);
  const [symmetryFolds, setSymmetryFolds] = useState(12);
  const [waveSpeed, setWaveSpeed] = useState(0.4);
  const [colorShift, setColorShift] = useState(0.4);
  const [morphInterval, setMorphInterval] = useState(12.5);
  const [morphStage, setMorphStage] = useState(0);
  const [showPoems, setShowPoems] = useState(true);

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [showPriorityMsg, setShowPriorityMsg] = useState(false);
  const [isBreathing, setIsBreathing] = useState(false);
  const [circleUnlocked, setCircleUnlocked] = useState(false);
  const isCircleUnlockedRef = useRef(false);
  const circleGestureHoldFrames = useRef(0);
  const [breathText, setBreathText] = useState("吸气");
  const isBreathingRef = useRef(false);
  const chestHoverFrames = useRef(0);
  const chestLeaveFrames = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>();
  const lastVideoTimeRef = useRef(-1);
  const frameCountRef = useRef(0);
  const lastGestureShapeRef = useRef(0);
  const isFistRef = useRef(false);
  const lastFistTimeRef = useRef(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElemRef = useRef<HTMLAudioElement | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [hasMusic, setHasMusic] = useState(false);
  const [currentLyric, setCurrentLyric] = useState("");
  const isLyricSyncRef = useRef(false);

  // Pre-mapped lyrics timeline for test song (spaced out for less frequent switching)
  const SONG_LYRICS = [
      { time: 0, text: "🎵 音乐缓缓流淌...", shape: 0 },
      { time: 27, text: "水波飞溅，泛起银色的涟漪...", shape: 2 },
      { time: 54, text: "星芒划破了幽蓝的夜空...", shape: 3 },
      { time: 80, text: "生命在幽绿中盛开花朵...", shape: 5 },
      { time: 104, text: "短暂的流星雨，倾泻而下！", shape: 8 }, 
      { time: 112, text: "风停雪歇，重归平静...", shape: 0 }, 
      { time: 138, text: "泛起回忆的微波...", shape: 2 },
      { time: 165, text: "点亮前行的星芒...", shape: 3 },
      { time: 192, text: "繁花如梦中绽放...", shape: 5 },
      { time: 219, text: "如同灯塔指引方向...", shape: 3 }
  ];

  useEffect(() => {
    if (!isBreathing) return;
    let animationFrameId: number;
    
    const updateUI = () => {
        if (engineRef.current) {
            setBreathText(engineRef.current.breathText);
        }
        animationFrameId = requestAnimationFrame(updateUI);
    };
    
    updateUI();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isBreathing]);

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (!audioElemRef.current) {
      audioElemRef.current = new Audio();
      // Do not set crossOrigin for blob URLs, it can cause issues
      const source = audioCtxRef.current.createMediaElementSource(audioElemRef.current);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioCtxRef.current.destination);
      
      if (engineRef.current) {
        engineRef.current.setAudioAnalyser(analyser);
      }
    } else {
      audioElemRef.current.pause();
      if (audioElemRef.current.src && audioElemRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioElemRef.current.src);
      }
    }

    const url = URL.createObjectURL(file);
    audioElemRef.current.src = url;
    audioElemRef.current.load();
    setHasMusic(true);
    
    // Change global hue based on the new song
    if (engineRef.current) {
      if (file.name === '1.mp3') {
        engineRef.current.setAllowedShapes([0, 2, 3, 5, 8]); // 模式1, 3, 4, 6, 9 (0-indexed)
        engineRef.current.setCoolTones(true);
        engineRef.current.setShape(0, true, true); // Start at mode 1
        engineRef.current.autoMorphEnabled = false; // Let lyrics control specific mode timings
        setCurrentShape(0);
        isLyricSyncRef.current = true;
      } else {
        engineRef.current.setAllowedShapes([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        engineRef.current.setCoolTones(false);
        engineRef.current.setGlobalHue(Math.random() * Math.PI * 2);
        engineRef.current.autoMorphEnabled = true; // Use dynamic frequency-based transition buffer
        isLyricSyncRef.current = false;
        setCurrentLyric("");
      }
    }
    
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }

    try {
      await audioElemRef.current.play();
      setIsMusicPlaying(true);
    } catch (err: any) {
      console.error("Audio play failed:", err?.message || err);
      setIsMusicPlaying(false);
    }
    
    audioElemRef.current.onended = () => {
      setIsMusicPlaying(false);
    };

    audioElemRef.current.ontimeupdate = () => {
      if (!isLyricSyncRef.current || !audioElemRef.current) return;
      
      const currentTime = audioElemRef.current.currentTime;
      let activeLyric = "";
      let targetShape = -1;
      
      // Find the current lyric based on timestamp
      for (let i = 0; i < SONG_LYRICS.length; i++) {
         if (currentTime >= SONG_LYRICS[i].time) {
             activeLyric = SONG_LYRICS[i].text;
             targetShape = SONG_LYRICS[i].shape;
         } else {
             // Since it's sorted, we can break early
             break;
         }
      }
      
      if (activeLyric) {
          setCurrentLyric(activeLyric);
      }
      
      if (targetShape !== -1 && engineRef.current && engineRef.current.currentShapeIndex !== targetShape) {
          engineRef.current.setShape(targetShape);
          setCurrentShape(targetShape);
      }
    };

    // Clear the input so the same file can be selected again
    e.target.value = '';
  };

  const toggleMusic = async () => {
    if (audioElemRef.current && audioElemRef.current.src && audioElemRef.current.src !== window.location.href) {
      if (isMusicPlaying) {
        audioElemRef.current.pause();
        setIsMusicPlaying(false);
      } else {
        if (audioCtxRef.current?.state === 'suspended') {
          await audioCtxRef.current.resume();
        }
        try {
          await audioElemRef.current.play();
          setIsMusicPlaying(true);
        } catch (err) {
          console.error("Audio play failed:", err);
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };
  
  const gestureStateRef = useRef({
    rotationSpeed: rotationSpeed,
    waveSpeed: waveSpeed
  });

  // Sync initial values when camera is enabled
  useEffect(() => {
    if (cameraEnabled) {
      gestureStateRef.current = {
        rotationSpeed,
        waveSpeed
      };
      
      setShowPriorityMsg(true);
      const timer = setTimeout(() => setShowPriorityMsg(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowPriorityMsg(false);
      setCircleUnlocked(false);
      isCircleUnlockedRef.current = false;
      circleGestureHoldFrames.current = 0;
    }
  }, [cameraEnabled]);

  useEffect(() => {
    let active = true;

    const initHandTracking = async () => {
      if (!cameraEnabled) {
        if (handLandmarkerRef.current) {
          handLandmarkerRef.current.close();
          handLandmarkerRef.current = null;
        }
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
        return;
      }

      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        if (!active) return;
        
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 4 // Allow detecting multiple hands
        });
        if (!active) return;
        handLandmarkerRef.current = handLandmarker;

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", predictWebcam);
        }
      } catch (err) {
        console.error("Error initializing hand tracking:", err);
        setCameraEnabled(false);
      }
    };

    const predictWebcam = () => {
      if (!videoRef.current || !handLandmarkerRef.current || !active) return;
      
      let startTimeMs = performance.now();
      if (lastVideoTimeRef.current !== videoRef.current.currentTime) {
        lastVideoTimeRef.current = videoRef.current.currentTime;
        const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
        
        if (results.landmarks && results.landmarks.length > 0) {
          
          // --- Circle Gesture Detection (Unlock Breathing Mode) ---
          if (!isCircleUnlockedRef.current && results.landmarks.length >= 2) {
             const hand1 = results.landmarks[0];
             const hand2 = results.landmarks[1];
             
             // Check distance between thumbs (4) and index fingers (8)
             const thumbsDist = Math.sqrt(Math.pow(hand1[4].x - hand2[4].x, 2) + Math.pow(hand1[4].y - hand2[4].y, 2));
             const indexDist = Math.sqrt(Math.pow(hand1[8].x - hand2[8].x, 2) + Math.pow(hand1[8].y - hand2[8].y, 2));
             
             // Also check the cross case just in case
             const crossDist1 = Math.sqrt(Math.pow(hand1[4].x - hand2[8].x, 2) + Math.pow(hand1[4].y - hand2[8].y, 2));
             const crossDist2 = Math.sqrt(Math.pow(hand1[8].x - hand2[4].x, 2) + Math.pow(hand1[8].y - hand2[4].y, 2));
             
             const threshold = 0.15; // Normalized screen distance
             
             if ((thumbsDist < threshold && indexDist < threshold) || (crossDist1 < threshold && crossDist2 < threshold)) {
                 circleGestureHoldFrames.current += 1;
                 if (circleGestureHoldFrames.current > 15) {
                     isCircleUnlockedRef.current = true;
                     setCircleUnlocked(true);
                 }
             } else {
                 circleGestureHoldFrames.current = 0;
             }
          }

          // Find the closest hand (the one appearing largest on screen)
          let closestHandIdx = 0;
          let maxHandSize = 0;
          
          for (let i = 0; i < results.landmarks.length; i++) {
            const hand = results.landmarks[i];
            // Use 2D distance between wrist (0) and middle finger MCP (9) to estimate hand size
            const dist = Math.sqrt(Math.pow(hand[0].x - hand[9].x, 2) + Math.pow(hand[0].y - hand[9].y, 2));
            if (dist > maxHandSize) {
              maxHandSize = dist;
              closestHandIdx = i;
            }
          }
          
          const landmarks = results.landmarks[closestHandIdx];
          
          // Map Hand X (0 to 1) to rotationSpeed (-0.01 to 0.01) for elegant slow rotation
          const x = 1.0 - landmarks[9].x; // Palm center X (mirrored)
          const y = landmarks[9].y; // Palm center Y
          
          const targetRotationSpeed = (x - 0.5) * 0.02;
          
          // Map Hand Y (0 to 1) to waveSpeed (0.1 to 1.5) for graceful slow waves
          const targetWaveSpeed = 0.1 + (1.0 - y) * 1.4;
          
          // Calculate Pinch Distance to determine hand open/close state
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];
          const pinchDist = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) + 
            Math.pow(thumbTip.y - indexTip.y, 2)
          );
          
          // Calculate 3D distance between two landmarks
          const getDist3D = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
          
          // A finger is considered "up" if the distance from wrist (0) to tip (8, 12, 16, 20) 
          // is significantly greater than the distance from wrist to MCP knuckle (5, 9, 13, 17).
          const isIndexUp = getDist3D(landmarks[8], landmarks[0]) > getDist3D(landmarks[5], landmarks[0]) * 1.2;
          const isMiddleUp = getDist3D(landmarks[12], landmarks[0]) > getDist3D(landmarks[9], landmarks[0]) * 1.2;
          const isRingUp = getDist3D(landmarks[16], landmarks[0]) > getDist3D(landmarks[13], landmarks[0]) * 1.2;
          const isPinkyUp = getDist3D(landmarks[20], landmarks[0]) > getDist3D(landmarks[17], landmarks[0]) * 1.2;
          
          const fingerCount = (isIndexUp ? 1 : 0) + (isMiddleUp ? 1 : 0) + (isRingUp ? 1 : 0) + (isPinkyUp ? 1 : 0);
          
          const isFist = fingerCount === 0;
          const currentTime = performance.now();
          
          // --- Breathing Mode Detection ---
          const wrist = landmarks[0];
          // Chest area heuristic: lower half of the screen, very wide horizontal allowance
          const isChestArea = wrist.y > 0.35 && wrist.x > 0.1 && wrist.x < 0.9;
          
          if (isCircleUnlockedRef.current && isChestArea) {
            chestHoverFrames.current += 1;
            chestLeaveFrames.current = 0; // Reset leave counter
            if (chestHoverFrames.current > 20 && !isBreathingRef.current) {
                isBreathingRef.current = true;
                setIsBreathing(true);
                if (engineRef.current) engineRef.current.setBreathingMode(true);
            }
          } else {
            chestLeaveFrames.current += 1;
            if (chestLeaveFrames.current > 30) { // Grace period of ~0.5s
                chestHoverFrames.current = 0;
                if (isBreathingRef.current) {
                    isBreathingRef.current = false;
                    setIsBreathing(false);
                    if (engineRef.current) engineRef.current.setBreathingMode(false);
                    isCircleUnlockedRef.current = false;
                    setCircleUnlocked(false);
                }
            }
          }
          
          if (isBreathingRef.current) {
            // During breathing mode, ignore all other gestures and return speeds to default
            gestureStateRef.current.rotationSpeed += (0.0015 - gestureStateRef.current.rotationSpeed) * 0.05;
            gestureStateRef.current.waveSpeed += (0.4 - gestureStateRef.current.waveSpeed) * 0.05;
          } else {
            if (isFist && !isFistRef.current && currentTime - lastFistTimeRef.current > 1000) {
              // Hand just turned into a fist, switch to next shape
              const nextShape = (lastGestureShapeRef.current + 1) % 9;
              lastGestureShapeRef.current = nextShape;
              setCurrentShape(nextShape);
              lastFistTimeRef.current = currentTime;
            }
            
            // Smooth the raw hand tracking data slightly to remove jitter before sending to engine
            gestureStateRef.current.rotationSpeed += (targetRotationSpeed - gestureStateRef.current.rotationSpeed) * 0.15;
            gestureStateRef.current.waveSpeed += (targetWaveSpeed - gestureStateRef.current.waveSpeed) * 0.15;
          }
          
          isFistRef.current = isFist;

          // Send smoothed targets directly to engine. The engine's 60fps animate loop will handle the final smooth lerping.
          if (engineRef.current) {
            engineRef.current.setTargetRotationSpeed(gestureStateRef.current.rotationSpeed);
            engineRef.current.setTargetWaveSpeed(gestureStateRef.current.waveSpeed);
          }

          // Throttle React state updates (for UI sliders) to ~6fps
          frameCountRef.current++;
          if (frameCountRef.current % 10 === 0) {
            setRotationSpeed(gestureStateRef.current.rotationSpeed);
            setWaveSpeed(gestureStateRef.current.waveSpeed);
          }
        }
      } else {
        // No hands detected
        chestLeaveFrames.current += 1;
        if (chestLeaveFrames.current > 30) {
            chestHoverFrames.current = 0;
            if (isBreathingRef.current) {
                isBreathingRef.current = false;
                setIsBreathing(false);
                if (engineRef.current) engineRef.current.setBreathingMode(false);
                isCircleUnlockedRef.current = false;
                setCircleUnlocked(false);
            }
        }
      }
      
      requestRef.current = requestAnimationFrame(predictWebcam);
    };

    initHandTracking();

    return () => {
      active = false;
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [cameraEnabled]);

  useEffect(() => {
    if (canvasRef.current) {
        const engine = new ParticleEngine(canvasRef.current);
        engineRef.current = engine;
        
        engine.setMorphCallback((stage) => {
            setMorphStage(stage);
        });

        engine.setShapeChangeCallback((index) => {
            setCurrentShape(index);
        });
        
        return () => {
            engine.dispose();
        };
    }
  }, []);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.setShape(currentShape);
    }
  }, [currentShape]);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.setSize(particleSize);
    }
  }, [particleSize]);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.setBloom(bloomIntensity);
    }
  }, [bloomIntensity]);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.setRotationSpeed(rotationSpeed);
    }
  }, [rotationSpeed]);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.setTrailIntensity(trailIntensity);
    }
  }, [trailIntensity]);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.setSymmetryFolds(symmetryFolds);
    }
  }, [symmetryFolds]);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.setWaveSpeed(waveSpeed);
    }
  }, [waveSpeed]);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.setColorShift(colorShift);
    }
  }, [colorShift]);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.setMorphInterval(morphInterval);
    }
  }, [morphInterval]);

  useEffect(() => {
    if (engineRef.current) {
        engineRef.current.setIsMusicPlaying(isMusicPlaying);
    }
  }, [isMusicPlaying]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-mono">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* Morph Stage Text Guidance (Poem on the left) */}
      <div className={`absolute left-8 md:left-16 top-1/2 -translate-y-1/2 pointer-events-none z-30 flex flex-col gap-8 transition-all duration-700 ease-in-out ${showPoems ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
        {MORPH_POEMS[currentShape].map((line, idx) => {
          const isActive = idx === morphStage;
          return (
            <motion.p
              key={`${currentShape}-${idx}`}
              initial={{ opacity: 0, x: -20, color: '#cffafe' }}
              animate={{ 
                opacity: isActive ? 1 : 0.3, 
                x: isActive ? 10 : 0,
                scale: isActive ? 1.05 : 1,
                filter: isActive ? 'blur(0px)' : 'blur(1px)',
                textShadow: isActive ? '0 0 20px rgba(255,255,255,0.9)' : '0 0 0px rgba(255,255,255,0)',
                color: isActive ? '#ffffff' : '#cffafe'
              }}
              transition={{ duration: morphInterval * 0.6, ease: "easeInOut" }}
              className={`origin-left font-light tracking-[0.25em] ${isActive ? 'text-2xl md:text-3xl font-medium' : 'text-lg md:text-xl'}`}
            >
              {line}
            </motion.p>
          );
        })}
      </div>

      {/* Toggle Button */}
      <div className="absolute top-6 right-6 z-50 flex gap-4">
        <button 
          className={`p-3 rounded-lg backdrop-blur-md transition-all duration-300 border ${showPoems ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10'}`}
          onClick={() => setShowPoems(!showPoems)}
          title={showPoems ? "隐藏文字 (Hide Text)" : "显示文字 (Show Text)"}
        >
          {showPoems ? <Eye className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
        </button>
        <input 
          type="file" 
          accept="audio/*" 
          ref={fileInputRef} 
          onChange={handleMusicUpload} 
          className="hidden" 
        />
        <button 
          className="p-3 rounded-lg backdrop-blur-md transition-all duration-300 bg-white/5 border border-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => fileInputRef.current?.click()}
          title="添加/切换音乐 (Add/Switch Music)"
        >
          <Upload className="w-6 h-6" />
        </button>
        {hasMusic && (
          <button 
            className={`p-3 rounded-lg backdrop-blur-md transition-all duration-300 border ${isMusicPlaying ? 'bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-200 shadow-[0_0_15px_rgba(217,70,239,0.3)]' : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
            onClick={toggleMusic}
            title="播放/暂停音乐 (Play/Pause Music)"
          >
            <Music className={`w-6 h-6 ${isMusicPlaying ? 'animate-pulse' : ''}`} />
          </button>
        )}
        <button 
          className={`p-3 rounded-lg backdrop-blur-md transition-all duration-300 border ${cameraEnabled ? 'bg-cyan-400/20 border-cyan-300/40 text-cyan-200 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
          onClick={() => setCameraEnabled(!cameraEnabled)}
          title="手势控制 (Gesture Control)"
        >
          {cameraEnabled ? <Camera className="w-6 h-6" /> : <CameraOff className="w-6 h-6" />}
        </button>
        <button 
          className="p-3 rounded-lg backdrop-blur-md transition-all duration-300 bg-white/5 border border-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Settings className="w-6 h-6 animate-[spin_4s_linear_infinite]" />}
        </button>
      </div>

      {/* Hidden Video Element for Hand Tracking */}
      <video 
        ref={videoRef} 
        className="hidden" 
        autoPlay 
        playsInline 
      />

      {/* Camera Status Indicator & Guidance */}
      {cameraEnabled && !isBreathing && (
        <div className="absolute top-6 left-6 z-50 flex flex-col gap-2 text-cyan-400/80 text-sm tracking-widest font-light pointer-events-none">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
            <span>手势控制已开启</span>
          </div>
          <div>移动手掌：控制星系旋转与波动</div>
          <div>握紧拳头：切换下一个视觉形态</div>
          <div className={`transition-colors duration-500 ${circleUnlocked ? 'text-green-400' : 'text-cyan-400/80'}`}>
            {circleUnlocked ? '冥想已解锁 - 手放胸口：进入深呼吸冥想模式' : '双手相接比圆：解锁冥想 ➔ 后放胸口触发'}
          </div>
          
          <div className={`text-fuchsia-400/80 text-xs mt-2 transition-opacity duration-1000 ${showPriorityMsg ? 'opacity-100' : 'opacity-0'}`}>
            *多人交互时，优先响应距离最近的用户
          </div>
        </div>
      )}

      {/* Breathing Mode Overlay */}
      {isBreathing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40 bg-black/20 transition-all duration-1000">
            <h2 className="text-5xl md:text-7xl text-white font-light tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] transition-opacity duration-500">
                {breathText}
            </h2>
            <div className="mt-8 text-2xl text-cyan-200 tracking-widest opacity-80">
                跟随星系的律动
            </div>
            {/* CSS breathing circle indicator */}
            <div className="mt-12 w-48 h-48 rounded-full border-2 border-cyan-400/30 flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-full bg-cyan-400/10 animate-[ping_8s_ease-in-out_infinite]"></div>
                <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_15px_white]"></div>
            </div>
        </div>
      )}

      {/* Control Panel */}
      <div className={`absolute top-0 right-0 h-full w-80 bg-black/30 backdrop-blur-2xl border-l border-white/10 p-6 transform transition-transform duration-500 z-40 overflow-y-auto shadow-[-20px_0_40px_rgba(0,0,0,0.5)] ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <h2 className="text-2xl font-light text-white/90 mb-8 tracking-widest mt-16 drop-shadow-lg">
          星际粒子控制台
        </h2>
        
        {/* Shape Selector */}
        <div className="space-y-4 mb-8">
          <h3 className="text-white/80 text-sm tracking-widest border-b border-white/10 pb-3">模式切换</h3>
          {shapesList.map((shape, idx) => (
            <button 
              key={idx}
              onClick={() => setCurrentShape(idx)}
              className={`w-full flex items-center space-x-3 p-3 rounded-xl border transition-all duration-300 backdrop-blur-sm ${currentShape === idx ? 'bg-cyan-500/20 border-cyan-400/30 text-cyan-200 shadow-[inset_0_0_15px_rgba(34,211,238,0.2)]' : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:border-white/10 hover:text-white/80'}`}
            >
              <shape.icon className="w-5 h-5" />
              <span>{shape.name}</span>
            </button>
          ))}
        </div>

        {/* Sliders */}
        <div className="space-y-6 bg-white/5 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
          <h3 className="text-white/80 text-sm tracking-widest border-b border-white/10 pb-3 flex items-center">
            <Settings className="w-4 h-4 mr-2" /> 参数调节
          </h3>
          
          {/* Particle Size */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/60">
              <span>粒子大小</span>
              <span className="font-mono">{particleSize.toFixed(1)}</span>
            </div>
            <input 
              type="range" min="0" max="1.0" step="0.1" 
              value={particleSize} 
              onChange={(e) => setParticleSize(parseFloat(e.target.value))} 
            />
          </div>
          
          {/* Bloom Intensity */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/60">
              <span>辉光强度</span>
              <span className="font-mono">{bloomIntensity.toFixed(1)}</span>
            </div>
            <input 
              type="range" min="0" max="1.0" step="0.1" 
              value={bloomIntensity} 
              onChange={(e) => setBloomIntensity(parseFloat(e.target.value))} 
            />
          </div>

          {/* Rotation Speed */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/60">
              <span>旋转速度</span>
              <span className="font-mono">{rotationSpeed.toFixed(3)}</span>
            </div>
            <input 
              type="range" min="-0.01" max="0.01" step="0.001" 
              value={rotationSpeed} 
              onChange={(e) => setRotationSpeed(parseFloat(e.target.value))} 
            />
          </div>

          {/* Trail Intensity */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/60">
              <span>拖尾长度</span>
              <span className="font-mono">{trailIntensity.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0" max="0.99" step="0.01" 
              value={trailIntensity} 
              onChange={(e) => setTrailIntensity(parseFloat(e.target.value))} 
            />
          </div>

          {/* Symmetry Folds */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/60">
              <span>对称折叠</span>
              <span className="font-mono">{symmetryFolds}</span>
            </div>
            <input 
              type="range" min="1" max="24" step="1" 
              value={symmetryFolds} 
              onChange={(e) => setSymmetryFolds(parseInt(e.target.value))} 
            />
          </div>

          {/* Wave Speed */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/60">
              <span>光波流速</span>
              <span className="font-mono">{waveSpeed.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0.1" max="1.5" step="0.1" 
              value={waveSpeed} 
              onChange={(e) => setWaveSpeed(parseFloat(e.target.value))} 
            />
          </div>

          {/* Dreamy Glow / Brightness Pulse */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/60">
              <span>梦幻光晕</span>
              <span className="font-mono">{colorShift.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0" max="1.0" step="0.05" 
              value={colorShift} 
              onChange={(e) => setColorShift(parseFloat(e.target.value))} 
            />
          </div>

          {/* Morph Interval */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/60">
              <span>形态演化间隔时间</span>
              <span className="font-mono">{morphInterval.toFixed(1)}s</span>
            </div>
            <input 
              type="range" min="1.0" max="30.0" step="0.5" 
              value={morphInterval} 
              onChange={(e) => setMorphInterval(parseFloat(e.target.value))} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
