<!--
	A ribbon that draws itself, three balloons and a few sparkles: the About page's picture, in SVG
	so there is nothing to download. Motion is CSS-only and off for reduced motion.
-->
<svg viewBox="0 0 420 420" class="ribbon-art h-full w-full" focusable="false" aria-hidden="true">
	<defs>
		<linearGradient id="ra-foil" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#e9c574" />
			<stop offset="0.5" stop-color="#b8892b" />
			<stop offset="1" stop-color="#f0d68e" />
		</linearGradient>
		<radialGradient id="ra-ribbon" cx="34%" cy="28%" r="80%">
			<stop offset="0" stop-color="#e0568f" />
			<stop offset="0.55" stop-color="#b0175a" />
			<stop offset="1" stop-color="#7d0f40" />
		</radialGradient>
		<radialGradient id="ra-blush" cx="34%" cy="28%" r="80%">
			<stop offset="0" stop-color="#fff0f6" />
			<stop offset="0.55" stop-color="#f4bcd4" />
			<stop offset="1" stop-color="#dc92b4" />
		</radialGradient>
		<radialGradient id="ra-plum" cx="34%" cy="28%" r="80%">
			<stop offset="0" stop-color="#8a4a8e" />
			<stop offset="0.55" stop-color="#4f2153" />
			<stop offset="1" stop-color="#2e1330" />
		</radialGradient>
		<path id="ra-spark" d="M0 -11 Q0.8 -0.8 11 0 Q0.8 0.8 0 11 Q-0.8 0.8 -11 0 Q-0.8 -0.8 0 -11Z" />
	</defs>

	<!-- Strings, then the ribbon that ties them. -->
	<g class="strings" fill="none" stroke="#2e1330" stroke-opacity="0.35" stroke-width="1.2">
		<path d="M120 190 C140 260 180 300 210 330" pathLength="1" class="draw" />
		<path d="M230 130 C230 220 214 290 210 330" pathLength="1" class="draw d2" />
		<path d="M320 200 C300 270 240 310 210 330" pathLength="1" class="draw d3" />
	</g>
	<path
		d="M40 380 C120 300 90 230 190 250 C290 270 250 350 340 300 C380 278 390 240 380 210"
		fill="none"
		stroke="url(#ra-foil)"
		stroke-width="7"
		stroke-linecap="round"
		pathLength="1"
		class="draw ribbon"
	/>
	<path
		d="M40 380 C120 300 90 230 190 250 C290 270 250 350 340 300 C380 278 390 240 380 210"
		fill="none"
		stroke="#b0175a"
		stroke-width="2"
		stroke-linecap="round"
		stroke-dasharray="1 14"
		pathLength="100"
		opacity="0.5"
		transform="translate(0 10)"
	/>

	<g class="balloon" style="--d: 0.6s; --t: 6s">
		<circle cx="120" cy="140" r="58" fill="url(#ra-ribbon)" />
		<ellipse
			cx="100"
			cy="118"
			rx="12"
			ry="7"
			fill="#fff"
			opacity="0.5"
			transform="rotate(-32 100 118)"
		/>
	</g>
	<g class="balloon" style="--d: 0.85s; --t: 7.5s">
		<circle cx="232" cy="78" r="48" fill="url(#ra-blush)" />
		<ellipse
			cx="216"
			cy="60"
			rx="10"
			ry="6"
			fill="#fff"
			opacity="0.6"
			transform="rotate(-32 216 60)"
		/>
	</g>
	<g class="balloon" style="--d: 1.1s; --t: 5.5s">
		<circle cx="322" cy="150" r="52" fill="url(#ra-plum)" />
		<ellipse
			cx="304"
			cy="130"
			rx="11"
			ry="6.5"
			fill="#fff"
			opacity="0.4"
			transform="rotate(-32 304 130)"
		/>
	</g>

	<use href="#ra-spark" x="60" y="60" fill="#c9982e" class="sparkle" style="--delay: 0s" />
	<use href="#ra-spark" x="380" y="70" fill="#c9982e" class="sparkle" style="--delay: 1.1s" />
	<use href="#ra-spark" x="370" y="360" fill="#c9982e" class="sparkle" style="--delay: 2s" />
</svg>

<style>
	.draw {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: draw 2.2s cubic-bezier(0.6, 0, 0.2, 1) 0.3s forwards;
	}
	.draw.d2 {
		animation-delay: 0.5s;
	}
	.draw.d3 {
		animation-delay: 0.7s;
	}
	.ribbon {
		animation-duration: 3s;
		animation-delay: 0.9s;
	}
	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}
	.balloon {
		transform-box: fill-box;
		transform-origin: center;
		animation:
			pop 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) var(--d) both,
			bob var(--t) ease-in-out calc(var(--d) + 0.9s) infinite;
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.2);
		}
	}
	@keyframes bob {
		50% {
			transform: translateY(-8px);
		}
	}
	.sparkle {
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0;
		animation: twinkle 3.2s ease-in-out var(--delay) infinite;
	}
	@keyframes twinkle {
		50% {
			opacity: 0.95;
			transform: scale(1.1) rotate(45deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.draw {
			animation: none;
			stroke-dashoffset: 0;
		}
		.balloon,
		.sparkle {
			animation: none;
		}
		.sparkle {
			opacity: 0.7;
		}
	}
</style>
