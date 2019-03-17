<script context='module'>
    let lastId = 0;
    function autoID() {
        return (process.browser ? 's-threeview' : 'threeview') + lastId++;
    }
</script>

<script>
    import * as THREE from 'three';

	import { onMount } from 'svelte';

    export let scene;
    export let camera;
    export let update;
    export let run;
    export let canvasId = autoID();

    let canvas;
    let renderer;

    let lastResize= Date.now();
    let lastSize = {w: 0, h: 0};
    let frame;

    export function render (time, looping) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        // adjust displayBuffer size to match
        if (width !== lastSize.w || height !== lastSize.h) {
            lastResize = Date.now();
            if (camera) {
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
            }

            // update any render target sizes here
        }
        else {
            if (!looping || (lastResize && lastResize + 100 < Date.now())) {
                renderer.setSize(width, height, false);
                lastResize = null;
            }
        }
        lastSize.w = width;
        lastSize.h = height;

        update && update(time);

        scene && camera && renderer.render(scene, camera);
    }
    function loop(time) {
        run && (  frame = requestAnimationFrame(loop)  );
        render(time, true);
    }

    function runOrNot(b) {
        if (process.browser) {
            if (b) {
                frame = requestAnimationFrame(loop)
            }
            else
                cancelAnimationFrame(frame);
        }
    }
    $: runOrNot(run);

    onMount(() => {
        let w = canvas.clientWidth;
        let h = canvas.clientHeight;

        //let context = canvas.getContext( 'webgl2' );
        renderer = new THREE.WebGLRenderer({ antialias: true, canvas/*, context */});
		renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(w, h, false);

		return () => cancelAnimationFrame(frame);
	});
</script>

<style>
    canvas {
        width: 100%;
        height: 100%;
    }
</style>

<canvas bind:this={canvas} id={canvasId}></canvas>
