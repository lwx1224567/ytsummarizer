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
});
