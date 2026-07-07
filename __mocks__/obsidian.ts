// Minimal mock of the obsidian module for Jest tests
export class Notice {
	constructor(_message: string, _timeout?: number) {}
}

export class Plugin {
	app: any;
	manifest: any;

	loadData(): Promise<any> {
		return Promise.resolve({});
	}
	saveData(_data: any): Promise<void> {
		return Promise.resolve();
	}
	addRibbonIcon(_icon: string, _title: string, _callback: () => void): HTMLElement {
		return document.createElement("div");
	}
	addCommand(_command: any): void {}
	addSettingTab(_tab: any): void {}
	registerView(_type: string, _viewCreator: any): void {}
}

export class PluginSettingTab {
	app: any;
	plugin: any;
	containerEl: HTMLElement;

	constructor(app: any, plugin: any) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = document.createElement("div");
	}

	display(): void {}
}

export class ItemView {
	app: any;
	leaf: any;
	contentEl: HTMLElement;

	constructor(leaf: any) {
		this.leaf = leaf;
		this.contentEl = document.createElement("div");
	}

	getViewType(): string {
		return "";
	}
	getDisplayText(): string {
		return "";
	}
	getIcon(): string {
		return "";
	}
	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}
}

export class MarkdownView {}
export class TFile {}
export class Modal {
	app: any;
	titleEl: HTMLElement;
	contentEl: HTMLElement;
	modalEl: HTMLElement;

	constructor(app: any) {
		this.app = app;
		this.titleEl = document.createElement("div");
		this.contentEl = document.createElement("div");
		this.modalEl = document.createElement("div");
	}

	open(): void {}
	close(): void {}
	onOpen(): void {}
	onClose(): void {}
}

export class ButtonComponent {
	buttonEl: HTMLElement;
	constructor(container: HTMLElement) {
		this.buttonEl = container.createEl("button");
	}
	setButtonText(_text: string): this {
		return this;
	}
	setCta(): this {
		return this;
	}
	onClick(_callback: (evt: MouseEvent) => void): this {
		return this;
	}
}

export class TextComponent {
	inputEl: HTMLInputElement;
	constructor(container: HTMLElement) {
		this.inputEl = document.createElement("input") as HTMLInputElement;
	}
	setValue(_value: string): this {
		return this;
	}
	setPlaceholder(_text: string): this {
		return this;
	}
	onChange(_callback: (value: string) => void): this {
		return this;
	}
}

export class Setting {
	constructor(_container: HTMLElement) {}
	setName(_name: string): this {
		return this;
	}
	setDesc(_desc: string): this {
		return this;
	}
	setHeading(): this {
		return this;
	}
	addText(_cb: (text: TextComponent) => void): this {
		return this;
	}
	addTextArea(_cb: (textarea: TextComponent) => void): this {
		return this;
	}
	addDropdown(_cb: (dropdown: any) => void): this {
		return this;
	}
}

export function setIcon(_el: HTMLElement, _icon: string): void {}

export function requestUrl(_url: string): Promise<any> {
	return Promise.resolve({});
}

export function request(_url: string): Promise<string> {
	return Promise.resolve("");
}

export const WorkspaceLeaf = {};
