<script>
	import Subdivide from '@sveltejs/svelte-subdivide';
	import WorkSpace from '../components/WorkSpace.svelte'
	import ColorSpace from '../components/ColorSpace.svelte';
	import Spectrum from '../components/Spectrum.svelte';
	import Sandbox from '../components/SandboxShader.svelte';

	const panels = {
		colorspace: ColorSpace,
		spectrum: Spectrum,
		"glsl-sandbox": Sandbox
	}
	const defaultComponentProps = {panels, active: 'colorspace'};

	let layout = {
		root: {
			id: '0',
			type: 'group',
			row: false,
			pos: 0,
			size: 1,
			prev: null,
			next: null,
			children: [
				{
					type: 'pane',
					id: '1',
					pos: 0,
					size: 0.5,
					prev: null,
					next: null,
					childProps: {panels, active: 'colorspace'}
				},
				{
					type: 'pane',
					id: '2',
					pos: 0.5,
					size: 0.5,
					prev: null,
					next: null,
					childProps: {panels, active: 'spectrum'}
				}
			]
		}
	};

</script>

<svelte:head>
	<title>ColorLab ALPHA</title>
</svelte:head>

<Subdivide component={WorkSpace} 
	componentProps={defaultComponentProps}
	thickness='3px' 
	{layout} />


<style>
</style>
