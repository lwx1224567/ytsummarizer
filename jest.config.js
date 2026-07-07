module.exports = {
	transform: { "^.+\\.ts?$": "ts-jest" },
	testEnvironment: "node",
	testRegex: ".*\\.(test|spec)?\\.(ts|tsx)$",
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
	moduleNameMapper: {
		"^obsidian$": "<rootDir>/__mocks__/obsidian.ts",
	},
};
