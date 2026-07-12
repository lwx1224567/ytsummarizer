import { parse } from "node-html-parser";
import { request, requestUrl } from "obsidian";

// ─── HTML entity decoding ───────────────────────────────────────────

/**
 * Decode common HTML entities and numeric character references in the
 * given string. This is more comprehensive than the inline .replaceAll()
 * chain used previously.
 */
function decodeHtmlEntities(text: string): string {
	return text
		// Named entities (most common in YouTube captions)
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&nbsp;/g, " ")
		// Numeric character references (decimal & hex)
		.replace(/&#(\d+);/g, (_m: string, dec: string) => String.fromCharCode(Number(dec)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_m: string, hex: string) =>
			String.fromCharCode(parseInt(hex, 16)),
		)
		// Common symbols
		.replace(/&copy;/g, "©")
		.replace(/&reg;/g, "®")
		.replace(/&trade;/g, "™")
		.replace(/&mdash;/g, "—")
		.replace(/&ndash;/g, "–")
		.replace(/&lsquo;/g, "'")
		.replace(/&rsquo;/g, "'")
		.replace(/&ldquo;/g, '"')
		.replace(/&rdquo;/g, '"')
		.replace(/&hellip;/g, "…");
}

// ─── Request headers (mimic browser to avoid bot detection) ──────

const BROWSER_HEADERS: Record<string, string> = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	"Accept-Language": "en-US,en;q=0.9",
};

// ─── Helper: extract YouTube video ID from URL ─────────────────────

function extractVideoId(url: string): string | null {
	const patterns = [
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
	];
	for (const p of patterns) {
		const m = url.match(p);
		if (m) return m[1];
	}
	return null;
}

// ─── Strategy A: YouTube timedtext API (JSON format) ───────────────

async function fetchTimedTextJson(
	url: string,
): Promise<TranscriptLine[] | null> {
	try {
		console.debug("[YTranscript] Trying JSON API:", url);
		const res = await requestUrl({
			url,
			headers: { ...BROWSER_HEADERS, "Referer": "https://www.youtube.com/" },
		});
		console.debug("[YTranscript] JSON API status:", res.status);
		if (!res.text || res.text.trim().length === 0) {
			console.debug("[YTranscript] JSON API returned empty body");
			return null;
		}
		const data = JSON.parse(res.text);
		const events: any[] = data?.events ?? [];
		if (events.length === 0) return null;
		const lines: TranscriptLine[] = [];
		for (const evt of events) {
			const segs = evt?.segs ?? [];
			const text = segs.map((s: any) => s?.utf8 ?? "").join("");
			if (text.trim()) {
				lines.push({
					text: decodeHtmlEntities(text),
					duration: (evt?.dDurationMs ?? 0),
					offset: (evt?.tStartMs ?? 0),
				});
			}
		}
		return lines.length > 0 ? lines : null;
	} catch (e) {
		console.debug("[YTranscript] JSON API error:", e);
		return null;
	}
}

// ─── Strategy B: youtubetranscript.com fallback ────────────────────

async function fetchYoutubetranscriptCom(
	videoId: string,
	lang: string,
): Promise<TranscriptLine[] | null> {
	try {
		const url = `https://youtubetranscript.com/?v=${videoId}&lang=${lang}`;
		console.debug("[YTranscript] Trying youtubetranscript.com:", url);
		const res = await requestUrl({
			url,
			headers: BROWSER_HEADERS,
		});
		console.debug("[YTranscript] youtubetranscript.com status:", res.status);
		if (!res.text || res.text.trim().length === 0) {
			console.debug("[YTranscript] youtubetranscript.com returned empty body");
			return null;
		}
		const xml = parse(res.text);
		const chunks = xml.getElementsByTagName("text");
		if (chunks.length === 0) return null;
		return chunks.map((cue: any) => ({
			text: decodeHtmlEntities(cue.textContent),
			duration: parseFloat(cue.attributes.dur) * 1000,
			offset: parseFloat(cue.attributes.start) * 1000,
		}));
	} catch (e) {
		console.debug("[YTranscript] youtubetranscript.com error:", e);
		return null;
	}
}

// ─── Strategy C: YouTube timedtext API (raw XML fallback) ──────────

async function fetchTimedTextXml(
	url: string,
): Promise<TranscriptLine[] | null> {
	try {
		console.debug("[YTranscript] Trying raw XML API:", url);
		const res = await request(url);
		if (!res || res.trim().length === 0) {
			console.debug("[YTranscript] Raw XML API returned empty body");
			return null;
		}
		const xml = parse(res);
		const chunks = xml.getElementsByTagName("text");
		if (chunks.length === 0) return null;
		return chunks.map((cue: any) => ({
			text: decodeHtmlEntities(cue.textContent),
			duration: parseFloat(cue.attributes.dur) * 1000,
			offset: parseFloat(cue.attributes.start) * 1000,
		}));
	} catch (e) {
		console.debug("[YTranscript] Raw XML API error:", e);
		return null;
	}
}

// ─── Strategy D: Invidious API (open-source YouTube frontend) ─────

const INVIDIOUS_INSTANCES = [
	"https://inv.nadeko.net",
	"https://yewtu.be",
	"https://invidious.privacyredirect.com",
	"https://vid.puffyan.us",
];

/**
 * WebVTT parser – uses string splitting, not regex, to avoid escaping issues.
 * WebVTT format:
 *   WEBVTT
 *   00:00:00.000 --> 00:00:05.000
 *   Hello world
 */
function parseWebVTT(vtt: string): TranscriptLine[] | null {
	try {
		const lines: TranscriptLine[] = [];
		// Normalize CRLF -> LF, then split
		const rawLines = vtt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
		let i = 0;
		// Skip WEBVTT header
		while (i < rawLines.length && rawLines[i].indexOf("-->") === -1) {
			i++;
		}

		while (i < rawLines.length) {
			const timeLine = rawLines[i].trim();
			if (timeLine.indexOf("-->") === -1) {
				i++;
				continue;
			}

			// Parse "HH:MM:SS.mmm --> HH:MM:SS.mmm"
			const arrowIdx = timeLine.indexOf(" --> ");
			if (arrowIdx === -1) { i++; continue; }

			const startStr = timeLine.substring(0, arrowIdx).trim();
			const endStr = timeLine.substring(arrowIdx + 5).trim();

			function parseHhmmssmmm(t: string): number {
				const dotIdx = t.lastIndexOf(".");
				const ms = dotIdx >= 0 ? parseInt(t.substring(dotIdx + 1), 10) || 0 : 0;
				const timePart = dotIdx >= 0 ? t.substring(0, dotIdx) : t;
				const parts = timePart.split(":");
				const h = parseInt(parts[0], 10) || 0;
				const m = parseInt(parts[1], 10) || 0;
				const s = parseInt(parts[2], 10) || 0;
				return (h * 3600 + m * 60 + s) * 1000 + ms;
			}

			const offset = parseHhmmssmmm(startStr);
			const endTime = parseHhmmssmmm(endStr);

			// Collect text lines until next timestamp or blank line
			i++;
			let text = "";
			while (
				i < rawLines.length &&
				rawLines[i].indexOf("-->") === -1 &&
				rawLines[i].trim() !== ""
			) {
				text += (text ? " " : "") + rawLines[i].trim();
				i++;
			}

			if (text) {
				lines.push({
					text: decodeHtmlEntities(text.replace(/<[^>]+>/g, "")),
					duration: endTime - offset,
					offset,
				});
			}
		}
		return lines.length > 0 ? lines : null;
	} catch (e) {
		console.debug("[YTranscript] WebVTT parse error:", e);
		return null;
	}
}

async function fetchInvidiousCaptions(
	videoId: string,
	lang: string,
): Promise<TranscriptLine[] | null> {
	for (const instance of INVIDIOUS_INSTANCES) {
		try {
			const url = `${instance}/api/v1/captions/${videoId}?label=${lang}`;
			console.debug("[YTranscript] Trying Invidious:", url);
			const res = await requestUrl({
				url,
				headers: BROWSER_HEADERS,
			});
			console.debug(
				"[YTranscript] Invidious status:",
				res.status,
				"from",
				instance,
			);
			if (!res.text || res.text.trim().length === 0) continue;
			const lines = parseWebVTT(res.text);
			if (lines) {
				console.debug(
					"[YTranscript] Invidious success:",
					lines.length,
					"lines from",
					instance,
				);
				return lines;
			}
		} catch (e) {
			console.debug(`[YTranscript] Invidious error (${instance}):`, e);
			continue;
		}
	}
	return null;
}

const YOUTUBE_TITLE_REGEX = new RegExp(
	/<meta\s+name="title"\s+content="([^"]*)">/,
);

export class YoutubeTranscriptError extends Error {
	constructor(err: unknown) {
		if (!(err instanceof Error)) {
			super(String(err ?? "Unknown error"));
			return;
		}

		if (err.message.includes("ERR_INVALID_URL")) {
			super("Invalid YouTube URL");
		} else {
			super(err.message);
		}
	}
}

export interface TranscriptConfig {
	lang?: string;
	country?: string;
}

export interface TranscriptResponse {
	title: string;
	lines: TranscriptLine[];
}

export interface TranscriptLine {
	text: string;
	duration: number;
	offset: number;
}

export class YoutubeTranscript {
	public static async fetchTranscript(
		url: string,
		config?: TranscriptConfig,
	) {
		try {
			const langCode = config?.lang ?? "en";

			const videoPageBody = await Promise.race([
				requestUrl({
					url,
					headers: BROWSER_HEADERS,
				}).then((res) => res.text),
				new Promise<string>((_, reject) =>
					setTimeout(
						() =>
							reject(
								new Error(
									"Request timed out after 30s. Please check your network or the YouTube URL.",
								),
							),
						30000,
					),
				),
			]);
			const parsedBody = parse(videoPageBody);

			const titleMatch = videoPageBody.match(YOUTUBE_TITLE_REGEX);
			let title = "";
			if (titleMatch) title = titleMatch[1];

			const scripts = parsedBody.getElementsByTagName("script");
			const playerScript = scripts.find((script) =>
				script.textContent.includes("var ytInitialPlayerResponse = {"),
			);

			if (!playerScript) {
				throw new Error(
					"Could not find player data on YouTube page. The page may be blocked, restricted, or YouTube may have changed its format.",
				);
			}

			// Robust extraction: find the JSON object by counting brace depth
			const afterVar = playerScript.textContent.split(
				"var ytInitialPlayerResponse = ",
			)?.[1];
			if (!afterVar) {
				throw new Error(
					"Could not parse YouTube player response (unexpected format).",
				);
			}

			const jsonStart = afterVar.indexOf("{");
			if (jsonStart === -1) {
				throw new Error(
					"Could not find player response JSON object.",
				);
			}

			// Count braces to find the matching closing brace
			let depth = 0;
			let jsonEnd = -1;
			for (let i = jsonStart; i < afterVar.length; i++) {
				if (afterVar[i] === "{") depth++;
				else if (afterVar[i] === "}") {
					depth--;
					if (depth === 0) {
						jsonEnd = i;
						break;
					}
				}
			}

			if (jsonEnd === -1) {
				throw new Error(
					"Could not parse YouTube player response (unclosed JSON).",
				);
			}

			const dataString = afterVar.substring(jsonStart, jsonEnd + 1);
			const data = JSON.parse(dataString);
			const availableCaptions =
				data?.captions?.playerCaptionsTracklistRenderer
					?.captionTracks || [];
			// Language fallback chain: preferred -> English -> first available
			let captionTrack = availableCaptions?.[0];
			if (langCode) {
				// 1. Try preferred language
				captionTrack = availableCaptions.find((track: any) =>
					track.languageCode.includes(langCode),
				);
				// 2. Fallback: try English (unless preferred language IS English)
				if (!captionTrack && langCode !== "en") {
					captionTrack = availableCaptions.find((track: any) =>
						track.languageCode.includes("en"),
					);
				}
				// 3. Final fallback: first available caption track
				if (!captionTrack) {
					captionTrack = availableCaptions?.[0];
				}
			}

			if (!captionTrack) {
				throw new Error(
					"No captions available for this video. The video may not have subtitles/closed captions.",
				);
			}

			const videoId = extractVideoId(url);
			const captionsUrl = captionTrack.baseUrl;
			const fixedCaptionsUrl = captionsUrl.startsWith("https://")
				? captionsUrl
				: "https://www.youtube.com" + captionsUrl;

			// Strategy 1: Unsigned simple URL (no IP/signature params)
			let lines: TranscriptLine[] | null = null;
			if (videoId) {
				const unsignedUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langCode}`;
				console.debug("[YTranscript] Strategy 1: unsigned URL:", unsignedUrl);
				lines = await fetchTimedTextJson(unsignedUrl + "&fmt=json3");
				if (!lines) {
					lines = await fetchTimedTextXml(unsignedUrl);
				}
			}

			// Strategy 2: Signed URL from page (JSON format)
			if (!lines) {
				console.debug("[YTranscript] Strategy 2: signed URL (JSON)...");
				lines = await fetchTimedTextJson(fixedCaptionsUrl + "&fmt=json3");
			}

			// Strategy 3: youtubetranscript.com
			if (!lines && videoId) {
				console.debug("[YTranscript] Strategy 3: youtubetranscript.com...");
				lines = await fetchYoutubetranscriptCom(videoId, langCode);
			}

			// Strategy 4: Signed URL (raw XML)
			if (!lines) {
				console.debug("[YTranscript] Strategy 4: signed URL (XML)...");
				lines = await fetchTimedTextXml(fixedCaptionsUrl);
			}

			// Strategy 5: Invidious instances (open-source YouTube proxies)
			if (!lines && videoId) {
				console.debug("[YTranscript] Strategy 5: Invidious instances...");
				lines = await fetchInvidiousCaptions(videoId, langCode);
			}

			if (!lines || lines.length === 0) {
				throw new Error(
					"All transcript sources returned empty. The video may not have captions, " +
					"or YouTube may be blocking requests from your network. Try using a VPN.",
				);
			}

			console.debug("[YTranscript] Parsed lines:", lines.length);

			return {
				title: title,
				lines,
			};
		} catch (err: any) {
			throw new YoutubeTranscriptError(err);
		}
	}
}
