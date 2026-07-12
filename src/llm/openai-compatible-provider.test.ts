import { OpenAICompatibleProvider } from "./openai-compatible-provider";
import { DEFAULT_LLM_SETTINGS, LLMSettings } from "./types";
import { OpenAI } from "openai";

// Mock the OpenAI module
jest.mock("openai");

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

function makeSettings(overrides: Partial<LLMSettings> = {}): LLMSettings {
	return {
		...DEFAULT_LLM_SETTINGS,
		apiKey: "sk-test-key",
		...overrides,
	};
}

/**
 * Helper: create a mock async iterable that emits chunks then resolves.
 * Simulates the OpenAI v4 streaming response.
 */
function mockStreamChunks(
	chunks: string[],
	shouldError = false,
): AsyncIterable<unknown> {
	let callCount = 0;
	return {
		[Symbol.asyncIterator]() {
			return {
				async next(): Promise<IteratorResult<unknown>> {
					if (shouldError) {
						throw new Error("Connection reset");
					}
					if (callCount < chunks.length) {
						const content = chunks[callCount];
						callCount++;
						return {
							value: {
								choices: [{ delta: { content } }],
							},
							done: false,
						};
					}
					return { value: undefined, done: true };
				},
			};
		},
	};
}

describe("OpenAICompatibleProvider", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("generateSummaryStream", () => {
		it("should stream chunks via onChunk and return full text", async () => {
			const mockCreate = jest.fn().mockResolvedValue(
				mockStreamChunks(["Hello", " ", "World", "!"]),
			);
			MockedOpenAI.mockImplementation(
				() =>
					({
						chat: { completions: { create: mockCreate } },
					}) as unknown as OpenAI,
			);

			const provider = new OpenAICompatibleProvider(makeSettings());
			const chunks: string[] = [];

			const result = await provider.generateSummaryStream(
				"transcript text",
				"Test Video",
				"https://youtube.com/watch?v=test",
				(chunk: string) => chunks.push(chunk),
			);

			expect(result).toBe("Hello World!");
			expect(chunks).toEqual(["Hello", " ", "World", "!"]);
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gpt-4o-mini",
					stream: true,
					max_tokens: 1000,
				}),
			);
		});

		it("should handle empty stream gracefully", async () => {
			const mockCreate = jest.fn().mockResolvedValue(mockStreamChunks([]));
			MockedOpenAI.mockImplementation(
				() =>
					({
						chat: { completions: { create: mockCreate } },
					}) as unknown as OpenAI,
			);

			const provider = new OpenAICompatibleProvider(makeSettings());
			const chunks: string[] = [];

			const result = await provider.generateSummaryStream(
				"transcript",
				"Title",
				"https://example.com",
				(chunk: string) => chunks.push(chunk),
			);

			expect(result).toBe("Failed to generate summary.");
			expect(chunks).toHaveLength(0);
		});

		it("should fall back to non-streaming on stream error (no partial content)", async () => {
			// First call (stream) throws, second (non-streaming fallback) succeeds
			const mockCreate = jest
				.fn()
				.mockRejectedValueOnce(new Error("Stream not supported"))
				.mockResolvedValueOnce({
					choices: [{ message: { content: "Fallback summary." } }],
				});

			MockedOpenAI.mockImplementation(
				() =>
					({
						chat: { completions: { create: mockCreate } },
					}) as unknown as OpenAI,
			);

			const provider = new OpenAICompatibleProvider(makeSettings());

			// Spy on generateSummary to verify fallback call
			const fallbackSpy = jest.spyOn(provider, "generateSummary");

			const result = await provider.generateSummaryStream(
				"transcript",
				"Title",
				"https://example.com",
				() => {},
			);

			// Should return the fallback summary
			expect(result).toBe("Fallback summary.");
			// Should have called generateSummary once (as fallback)
			expect(fallbackSpy).toHaveBeenCalledTimes(1);
			expect(mockCreate).toHaveBeenCalledTimes(2);
			// Second call should be non-streaming
			expect(mockCreate).toHaveBeenNthCalledWith(
				2,
				expect.not.objectContaining({ stream: true }),
			);
		});

		it("should throw when both streaming and fallback fail", async () => {
			const mockCreate = jest.fn().mockRejectedValue(new Error("API down"));
			MockedOpenAI.mockImplementation(
				() =>
					({
						chat: { completions: { create: mockCreate } },
					}) as unknown as OpenAI,
			);

			const provider = new OpenAICompatibleProvider(makeSettings());

			await expect(
				provider.generateSummaryStream(
					"transcript",
					"Title",
					"https://example.com",
					() => {},
				),
			).rejects.toThrow("Summary generation failed");
		});

		it("should throw when client is not configured", async () => {
			const provider = new OpenAICompatibleProvider(
				makeSettings({ apiKey: "" }),
			);

			await expect(
				provider.generateSummaryStream(
					"transcript",
					"Title",
					"https://example.com",
					() => {},
				),
			).rejects.toThrow("LLM is not configured");
		});

		it("should use custom prompt from settings when provided", async () => {
			const mockCreate = jest.fn().mockResolvedValue(
				mockStreamChunks(["Custom summary"]),
			);
			MockedOpenAI.mockImplementation(
				() =>
					({
						chat: { completions: { create: mockCreate } },
					}) as unknown as OpenAI,
			);

			const provider = new OpenAICompatibleProvider(
				makeSettings({
					customPrompt: "You are a helpful assistant. Be brief.",
				}),
			);

			await provider.generateSummaryStream(
				"transcript",
				"Title",
				"https://example.com",
				() => {},
			);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "system",
							content: "You are a helpful assistant. Be brief.",
						}),
					]),
				}),
			);
		});
	});

	describe("translateText", () => {
			it("should return translated text on success", async () => {
				const mockCreate = jest.fn().mockResolvedValue({
					choices: [{ message: { content: "这是翻译后的文本。" } }],
				});
				MockedOpenAI.mockImplementation(
					() =>
						({
							chat: { completions: { create: mockCreate } },
						}) as unknown as OpenAI,
				);

				const provider = new OpenAICompatibleProvider(makeSettings());

				const result = await provider.translateText(
					"This is the summary text.",
					"Chinese",
				);

				expect(result).toBe("这是翻译后的文本。");
				expect(mockCreate).toHaveBeenCalledTimes(1);
				expect(mockCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						model: "gpt-4o-mini",
						stream: false,
					}),
				);
			});

			it("should use translation-specific system prompt with target language", async () => {
				const mockCreate = jest.fn().mockResolvedValue({
					choices: [{ message: { content: "Texto traducido." } }],
				});
				MockedOpenAI.mockImplementation(
					() =>
						({
							chat: { completions: { create: mockCreate } },
						}) as unknown as OpenAI,
				);

				const provider = new OpenAICompatibleProvider(makeSettings());

				await provider.translateText("Hello world.", "Spanish");

				const callArgs = mockCreate.mock.calls[0][0];
				expect(callArgs.messages[0].role).toBe("system");
				expect(callArgs.messages[0].content).toContain("Spanish");
				expect(callArgs.messages[0].content).toContain("Translate");
				expect(callArgs.messages[1].role).toBe("user");
				expect(callArgs.messages[1].content).toBe("Hello world.");
			});

			it("should throw descriptive error on API failure", async () => {
				const mockCreate = jest.fn().mockRejectedValue(new Error("API key invalid"));
				MockedOpenAI.mockImplementation(
					() =>
						({
							chat: { completions: { create: mockCreate } },
						}) as unknown as OpenAI,
				);

				const provider = new OpenAICompatibleProvider(makeSettings());

				await expect(
					provider.translateText("Some text", "Chinese"),
				).rejects.toThrow("Translation failed");
			});

			it("should throw when client is not configured", async () => {
				const provider = new OpenAICompatibleProvider(
					makeSettings({ apiKey: "" }),
				);

				await expect(
					provider.translateText("Text", "French"),
				).rejects.toThrow("LLM is not configured");
			});
		});

	describe("generateSegmentedSummary", () => {
		it("should return single chunk when transcript fits in one chunk", async () => {
			const mockCreate = jest.fn().mockResolvedValue({
				choices: [{ message: { content: "Single chunk summary." } }],
			});
			MockedOpenAI.mockImplementation(
				() =>
					({
						chat: { completions: { create: mockCreate } },
					}) as unknown as OpenAI,
			);

			const provider = new OpenAICompatibleProvider(
				makeSettings({ segmentedThreshold: 4000 }),
			);

			const result = await provider.generateSegmentedSummary(
				"Short transcript text.",
				"Test Video",
				"https://example.com",
			);

			expect(result.chunkSummaries).toHaveLength(1);
			expect(result.mergedSummary).toBe("Single chunk summary.");
			expect(mockCreate).toHaveBeenCalledTimes(1);
		});

		it("should map-reduce long transcripts", async () => {
			// Build text that's ~250 chars to produce exactly 2 chunks with threshold 30 tokens (120 chars)
			const longText = "This is a long transcript sentence. ".repeat(10);

			let callCount = 0;
			const mockCreate = jest.fn().mockImplementation(() => {
				callCount++;
				return Promise.resolve({
					choices: [{ message: { content: `Response ${callCount}.` } }],
				});
			});

			MockedOpenAI.mockImplementation(
				() =>
					({
						chat: { completions: { create: mockCreate } },
					}) as unknown as OpenAI,
			);

			const provider = new OpenAICompatibleProvider(
				makeSettings({ segmentedThreshold: 30 }), // 30 tokens = 120 chars → 2 chunks
			);

			const result = await provider.generateSegmentedSummary(
				longText,
				"Long Video",
				"https://example.com",
			);

			expect(result.chunkSummaries.length).toBeGreaterThanOrEqual(2);
			expect(result.mergedSummary).toBeTruthy();
			expect(mockCreate).toHaveBeenCalledTimes(result.chunkSummaries.length + 1); // N map + 1 reduce
		});

		it("should call onProgress during map and reduce phases", async () => {
			const longText = "A sentence. ".repeat(30);
			let callCount = 0;
			const mockCreate = jest.fn().mockImplementation(() => {
				callCount++;
				return Promise.resolve({
					choices: [{ message: { content: `Response ${callCount}.` } }],
				});
			});

			MockedOpenAI.mockImplementation(
				() =>
					({
						chat: { completions: { create: mockCreate } },
					}) as unknown as OpenAI,
			);

			const provider = new OpenAICompatibleProvider(
				makeSettings({ segmentedThreshold: 40 }),
			);

			const progressCalls: Array<[string, number, number]> = [];
			await provider.generateSegmentedSummary(
				longText,
				"Progress Test",
				"https://example.com",
				(phase, done, total) => {
					progressCalls.push([phase, done, total]);
				},
			);

			// Should have at least map progress calls + one reduce
			expect(progressCalls.length).toBeGreaterThan(0);
			const mapCalls = progressCalls.filter(([p]) => p === "map");
			const reduceCalls = progressCalls.filter(([p]) => p === "reduce");
			expect(mapCalls.length).toBeGreaterThanOrEqual(1);
			expect(reduceCalls.length).toBe(1);
		});

		it("should handle chunk failure gracefully and continue", async () => {
			const longText = "A sentence here. ".repeat(30);
			let callCount = 0;
			const mockCreate = jest.fn().mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return Promise.reject(new Error("Chunk API error"));
				}
				return Promise.resolve({
					choices: [{ message: { content: `Response ${callCount}.` } }],
				});
			});

			MockedOpenAI.mockImplementation(
				() =>
					({
						chat: { completions: { create: mockCreate } },
					}) as unknown as OpenAI,
			);

			const provider = new OpenAICompatibleProvider(
				makeSettings({ segmentedThreshold: 40 }),
			);

			const result = await provider.generateSegmentedSummary(
				longText,
				"Error Test",
				"https://example.com",
			);

			// First chunk should have error
			const failedChunk = result.chunkSummaries.find((c) => c.index === 1);
			expect(failedChunk?.error).toBeDefined();

			// Second chunk should be fine
			const goodChunk = result.chunkSummaries.find((c) => c.index === 2);
			expect(goodChunk?.summary).toBe("Response 2.");

			// Merged summary should still be produced
			expect(result.mergedSummary).toBeTruthy();
		});
	});
});
