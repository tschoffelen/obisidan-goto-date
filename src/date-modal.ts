import { FuzzyMatch, FuzzySuggestModal } from "obsidian";
import { startOfDay, addDays, format, startOfWeek, Day } from "date-fns";
import { Settings } from "./settings";
import GotoDatePlugin from "./main";
import { DateOption } from "./types";

export class DateModal extends FuzzySuggestModal<DateOption> {
	onSubmit: (result: DateOption) => void;
	settings: Settings;

	constructor(
		plugin: GotoDatePlugin,
		onSubmit: (result: DateOption) => void
	) {
		super(plugin.app);
		this.settings = plugin.settings;
		this.onSubmit = onSubmit;
		this.setTitle("Jump to date");
		this.setPlaceholder("Open daily note...");
	}

	getItems(): DateOption[] {
		const { startOfWeek: firstDay } = this.settings;
		const options = [
			{
				title: "Tomorrow",
				date: startOfDay(addDays(new Date(), 1)),
			},
			{
				title: "Next week",
				date: startOfWeek(addDays(new Date(), 7), {
					weekStartsOn: parseInt(firstDay) as Day,
				}),
			},
			{
				title: "Yesterday",
				date: startOfDay(addDays(new Date(), -1)),
			},
			{
				title: "Today",
				date: startOfDay(new Date()),
			},
		];

		for (let offset = 1; offset < 7; offset++) {
			const date = startOfDay(addDays(new Date(), offset));
			options.push({
				title: format(date, "EEEE"),
				date,
			});
		}

		return options;
	}

	getItemText(item: DateOption): string {
		return item.title + " " + item.date.toISOString().substring(0, 10);
	}

	onChooseItem(item: DateOption, evt: MouseEvent | KeyboardEvent): void {
		this.close();
		this.onSubmit(item);
	}

	renderSuggestion(item: FuzzyMatch<DateOption>, el: HTMLElement) {
		el.createEl("div", {
			text: item.item.title,
		}).setCssStyles({ fontWeight: "600" });
		el.createEl("small", {
			text: item.item.date.toISOString().substring(0, 10),
		});
	}
}

export const showDateModal: (plugin: GotoDatePlugin) => Promise<Date> = (
	plugin
) =>
	new Promise((resolve) =>
		new DateModal(plugin, ({ date }) => resolve(date)).open()
	);
