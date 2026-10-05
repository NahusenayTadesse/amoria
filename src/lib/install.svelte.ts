import { browser } from '$app/environment';

/** Chromium's install prompt, which it hands over once and lets us fire when the visitor asks. */
type InstallPrompt = Event & {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Whether Amoria can be installed as an app, and how. Chromium browsers offer a prompt we hold on
 * to; Safari on iPhone and iPad has none, so the visitor is shown the Share-menu steps instead.
 * One instance serves every install button on the page.
 */
class Install {
	#prompt = $state<InstallPrompt | null>(null);
	#installed = $state(false);
	#ios = $state(false);
	#started = false;

	/** True when there is something to offer: a native prompt, or the iOS steps. */
	available = $derived(!this.#installed && (this.#prompt !== null || this.#ios));
	/** True on iOS, where the install button explains how rather than installing. */
	needsSteps = $derived(this.#prompt === null && this.#ios);

	/** Starts listening. Safe to call from every component that needs it; only the first counts. */
	start() {
		if (!browser || this.#started) return;
		this.#started = true;

		const standalone =
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		this.#installed = standalone;

		const ua = navigator.userAgent;
		const iPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
		this.#ios = (/iphone|ipad|ipod/i.test(ua) || iPad) && !/crios|fxios|edgios/i.test(ua);

		addEventListener('beforeinstallprompt', (event) => {
			event.preventDefault();
			this.#prompt = event as InstallPrompt;
		});
		addEventListener('appinstalled', () => {
			this.#installed = true;
			this.#prompt = null;
		});
	}

	/** Shows the browser's install prompt. Returns false when there is none (the iOS case). */
	async prompt(): Promise<boolean> {
		const prompt = this.#prompt;
		if (!prompt) return false;
		await prompt.prompt();
		const { outcome } = await prompt.userChoice;
		// A prompt can be used once; if it was dismissed the browser fires a new event later.
		this.#prompt = null;
		if (outcome === 'accepted') this.#installed = true;
		return true;
	}
}

export const install = new Install();
