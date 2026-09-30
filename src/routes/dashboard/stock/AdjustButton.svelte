<script lang="ts">
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	/** A table cell that asks the page to open the one shared adjust dialog for its row. */
	let { onclick }: { onclick: () => void } = $props();
</script>

<Button size="sm" variant="outline" {onclick}>Adjust</Button>
