// Types for the viewer's combinatorial cell filter.
//
// A filter is a flat, JSON-serializable list of `Token`s built in the chip bar
// (predicate chips interleaved with AND/OR/NOT/parens). The engine parses the
// token list into RPN and evaluates each predicate to a per-cell boolean mask.

export type CompareOp = '>' | '>=' | '<' | '<=' | '==' | '!='
export type SetOp = 'in' | 'not in'

/** A numeric threshold on a per-cell quantitative column (gene or metric). */
export interface QuantPredicate {
  kind: 'quant'
  /** Where the column comes from. `layer` is reserved for future multiomic. */
  source: 'gene' | 'metric'
  layer?: string
  name: string
  op: CompareOp
  value: number
}

/** Membership (or not) of a categorical feature's value in a set of labels. */
export interface CategoricalPredicate {
  kind: 'categorical'
  feature: string
  op: SetOp
  categories: string[]
}

/** Cells belonging to an existing lasso selection (by id). */
export interface SelectionPredicate {
  kind: 'selection'
  selectionId: string
  /** Display label captured at build time (selection may be renamed/removed). */
  label?: string
}

export type Predicate = QuantPredicate | CategoricalPredicate | SelectionPredicate

interface TokenBase {
  /** Stable id for React keys + chip editing/removal. */
  id: string
}

export type Token =
  | (TokenBase & { type: 'predicate'; predicate: Predicate })
  | (TokenBase & { type: 'op'; op: 'AND' | 'OR' })
  | (TokenBase & { type: 'not' })
  | (TokenBase & { type: 'lparen' })
  | (TokenBase & { type: 'rparen' })

/** What a predicate needs fetched to be evaluated. */
export interface ColumnRequest {
  /** Cache key, e.g. `gene:CD8A`, `metric:n_genes`, `cat:celltype`, `sel:<id>`. */
  key: string
  kind: 'gene' | 'metric' | 'categorical' | 'selection'
  /** Gene/metric/feature name, or selection id. */
  name: string
}

/** Resolved per-predicate data handed to `buildPredicateMask`. */
export type ResolvedData =
  | { kind: 'quant'; column: ArrayLike<number> | undefined }
  | { kind: 'categorical'; values: (string | null)[] | undefined }
  | { kind: 'selection'; indices: number[] | undefined }
