<script>
    export let panels;
    export let active;
    export let childProps = [];

    let activePanel;
    $: if (panels && active in panels) {
        activePanel = panels[active];
    }
    else activePanel = null;
</script>

<div>
    <svelte:component this={activePanel} {...childProps}/>
</div>

<style>
div {
    width: 100%;
    height: 100%;
}
</style>