/**
 * This module is intended to pull functionality out of the Compare page,
 * test it, and hopefully simplify or remove it
 */

import * as R from 'ramda';

type Annotation = { [_: string]: Array<string> };

type CrossAnnotations = {
    horizontal: Array<Annotation>;
    vertical: Array<Annotation>;
    both: Array<Annotation>;
    one: Array<Annotation>;
};

/**
 * Makes the values in each key of axis unique.
 */
const selectAnnotations = (axis: Annotation): Annotation => {
    const keys: string[] = R.keys(axis) as string[];
    return R.fromPairs(keys.map((key) => [key, [...new Set(axis[key])]]));
};

const mergeAnnotations = (mine: Annotation, yours: Annotation): Annotation => {
    return R.mergeWith((l, r) => [...new Set([...l, ...r])], mine, yours);
};

const getCrossAnnotations = (
    cross: CrossAnnotations,
    i: number,
    j: number
): Annotation => {
    return mergeAnnotations(
        selectAnnotations(cross['horizontal'][j]),
        selectAnnotations(cross['vertical'][i])
    );
};

const getCrossAnnotationsOld = (
    cross: CrossAnnotations,
    i: number,
    j: number
) => {
    const annotations = {};
    if (cross['horizontal'][j]) {
        Object.keys(cross['horizontal'][j]).forEach((a) => {
            annotations[a] = annotations[a] || [];
            cross['horizontal'][j][a].forEach((v) => {
                if (annotations[a].indexOf(v) === -1) {
                    annotations[a].push(v);
                }
            });
        });
    }
    if (cross['vertical'][i]) {
        Object.keys(cross['vertical'][i]).forEach((a) => {
            annotations[a] = annotations[a] || [];
            cross['vertical'][i][a].forEach((v) => {
                if (annotations[a].indexOf(v) === -1) {
                    annotations[a].push(v);
                }
            });
        });
    }
    return annotations;
};

const getSelectedAnnotations = (cross: CrossAnnotations): Annotation => {
    const allAnnotations = R.flatten(R.values(cross)).map(selectAnnotations);
    return R.reduce(mergeAnnotations, {}, allAnnotations);
};

const getSelectedAnnotationsOld = (annotations: CrossAnnotations) => {
    const selectedAnnotations = {};
    Object.keys(annotations).forEach((orientation) => {
        annotations[orientation].forEach((annotation) => {
            Object.keys(annotation).forEach((a) => {
                selectedAnnotations[a] = selectedAnnotations[a] || [];
                annotation[a].forEach((v) => {
                    if (selectedAnnotations[a].indexOf(v) === -1) {
                        selectedAnnotations[a].push(v);
                    }
                });
            });
        });
    });
    return selectedAnnotations;
};

export {
    Annotation,
    CrossAnnotations,
    getCrossAnnotations,
    getCrossAnnotationsOld,
    getSelectedAnnotations,
    getSelectedAnnotationsOld,
    selectAnnotations,
    mergeAnnotations,
};
