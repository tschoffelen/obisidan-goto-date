import { SuggestModal } from "obsidian";
import { startOfDay, addDays, format, startOfWeek, Day } from "date-fns";
import { Settings } from "./settings";
import GotoDatePlugin from "./main";
import { DateOption } from "./types";
import * as chrono from "chrono-node";

export class DateModal extends SuggestModal<DateOption> {
	onSubmit: (result: DateOption) => void;
	settings: Settings;
	defaultItems: DateOption[];

	constructor(
		plugin: GotoDatePlugin,
		onSubmit: (result: DateOption) => void
	) {
		super(plugin.app);
		this.settings = plugin.settings;
		this.onSubmit = onSubmit;
		this.setTitle("Jump to date");
		this.setPlaceholder("Open daily note...");

		this.defaultItems = this.getDefaultItems();
	}

	getDefaultItems(): DateOption[] {
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

	getSuggestions(query: string): DateOption[] | Promise<DateOption[]> {
		const parsed = chrono.en.GB.parseDate(query);
		if (parsed) {
			const date = startOfDay(parsed);
			return [
				{
					title: format(date, "EEEE"),
					date,
				},
			];
		}

		if (!query.trim().length) {
			return this.defaultItems;
		}

		return this.defaultItems.filter((item) => {
			return this.getItemText(item).includes(query.toLowerCase());
		});
	}

	getItemText(item: DateOption): string {
		return (
			item.title +
			" " +
			item.date.toISOString().substring(0, 10)
		).toLowerCase();
	}

	onChooseSuggestion(
		item: DateOption,
		evt: MouseEvent | KeyboardEvent
	): void {
		this.close();
		this.onSubmit(item);
	}

	renderSuggestion(item: DateOption, el: HTMLElement) {
		el.createEl("div", {
			text: item.title,
		}).setCssStyles({ fontWeight: "600" });
		el.createEl("small", {
			text: item.date.toISOString().substring(0, 10),
		});
	}
}

export const showDateModal: (plugin: GotoDatePlugin) => Promise<Date> = (
	plugin
) =>
	new Promise((resolve) =>
		new DateModal(plugin, ({ date }) => resolve(date)).open()
	);
