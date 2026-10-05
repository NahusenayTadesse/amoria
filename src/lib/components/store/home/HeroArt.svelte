<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * The hero's picture: a balloon-arch backdrop drawn in SVG, with no image to download. It pops
	 * in balloon by balloon, a gold ribbon draws around it, and the layers drift with the pointer.
	 * All of the entrance is CSS, so it plays before (and without) any JavaScript.
	 */

	const tones = ['ribbon', 'blush', 'plum', 'gold', 'lilac', 'cream'] as const;

	/** A fixed pseudo-random number in [0, 1), so the server and the browser draw the same arch. */
	const rand = (n: number) => {
		const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
		return x - Math.floor(x);
	};

	type Balloon = { x: number; y: number; r: number; tone: (typeof tones)[number]; i: number };

	const balloons: Balloon[] = [];
	const CX = 300;
	const CY = 300;
	const R = 190;

	// Over the top of the arch, left to right.
	for (let i = 0; i <= 15; i++) {
		const a = Math.PI - (i / 15) * Math.PI;
		balloons.push({
			x: CX + R * Math.cos(a) + (rand(i) - 0.5) * 12,
			y: CY - R * Math.sin(a) + (rand(i + 40) - 0.5) * 12,
			r: 25 + rand(i + 9) * 17,
			tone: tones[(i * 5 + 1) % tones.length],
			i
		});
	}
	// Down both legs.
	for (let j = 1; j <= 4; j++) {
		for (const side of [-1, 1]) {
			balloons.push({
				x: CX + side * R + (rand(j * side + 70) - 0.5) * 12,
				y: CY + j * 62 + (rand(j + 90) - 0.5) * 10,
				r: 34 - j * 4 + rand(j + side + 20) * 6,
				tone: tones[(j * 3 + (side > 0 ? 2 : 0)) % tones.length],
				i: 16 + j * 2 + (side > 0 ? 1 : 0)
			});
		}
	}
	// A second, smaller row tucked inside the first so the garland looks full.
	for (let i = 1; i < 15; i += 2) {
		const a = Math.PI - (i / 15) * Math.PI;
		balloons.push({
			x: CX + (R - 26) * Math.cos(a),
			y: CY - (R - 26) * Math.sin(a) + 4,
			r: 14 + rand(i + 130) * 7,
			tone: tones[(i + 3) % tones.length],
			i: 30 + i
		});
	}

	const sparkles = [
		{ x: 70, y: 150, s: 1.1 },
		{ x: 545, y: 110, s: 0.8 },
		{ x: 520, y: 400, s: 1.3 },
		{ x: 52, y: 430, s: 0.7 },
		{ x: 300, y: 70, s: 0.9 }
	];

	const petals = Array.from({ length: 9 }, (_, i) => ({
		x: 30 + rand(i + 200) * 540,
		delay: -rand(i + 210) * 16,
		dur: 13 + rand(i + 220) * 9,
		size: 7 + rand(i + 230) * 7,
		tone: tones[i % 3]
	}));

	let art = $state<HTMLDivElement>();

	onMount(() => {
		if (!art) return;
		if (
			matchMedia('(prefers-reduced-motion: reduce)').matches ||
			!matchMedia('(hover: hover) and (pointer: fine)').matches
		) {
			return;
		}

		const node = art;
		let frame = 0;
		let mx = 0;
		let my = 0;
		const apply = () => {
			frame = 0;
			node.style.setProperty('--mx', mx.toFixed(3));
			node.style.setProperty('--my', my.toFixed(3));
		};
		const move = (event: PointerEvent) => {
			mx = (event.clientX / innerWidth - 0.5) * 2;
			my = (event.clientY / innerHeight - 0.5) * 2;
			if (!frame) frame = requestAnimationFrame(apply);
		};
		addEventListener('pointermove', move, { passive: true });
		return () => {
			removeEventListener('pointermove', move);
			if (frame) cancelAnimationFrame(frame);
		};
	});
</script>

<div bind:this={art} class="hero-art" aria-hidden="true">
	<svg viewBox="0 0 600 660" class="h-full w-full" focusable="false">
		<defs>
			<radialGradient id="g-ribbon" cx="34%" cy="28%" r="80%">
				<stop offset="0" stop-color="#2f8a5e" />
				<stop offset="0.55" stop-color="#14543a" />
				<stop offset="1" stop-color="#07281a" />
			</radialGradient>
			<radialGradient id="g-blush" cx="34%" cy="28%" r="80%">
				<stop offset="0" stop-color="#eef7f0" />
				<stop offset="0.55" stop-color="#bfdcc9" />
				<stop offset="1" stop-color="#dc92b4" />
			</radialGradient>
			<radialGradient id="g-plum" cx="34%" cy="28%" r="80%">
				<stop offset="0" stop-color="#3f8a63" />
				<stop offset="0.55" stop-color="#1d5b3d" />
				<stop offset="1" stop-color="#0c2a1d" />
			</radialGradient>
			<radialGradient id="g-gold" cx="34%" cy="28%" r="80%">
				<stop offset="0" stop-color="#f6dc95" />
				<stop offset="0.55" stop-color="#d4a23a" />
				<stop offset="1" stop-color="#9b6f1c" />
			</radialGradient>
			<radialGradient id="g-lilac" cx="34%" cy="28%" r="80%">
				<stop offset="0" stop-color="#e9f3ec" />
				<stop offset="0.55" stop-color="#c9dccd" />
				<stop offset="1" stop-color="#b995c8" />
			</radialGradient>
			<radialGradient id="g-cream" cx="34%" cy="28%" r="80%">
				<stop offset="0" stop-color="#ffffff" />
				<stop offset="0.55" stop-color="#fbeadb" />
				<stop offset="1" stop-color="#e8cdb4" />
			</radialGradient>
			<linearGradient id="g-arch" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#ffffff" stop-opacity="0.85" />
				<stop offset="1" stop-color="#f1e0f0" stop-opacity="0.35" />
			</linearGradient>
			<linearGradient id="g-foil" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="#e9c574" />
				<stop offset="0.5" stop-color="#b8892b" />
				<stop offset="1" stop-color="#f0d68e" />
			</linearGradient>
			<path id="spark" d="M0 -11 Q0.8 -0.8 11 0 Q0.8 0.8 0 11 Q-0.8 0.8 -11 0 Q-0.8 -0.8 0 -11Z" />
		</defs>

		<!-- The arch itself: a pane of tissue, with a gold line drawn around it. -->
		<g class="layer" style="--k: 5">
			<path d="M110 610 V300 A190 190 0 0 1 490 300 V610 Z" fill="url(#g-arch)" class="arch-pane" />
			<path
				d="M110 610 V300 A190 190 0 0 1 490 300 V610"
				fill="none"
				stroke="url(#g-foil)"
				stroke-width="2.5"
				stroke-linecap="round"
				pathLength="1"
				class="draw"
			/>
			<path
				d="M92 610 V300 A208 208 0 0 1 508 300 V610"
				fill="none"
				stroke="#b8892b"
				stroke-opacity="0.45"
				stroke-width="1"
				pathLength="1"
				class="draw draw-late"
			/>
			<ellipse cx="300" cy="618" rx="250" ry="14" fill="#0c2a1d" opacity="0.08" class="ground" />
		</g>

		<!-- The monogram, in the gold of the ribbon. -->
		<g class="layer" style="--k: 9">
			<text
				x="300"
				y="500"
				text-anchor="middle"
				class="mono accent"
				font-size="250"
				fill="url(#g-foil)">A</text
			>
		</g>

		<g class="layer" style="--k: 16">
			{#each balloons as b (b.i)}
				<g class="pop" style="--d: {0.35 + b.i * 0.045}s">
					<g
						class="bob"
						style="--t: {5 + rand(b.i + 3) * 4}s; --o: {-rand(b.i + 5) * 6}s; --a: {2 +
							rand(b.i + 8) * 3}px"
					>
						<circle cx={b.x} cy={b.y} r={b.r} fill="url(#g-{b.tone})" />
						<ellipse
							cx={b.x - b.r * 0.32}
							cy={b.y - b.r * 0.4}
							rx={b.r * 0.2}
							ry={b.r * 0.12}
							fill="#fff"
							opacity="0.55"
							transform="rotate(-32 {b.x - b.r * 0.32} {b.y - b.r * 0.4})"
						/>
					</g>
				</g>
			{/each}
		</g>

		<g class="layer" style="--k: 26">
			{#each petals as p, index (index)}
				<ellipse
					class="petal"
					cx={p.x}
					cy="-20"
					rx={p.size}
					ry={p.size * 0.55}
					fill="url(#g-{p.tone})"
					style="--delay: {p.delay}s; --dur: {p.dur}s"
				/>
			{/each}
			{#each sparkles as s, index (index)}
				<use
					href="#spark"
					class="sparkle"
					x={s.x}
					y={s.y}
					fill="#c9982e"
					style="--s: {s.s}; --delay: {index * 0.7}s"
				/>
			{/each}
		</g>
	</svg>
</div>

<style>
	.hero-art {
		--mx: 0;
		--my: 0;
		width: 100%;
		height: 100%;
	}

	.layer {
		transform: translate(calc(var(--mx) * var(--k) * -1px), calc(var(--my) * var(--k) * -0.7px));
		transition: transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.pop,
	.bob,
	.sparkle,
	.petal,
	.arch-pane,
	.mono {
		transform-box: fill-box;
		transform-origin: center;
	}

	/* Each balloon pops in, in order, along the arch. */
	.pop {
		animation: pop 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) var(--d) both;
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.2);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Then they hang in the air, each on its own slow beat. */
	.bob {
		animation: bob var(--t) ease-in-out var(--o) infinite;
	}
	@keyframes bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(calc(var(--a) * -1));
		}
	}

	.arch-pane {
		animation: rise 1.4s cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(40px);
		}
	}

	.draw {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: draw 2.4s cubic-bezier(0.6, 0, 0.2, 1) 0.2s forwards;
	}
	.draw-late {
		animation-delay: 0.7s;
	}
	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	.ground {
		animation: fade 1.2s ease-out 0.4s both;
	}
	.mono {
		animation: fade 1.6s ease-out 1.1s both;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	.sparkle {
		animation: twinkle 3.2s ease-in-out var(--delay) infinite;
		opacity: 0;
	}
	@keyframes twinkle {
		0%,
		100% {
			opacity: 0;
			transform: scale(0.2) rotate(0deg);
		}
		50% {
			opacity: 0.95;
			transform: scale(var(--s)) rotate(45deg);
		}
	}

	.petal {
		opacity: 0.75;
		animation: fall var(--dur) linear var(--delay) infinite;
	}
	@keyframes fall {
		from {
			transform: translate(0, 0) rotate(0deg);
		}
		50% {
			transform: translate(26px, 340px) rotate(160deg);
		}
		to {
			transform: translate(-14px, 700px) rotate(340deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bob,
		.petal,
		.sparkle {
			animation: none;
		}
		.sparkle {
			opacity: 0.7;
		}
		.petal {
			display: none;
		}
		.draw {
			stroke-dashoffset: 0;
			animation: none;
		}
		.pop,
		.arch-pane,
		.mono,
		.ground {
			animation: none;
		}
		.layer {
			transition: none;
		}
	}
</style>
