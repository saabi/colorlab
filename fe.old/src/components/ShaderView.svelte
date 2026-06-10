<script>
	import { onMount } from 'svelte';

    import * as THREE from 'three';
    import { OrbitControls }  from 'three/examples/jsm/controls/OrbitControls';

    import ThreeView from './ThreeView.svelte';

    let camera;
    let scene;
    let internalUpdate;
    let canvasId;

    export let shader;
    export let run;
    export let update;

    let frustumSize = 1;

onMount(() => {
        scene = new THREE.Scene();

        let canvas = document.getElementById(canvasId);

        let width = canvas.clientWidth;
        let height = canvas.clientHeight
        let aspect = width / height;
        aspect = 1;
        camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, 1, 1000 );
        //camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20);
        camera.position.z = 2;

        //var controls = new OrbitControls( camera, document.getElementById(canvasId) );
        //controls.screenSpacePanning = true;
        //controls.target = new THREE.Vector3(0, 0, 0);
        //controls.update();

        scene.add( camera );
        
        // shader surface
        const geometry = new THREE.PlaneBufferGeometry(1, 1);
        const material = new THREE.ShaderMaterial({
            vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }', 
            fragmentShader: shader,
           	uniforms: {
                time: { value: 0.0 },
                resolution: { value: new THREE.Vector2() },
                aspect: {value: width/height}
        	}
        });
        material.extensions.derivatives = true;
        const mesh = new THREE.Mesh(geometry, material);
        //mesh.rotation.x = 90 * 180/Math.PI;
        scene.add(mesh);

		internalUpdate = function (time) {
            let width = canvas.width;
            let height = canvas.height;
        
            material.uniforms.time.value = time/1000;
            material.uniforms.resolution.value = new THREE.Vector2(width,height);
            material.uniforms.aspect.value = canvas.clientWidth / canvas.clientHeight;
            update && update(material.uniforms);
		}
	});

</script>

<ThreeView {scene} {camera} update={internalUpdate} {run} bind:canvasId />
