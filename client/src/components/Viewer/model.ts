export type State = {
    project?: string;
    dataset?: number;
};

export const initState = (): State => {
    return {
        project: undefined,
        dataset: undefined,
    };
};
