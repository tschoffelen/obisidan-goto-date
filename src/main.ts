import { Notice, Plugin } from "obsidian";
import moment from "moment";
import {
	appHasDailyNotesPluginLoaded,
	createDailyNote,
	getAllDailyNotes,
	getDailyNote,
} from "obsidian-daily-notes-interface";

import { DEFAULT_SETTINGS, Settings, SettingTab } from "./settings";
import { showDateModal } from "./date-modal";
import SuggestionPopup from "./at-symbol";
import { applyHotKeyHack } from "hotkeys";

export default class GotoDatePlugin extends Plugin {
	settings: Settings;

	async onload() {
		// Prepare settings
		await this.loadSettings();
		this.addSettingTab(new SettingTab(this.app, this));

		// Add menu command
		this.addCommand({
			id: "goto-date",
			name: "open daily note...",
			icon: "calendar",
			callback: async () => {
				if (!appHasDailyNotesPluginLoaded()) {
					new Notice(
						"Daily notes plugin not loaded. Please install it to use the 'Go To Date' plugin."
					);
					return;
				}

				const date = await showDateModal(this);

				const dailyNotes = getAllDailyNotes();
				let note = getDailyNote(moment(date), dailyNotes);
				if (!note) {
					note = await createDailyNote(moment(date));
				}

				this.app.workspace.getLeaf(false).openFile(note);
			},
		});

		// Add '@' suggestion popup
		this._suggestionPopup = new SuggestionPopup(this.app, this.settings);
		this.registerEditorSuggest(this._suggestionPopup);
		applyHotKeyHack(this, this.app);
	}

	async loadSettings() {
		this.settings = {
			...DEFAULT_SETTINGS,
			...(await this.loadData()),
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
