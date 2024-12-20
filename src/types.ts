export interface DateOption {
	title: string;
	date: Date;
}

export type FileOption = {
	isCreateNewOption?: boolean;
	query?: string;
	fileName: string;
	filePath: string;
	alias?: string;
	value?: string;
    date?: Date;
};
