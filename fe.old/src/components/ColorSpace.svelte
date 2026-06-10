<script>
	import { onMount } from 'svelte';

    import * as THREE from 'three';
    import { OrbitControls }  from 'three/examples/jsm/controls/OrbitControls';

    import ThreeView from './ThreeView.svelte';

    import colorSpaceVertexShader from '../shaders/colorspace.vert';
    import colorSpaceFragmentShader from '../shaders/colorspace.frag';
    import floorVertexShader from '../shaders/floor.vert';
    import floorFragmentShader from '../shaders/floor.frag';
    import gridFragmentShader from '../shaders/grid.frag';

    export let radius = 200;
    export let top = 100;
    export let bottom = 0;

    let camera;
    let scene;
    let update;
    let run = true;
    let canvasId;

	onMount(() => {
        camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20);
        var controls = new OrbitControls( camera, document.getElementById(canvasId) );
        controls.screenSpacePanning = true;
        controls.target = new THREE.Vector3(0, 0.5, 0);
        //controls.

        camera.position.z = 2;
        camera.position.y = 2;

        controls.update();

        scene = new THREE.Scene();

        //const texture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/crate.gif');

        // color-space
        const geometry = new THREE.BoxBufferGeometry(1, 1, 1, 64, 64, 64);
        const material = new THREE.ShaderMaterial({
            vertexShader: colorSpaceVertexShader, 
            fragmentShader: colorSpaceFragmentShader, 
            side: THREE.DoubleSide
            });
        material.extensions.derivatives = true;
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const floorGeometry = new THREE.CircleBufferGeometry( 5, 32 );
        const floorMaterial = new THREE.ShaderMaterial({
            vertexShader: floorVertexShader, 
            fragmentShader: floorFragmentShader, 
            side: THREE.DoubleSide,
            transparent: true
            });
        floorMaterial.extensions.derivatives = true;
        const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
        floorMesh.rotation.x = -90 * Math.PI / 180;
        scene.add(floorMesh);

		update = function () {
            controls.update();
		}
	});

</script>

<style>
    button {
        position: fixed;
        top: 0;
        left: 0;
    }
</style>

<ThreeView {scene} {camera} {update} {run} bind:canvasId />
<!--<button on:click={() => run=!run}>Run</button>-->
