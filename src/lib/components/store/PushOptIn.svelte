<!--
	"Get updates on this phone": follows this order or registration with Web Push, so the phone
	says when it is paid, ready or confirmed. Shown only where the browser can do it (an installed
	app on iPhone) and the server has push set up; otherwise it renders nothing.
-->
<script lang="ts">
	import Bell from '@lucide/svelte/icons/bell';
	import BellOff from '@lucide/svelte/icons/bell-off';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getLocale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';

	type Props = { kind: 'order' | 'registration' };
	let { kind }: Props = $props();

	const token = $derived(page.params.token);
	const flag = $derived(`amoria-push:${kind}:${token}`);

	let key = $state<string | null>(null);
	let following = $state(false);
	let busy = $state(false);
	let message = $state('');

	/** The browser wants the VAPID key as bytes. */
	function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
		const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
			.replace(/-/g, '+')
			.replace(/_/g, '/');
		const raw = atob(base64);
		const bytes = new Uint8Array(new ArrayBuffer(raw.length));
		for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
		return bytes;
	}

	onMount(async () => {
		if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window))
			return;
		try {
			key = (await (await fetch('/api/push')).json()).key ?? null;
			following = localStorage.getItem(flag) === '1' && Notification.permission === 'granted';
		} catch {
			key = null;
		}
	});

	async function send(method: 'POST' | 'DELETE', subscription: PushSubscription) {
		const response = await fetch('/api/push', {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(
				method === 'POST'
					? { kind, token, subscription: subscription.toJSON(), locale: getLocale() }
					: { kind, token, endpoint: subscription.endpoint }
			)
		});
		if (!response.ok) throw new Error(String(response.status));
	}

	async function follow() {
		busy = true;
		message = '';
		try {
			if ((await Notification.requestPermission()) !== 'granted') {
				message = m.push_blocked();
				return;
			}
			const registration = await navigator.serviceWorker.ready;
			const subscription =
				(await registration.pushManager.getSubscription()) ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: keyBytes(key!)
				}));
			await send('POST', subscription);
			localStorage.setItem(flag, '1');
			following = true;
		} catch {
			message = m.push_error();
		} finally {
			busy = false;
		}
	}

	async function stop() {
		busy = true;
		try {
			const subscription = await (
				await navigator.serviceWorker.ready
			).pushManager.getSubscription();
			if (subscription) await send('DELETE', subscription);
			localStorage.removeItem(flag);
			following = false;
		} catch {
			message = m.push_error();
		} finally {
			busy = false;
		}
	}
</script>

{#if key}
	<div class="mt-4 flex flex-wrap items-center gap-3">
		{#if following}
			<p class="flex items-center gap-2 text-sm text-muted-foreground">
				<Bell class="h-4 w-4 text-[var(--am-ribbon)]" aria-hidden="true" />
				{m.push_following()}
			</p>
			<button
				type="button"
				onclick={stop}
				disabled={busy}
				class="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium active:bg-secondary disabled:opacity-60"
			>
				<BellOff class="h-4 w-4" aria-hidden="true" />
				{m.push_stop()}
			</button>
		{:else}
			<button
				type="button"
				onclick={follow}
				disabled={busy}
				class="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--am-ribbon)] px-5 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-60"
			>
				<Bell class="h-4 w-4" aria-hidden="true" />
				{m.push_follow()}
			</button>
		{/if}
		{#if message}<p class="text-sm text-destructive" role="alert">{message}</p>{/if}
	</div>
{/if}
