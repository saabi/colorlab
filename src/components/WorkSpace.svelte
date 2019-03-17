<script context='module'>
	let next = 0; 
	function autoid() { return (process.browser?'wsmenu':'ssrwsmenu') + next++; }
</script>

<script>
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

    export let panels = [];
    export let active = null;
    export let childProps = {};

    let menuId = autoid();
    let groupName = autoid();

    let activePanel;
    $: if (panels && active in panels) {
        activePanel = panels[active];
    }
    else activePanel = null;

    function change(e) {
        let radio = e.target;
        active = radio.value;
        document.getElementById(menuId).checked = false;
        dispatch('propsChanged', {panels, active, childProps});
    }
</script>

<div>
    <svelte:component this={activePanel} {...childProps} />
	<input type="checkbox" href="#" class="menuopener" id={menuId}/>
    <label class="menu-open-button" for={menuId}>
        Panels
    </label>
    <ul>
        {#each Object.keys(panels) as n}
            <li>
                <input id={groupName+n} type='radio' value={n} name={groupName} on:change={change} checked={n===active}/>
                <label for={groupName+n}>{n}</label>
            </li>
        {/each}
    </ul>
</div>

<style>
div {
    width: 100%;
    height: 100%;
}
.menuopener {
    display:none;
}
.menu-open-button {
    position: absolute;
    top: 0;
    left: 0;
    background: gray;
    color: white;
}
ul {
    display: none;
    position: absolute;
    top: 20px;
    left: 0px;
    background: gray;
    color: white;
}
.menuopener:checked ~ ul {
    display: block;
}
li {
    display: block;
}
</style>