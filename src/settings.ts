import { App, PluginSettingTab, Setting } from "obsidian";
import GotoDatePlugin from "./main";

export interface Settings {
	startOfWeek: string;
}

export const DEFAULT_SETTINGS: Settings = {
	startOfWeek: "1",
};

export class SettingTab extends PluginSettingTab {
	plugin: GotoDatePlugin;

	constructor(app: App, plugin: GotoDatePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("First day of week")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("0", "Sunday")
					.addOption("1", "Monday")
					.setValue(this.plugin.settings.startOfWeek)
					.onChange(async (value) => {
						this.plugin.settings.startOfWeek = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
