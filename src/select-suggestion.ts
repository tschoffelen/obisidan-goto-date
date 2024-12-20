import { type TFile, type App } from "obsidian";
import { createDailyNote } from "obsidian-daily-notes-interface";
import moment from "moment";

import { FileOption } from "./types";

export async function sharedSelectSuggestion(
	app: App,
	value: Fuzzysort.KeysResult<FileOption>
): Promise<string> {
	let linkFile;

	// Create new daily note if the option is selected
	if (value?.obj?.isCreateNewOption && value?.obj?.date) {
		const note = await createDailyNote(moment(value.obj.date));
		value.obj.filePath = note.path;
		value.obj.fileName = note.basename;
		linkFile = note;
	}

	const currentFile = app.workspace.getActiveFile();
	if (!linkFile) {
		linkFile = app.vault.getAbstractFileByPath(
			value.obj?.filePath
		) as TFile;
	}

	let alias = value.obj?.alias || "";
	let linkText = app.fileManager.generateMarkdownLink(
		linkFile,
		currentFile?.path || "",
		undefined, // we don't care about the subpath
		alias
	);

	if (linkText.includes("\n")) {
		linkText = linkText.replace(/\n/g, "");
	}

	return linkText + " ";
}
