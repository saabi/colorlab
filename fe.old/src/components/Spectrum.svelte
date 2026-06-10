<script>
    import ShaderView from './ShaderView.svelte';
    import shader from '../shaders/spectrum.frag';

    let run = true;

    function update(uniforms) {}
</script>

<ShaderView {shader} {run} {update} />