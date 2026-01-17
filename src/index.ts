export interface Env {
	DB: D1Database;
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

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get('Origin');
		const cors = corsHeaders(origin);

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: cors });
		}

		if (url.pathname === '/api/health') {
			const result = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

			return new Response(JSON.stringify({ ok: true, tables: result.results }, null, 2), {
				status: 200,
				headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
			});
		}

		if (url.pathname === '/api/puzzle/today') {
			const date = todayUtcId();

			const puzzle = await env.DB.prepare('SELECT id FROM puzzles WHERE puzzle_date = ?').bind(date).first<{ id: number }>();

			if (!puzzle) {
				return new Response(JSON.stringify({ error: 'No puzzle seeded for today', date }, null, 2), {
					status: 404,
					headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
				});
			}

			// IMPORTANT: do not return is_real to client
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
				const key = String(r.round_index);
				(rounds[key] ??= []).push(r.image_url);
			}

			return new Response(JSON.stringify({ date, rounds }, null, 2), {
				status: 200,
				headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
			});
		}

		return new Response('Not Found', { status: 404, headers: cors });
	},
};
