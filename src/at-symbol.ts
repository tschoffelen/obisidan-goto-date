import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	normalizePath,
	setIcon,
	type TFile,
} from "obsidian";
import moment from "moment";
import {
	getAllDailyNotes,
	getDailyNote,
	getDailyNoteSettings,
} from "obsidian-daily-notes-interface";
import fuzzysort from "fuzzysort";
import { FileOption } from "types";
import * as chrono from "chrono-node";
import { syntaxTree } from "@codemirror/language";
import { join } from "path";

import { Settings } from "./settings";
import { highlightSearch } from "./highlight-search";
import { sharedSelectSuggestion } from "select-suggestion";

const upperCaseFirst = (str: string) =>
	str.charAt(0).toUpperCase() + str.slice(1);

export function sharedGetSuggestions(
	files: TFile[],
	query: string
): Fuzzysort.KeysResult<FileOption>[] {
	if (!query) return [];

	const options: FileOption[] = [];

	// Add daily notes to suggestions
	const parsed = chrono.en.GB.parseDate(query);
	if (parsed) {
		const dailyNotes = getAllDailyNotes();
		const { format, folder } = getDailyNoteSettings();
		let filename = moment(parsed).format(format);
		const addDailyNote = (isCreateNewOption: boolean, path: string) => {
			const name = filename.replace(".md", "");
			if (name !== query) {
				options.push({
					isCreateNewOption,
					fileName: name,
					filePath: path,
					alias: filename,
					value: query,
					date: parsed,
				});
			}

			options.push({
				isCreateNewOption,
				fileName: name,
				filePath: path,
				alias: upperCaseFirst(query),
				value: query,
				date: parsed,
			});
		};

		const note = getDailyNote(moment(parsed), dailyNotes);
		if (note) {
			addDailyNote(false, note.path);
		} else {
			if (!filename.endsWith(".md")) {
				filename += ".md";
			}
			const path = normalizePath(join(folder || "", filename));
			addDailyNote(true, path);
		}
	}

	for (const file of files) {
		const meta = app.metadataCache.getFileCache(file);
		if (!meta?.frontmatter?.tags?.includes("person")) continue;

		if (meta?.frontmatter?.alias) {
			options.push({
				fileName: file.basename,
				filePath: file.path,
				alias: meta.frontmatter.alias,
			});
		} else if (meta?.frontmatter?.aliases) {
			let aliases = meta.frontmatter.aliases;
			if (typeof meta.frontmatter.aliases === "string") {
				aliases = meta.frontmatter.aliases.split(",");
			}

			if (aliases[0].trim()) {
				options.push({
					fileName: file.basename,
					filePath: file.path,
					alias: aliases[0].trim(),
				});
			}
		} else {
			options.push({
				fileName: file.basename,
				filePath: file.path,
			});
		}
	}

	// Show all files when no query
	let results = [];
	if (!query) {
		results = options
			.map((option) => ({
				obj: option,
			}))
			// Reverse because filesystem is sorted alphabetically
			.reverse();
	} else {
		// Fuzzy search files based on query
		results = fuzzysort.go(query, options, {
			keys: ["alias", "fileName", "value"],
		}) as any;
	}

	return results;
}

export function sharedRenderSuggestion(
	value: Fuzzysort.KeysResult<FileOption>,
	el: HTMLElement
): void {
	el.addClass("at-symbol-linking-suggestion");
	const context = el.doc.createElement("div");
	context.addClass("suggestion-context");
	context.id = "at-symbol-suggestion-context";

	// Add title with matching search terms bolded (highlighted)
	const title = el.doc.createElement("div");
	title.addClass("suggestion-title");
	if (value[0]) {
		highlightSearch(title, value[0]);
	} else if (value.obj?.alias) {
		title.setText(value.obj?.alias);
	} else if (value[1]) {
		highlightSearch(title, value[1]);
	} else if (value.obj?.fileName) {
		title.setText(value.obj?.fileName);
	} else {
		title.setText("");
	}

	const path = el.doc.createElement("div");
	path.addClass("suggestion-path");
	path.setText(value.obj?.filePath?.slice(0, -3));

	context.appendChild(title);
	context.appendChild(path);

	const aux = el.doc.createElement("div");
	aux.addClass("suggestion-aux");

	if (value?.obj?.alias) {
		const alias = el.doc.createElement("span");
		alias.addClass("suggestion-flair");
		alias.ariaLabel = "Alias";
		setIcon(alias, "forward");
		aux.appendChild(alias);
	}

	el.appendChild(context);
	el.appendChild(aux);
}

export default class SuggestionPopup extends EditorSuggest<
	Fuzzysort.KeysResult<FileOption>
> {
	private readonly settings: Settings;

	private firstOpenedCursor: null | EditorPosition = null;
	private focused = false;
	public name = "@ Symbol Linking Suggest";

	constructor(app: App, settings: Settings) {
		super(app);
		this.app = app;
		this.settings = settings;

		//Remove default key registrations
		const self = this as any;
		self.scope.keys = [];
	}

	open() {
		super.open();
		this.focused = true;
	}

	close() {
		super.close();
		this.focused = false;
	}

	getSuggestions(
		context: EditorSuggestContext
	): Fuzzysort.KeysResult<FileOption>[] {
		const files = context.file.vault.getMarkdownFiles();
		return sharedGetSuggestions(files, context.query);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor
	): EditorSuggestTriggerInfo | null {
		let query = "";
		const typedChar = editor.getRange(
			{ ...cursor, ch: cursor.ch - 1 },
			{ ...cursor, ch: cursor.ch }
		);

		// When open and user enters newline or tab, close
		if (
			this.firstOpenedCursor &&
			(typedChar === "\n" || typedChar === "\t")
		) {
			return this.closeSuggestion();
		}

		// If user's cursor is inside a code block, don't attempt to link
		let isInCodeBlock = false;
		if ((editor as any)?.cm) {
			const cm = (editor as any).cm;
			const cursor = cm.state?.selection?.main as {
				from: number;
				to: number;
			};
			syntaxTree(cm.state).iterate({
				from: cursor.from,
				to: cursor.to,
				enter(node) {
					if (
						node.type.name === "inline-code" ||
						node.type.name?.includes("codeblock")
					) {
						isInCodeBlock = true;
					}
				},
			});
		}

		// If already open, allow backticks to be part of file name
		if (isInCodeBlock && !this.firstOpenedCursor) {
			return null;
		}

		// Open suggestion when trigger is typed
		if (typedChar === "@") {
			this.firstOpenedCursor = cursor;
			return null;
		}

		// Don't continue evaluating if not opened
		if (!this.firstOpenedCursor) {
			return null;
		} else {
			query = editor.getRange(this.firstOpenedCursor, {
				...cursor,
				ch: cursor.ch,
			});
		}

		// If query has more spaces alloted by the leavePopupOpenForXSpaces setting, close
		if (
			query.split(" ").length - 1 > 3 ||
			// Also close if query starts with a space, regardless of space settings
			query.startsWith(" ")
		) {
			return this.closeSuggestion();
		}

		if (!query) {
			return this.closeSuggestion();
		}

		return {
			start: { ...cursor, ch: cursor.ch - 1 },
			end: cursor,
			query,
		};
	}

	renderSuggestion(
		value: Fuzzysort.KeysResult<FileOption>,
		el: HTMLElement
	): void {
		sharedRenderSuggestion(value, el);
	}

	async selectSuggestion(
		value: Fuzzysort.KeysResult<FileOption>
	): Promise<void> {
		const line =
			this.context?.editor.getRange(
				{
					line: this.context.start.line,
					ch: 0,
				},
				this.context.end
			) || "";

		const linkText = await sharedSelectSuggestion(this.app, value);

		this.context?.editor.replaceRange(
			linkText,
			{
				line: this.context.start.line,
				ch: line.lastIndexOf("@"),
			},
			this.context.end
		);

		// Close suggestion popup
		this.closeSuggestion();
	}

	selectNextItem(dir: SelectionDirection) {
		if (!this.focused) {
			this.focused = true;
			dir =
				dir === SelectionDirection.PREVIOUS
					? dir
					: SelectionDirection.NONE;
		}

		const self = this as any;
		// HACK: The second parameter has to be an instance of KeyboardEvent to force scrolling the selected item into
		// view
		self.suggestions.setSelectedItem(
			self.suggestions.selectedItem + dir,
			new KeyboardEvent("keydown")
		);
	}

	closeSuggestion() {
		this.firstOpenedCursor = null;
		this.close();
		return null;
	}

	getSelectedItem(): Fuzzysort.KeysResult<FileOption> {
		const self = this as any;
		return self.suggestions.values[self.suggestions.selectedItem];
	}

	applySelectedItem() {
		const self = this as any;
		self.suggestions.useSelectedItem();
	}

	isVisible(): boolean {
		return (this as any).isOpen;
	}

	isFocused(): boolean {
		return this.focused;
	}
}

export enum SelectionDirection {
	NEXT = 1,
	PREVIOUS = -1,
	NONE = 0,
}
