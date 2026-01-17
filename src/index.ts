export interface Env {
	DB: D1Database;
	IMAGES: R2Bucket;
}

function corsHeaders(origin: string | null) {
	const allowlist = new Set(['https://w4-ffle.github.io', 'http://localhost:5173']);
	const allowedOrigin = origin && allowlist.has(origin) ? origin : 'https://w4-ffle.github.io';

	return {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type,X-User-Id',
		'Access-Control-Max-Age': '86400',
	};
}

function todayUtcId(): string {
	return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function json(data: unknown, cors: Record<string, string>, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get('Origin');
		const cors = corsHeaders(origin);

		// Preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: cors });
		}

		// Serve R2 images through the Worker
		// URL pattern: /img/<key>
		// Example key: 2026-01-16/r1_1.png
		if (request.method === 'GET' && url.pathname.startsWith('/img/')) {
			const key = decodeURIComponent(url.pathname.slice('/img/'.length));
			if (!key) return new Response('Bad Request', { status: 400, headers: cors });

			const obj = await env.IMAGES.get(key);
			if (!obj) return new Response('Not Found', { status: 404, headers: cors });

			const headers = new Headers(cors);
			headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'application/octet-stream');
			headers.set('Cache-Control', 'public, max-age=31536000, immutable');

			return new Response(obj.body, { status: 200, headers });
		}

		if (url.pathname === '/api/health') {
			const result = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
			return json({ ok: true, tables: result.results }, cors);
		}

		if (url.pathname === '/api/puzzle/today') {
			const date = todayUtcId();

			const puzzle = await env.DB.prepare('SELECT id FROM puzzles WHERE puzzle_date = ?').bind(date).first<{ id: number }>();

			if (!puzzle) {
				return json({ error: 'No puzzle seeded for today', date }, cors, 404);
			}

			// IMPORTANT:
			// We treat puzzle_images.image_url as an R2 object key (not a full URL).
			// Example stored value: "2026-01-16/r1_1.png"
			const rows = await env.DB.prepare(
				`SELECT round_index, image_url
           FROM puzzle_images
           WHERE puzzle_id = ?
           ORDER BY round_index, RANDOM()`,
			)
				.bind(puzzle.id)
				.all<{ round_index: number; image_url: string }>();

			const rounds: Record<string, string[]> = {};
			for (const r of rows.results) {
				const roundKey = String(r.round_index);
				const imageKey = r.image_url; // actually the R2 key
				const servedUrl = `${url.origin}/img/${encodeURIComponent(imageKey)}`;
				(rounds[roundKey] ??= []).push(servedUrl);
			}

			return json({ date, rounds }, cors);
		}

		return new Response('Not Found', { status: 404, headers: cors });
	},
};
