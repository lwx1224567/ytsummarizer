import { TranscriptLine } from "./fetch-transcript";
import { TranscriptBlock } from "./types";

// ─── Token estimation & transcript chunking ───────────────────────────

/**
 * Rough token count from character length.
 * Uses the heuristic `charCount / 4 ≈ tokenCount` for English text.
 * This avoids a heavy dependency like `tiktoken` and is accurate enough for
 * deciding when to split transcripts.
 */
export function estimateTokens(text: string): number {
	if (!text) return 0;
	return Math.ceil(text.length / 4);
}

/**
 * Split `text` into chunks where each chunk stays under `maxTokens` (estimated).
 * Tries to break on sentence boundaries (`. `, `! `, `? `, `\n`) to avoid
 * cutting mid-sentence. Falls back to hard character splits if no boundary
 * is found within the limit.
 */
export function splitTranscript(
	text: string,
	maxTokens: number,
): string[] {
	const maxChars = maxTokens * 4; // convert token limit → char limit
	const chunks: string[] = [];

	let remaining = text;
	let safetyCounter = 0;
	const MAX_ITERATIONS = 1000;
	while (remaining.length > 0) {
		safetyCounter++;
		if (safetyCounter > MAX_ITERATIONS) {
			// Safety guard: should never happen unless there's a logic bug
			console.warn("splitTranscript: safety limit reached, returning remaining text as final chunk");
			chunks.push(remaining.trim());
			break;
		}
		if (remaining.length <= maxChars) {
			chunks.push(remaining.trim());
			break;
		}

		// Search for a sentence boundary within the last 20% of the chunk window
		const searchStart = Math.floor(maxChars * 0.8);
		const searchWindow = remaining.substring(searchStart, maxChars);

		// Try to find a good split point (prefer sentence endings, then newlines)
		const sentenceMatch = searchWindow.match(/[.!?]\s/);
		const newlineMatch = searchWindow.match(/\n/);

		let splitOffset: number;
		if (sentenceMatch && sentenceMatch.index !== undefined) {
			splitOffset = searchStart + sentenceMatch.index + 1; // include the punctuation
		} else if (newlineMatch && newlineMatch.index !== undefined) {
			splitOffset = searchStart + newlineMatch.index;
		} else {
			// Hard split at maxChars — try to find a space to avoid word-splitting
			const spaceMatch = searchWindow.match(/\s/);
			splitOffset = spaceMatch && spaceMatch.index !== undefined
				? searchStart + spaceMatch.index
				: maxChars;
		}

		chunks.push(remaining.substring(0, splitOffset).trim());
		remaining = remaining.substring(splitOffset).trim();
	}

	return chunks;
}

// ─── Highlight & transcript blocks (existing) ─────────────────────────

/**
 * Highlights matched text in the div
 * @param div - the div that we want to highlight
 * @param searchValue - the value that will be highlight
 */
export const highlightText = (div: HTMLElement, searchValue: string) => {
	// Clear the div
	const textContent = div.textContent || "";
	div.empty();

	if (!searchValue.trim()) {
		div.setText(textContent);
		return;
	}

	const regex = new RegExp(searchValue, "gi");
	let match;
	let lastIndex = 0;

	// Split the text by matches and create spans for highlighted parts
	while ((match = regex.exec(textContent)) !== null) {
		// Add text before match
		if (match.index > lastIndex) {
			div.createSpan({
				text: textContent.substring(lastIndex, match.index)
			});
		}

		// Add highlighted match
		div.createSpan({
			text: match[0],
			cls: "yt-transcript__highlight"
		});

		lastIndex = regex.lastIndex;
	}

	// Add remaining text after last match
	if (lastIndex < textContent.length) {
		div.createSpan({
			text: textContent.substring(lastIndex)
		});
	}
};

/**
 * Gets an array of transcript render blocks
 * @param data - the transcript data
 * @param timestampMod - the number of seconds between each timestamp
 */
export const getTranscriptBlocks = (
	data: TranscriptLine[],
	timestampMod: number,
) => {
	const transcriptBlocks: TranscriptBlock[] = [];

	//Convert data into blocks
	let quote = "";
	let quoteTimeOffset = 0;
	data.forEach((line, i) => {
		if (i === 0) {
			quoteTimeOffset = line.offset;
			quote += line.text + " ";
			return;
		}
		if (i % timestampMod == 0) {
			transcriptBlocks.push({
				quote,
				quoteTimeOffset,
			});

			//Clear the data
			quote = "";
			quoteTimeOffset = line.offset;
		}
		quote += line.text + " ";
	});

	if (quote !== "") {
		transcriptBlocks.push({
			quote,
			quoteTimeOffset,
		});
	}
	return transcriptBlocks;
};
