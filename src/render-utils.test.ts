import { estimateTokens, splitTranscript } from "./render-utils";

describe("estimateTokens", () => {
	it("should return 0 for empty string", () => {
		expect(estimateTokens("")).toBe(0);
	});

	it("should estimate ~1 token per 4 characters", () => {
		// 4 characters → 1 token
		expect(estimateTokens("abcd")).toBe(1);
	});

	it("should round up for partial tokens", () => {
		// 5 characters → 2 tokens (ceil(5/4))
		expect(estimateTokens("abcde")).toBe(2);
	});

	it("should handle typical transcript length", () => {
		// 1000 chars ~ 250 tokens
		const text = "a".repeat(1000);
		expect(estimateTokens(text)).toBe(250);
	});
});

describe("splitTranscript", () => {
	it("should return single chunk for short text", () => {
		const text = "Short transcript.";
		const chunks = splitTranscript(text, 100); // 100 tokens = 400 chars
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toBe(text);
	});

	it("should split long text into multiple chunks", () => {
		// Create text that's longer than our token limit
		const sentence = "This is a test sentence. ";
		const text = sentence.repeat(50); // ~1350 chars, ~340 tokens
		const chunks = splitTranscript(text, 50); // 50 tokens = 200 chars max per chunk
		expect(chunks.length).toBeGreaterThan(1);
	});

	it("should split on sentence boundaries when possible", () => {
		const text =
			"First sentence. Second sentence. Third sentence. Fourth sentence.";
		const chunks = splitTranscript(text, 10); // 10 tokens = 40 chars
		expect(chunks.length).toBeGreaterThan(1);
		// At least the first chunk should end with punctuation
		expect(chunks[0].trim()).toMatch(/[.!?]$/);
	});

	it("should not produce empty chunks", () => {
		const text = "Some text that will be split into chunks.";
		const chunks = splitTranscript(text, 5); // small token limit
		chunks.forEach((chunk) => {
			expect(chunk.trim().length).toBeGreaterThan(0);
		});
	});

	it("should handle text with no sentence boundaries", () => {
		// Text with no punctuation or spaces (worst case)
		const text = "abcdefghijklmnopqrstuvwxyz".repeat(10);
		const chunks = splitTranscript(text, 5); // 5 tokens = 20 chars
		chunks.forEach((chunk) => {
			expect(chunk.length).toBeGreaterThan(0);
		});
	});

	it("should preserve total content across splits", () => {
		const text =
			"A complete transcript. With multiple sentences. That should be preserved. After splitting and rejoining.";
		const chunks = splitTranscript(text, 10); // 10 tokens = 40 chars
		const rejoined = chunks.join(" ").replace(/\s+/g, " ");
		const original = text.replace(/\s+/g, " ");
		// Verify most words are preserved (some whitespace may differ)
		expect(rejoined.length).toBeGreaterThan(original.length * 0.8);
	});
});
