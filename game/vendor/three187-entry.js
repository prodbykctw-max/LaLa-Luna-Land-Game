import * as T from './package/build/three.module.js';
import { GLTFLoader } from './package/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from './package/examples/jsm/utils/SkeletonUtils.js';
import * as BufferGeometryUtils from './package/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from './package/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './package/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from './package/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from './package/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './package/examples/jsm/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from './package/examples/jsm/postprocessing/Pass.js';
import { CopyShader } from './package/examples/jsm/shaders/CopyShader.js';
import { LuminosityHighPassShader } from './package/examples/jsm/shaders/LuminosityHighPassShader.js';
/* one mutable namespace, shaped like the old global build: THREE.GLTFLoader, THREE.SkeletonUtils.clone, THREE.EffectComposer ... */
window.THREE = Object.assign({}, T, { GLTFLoader, SkeletonUtils, BufferGeometryUtils, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, Pass, FullScreenQuad, CopyShader, LuminosityHighPassShader });
