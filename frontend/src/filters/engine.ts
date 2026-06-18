// Pure filter engine: validate a token list, convert to RPN (shunting-yard),
// and evaluate predicates to per-cell boolean masks combined with AND/OR/NOT.
//
// No React, no I/O — fetching the per-cell columns is the caller's job
// (see useFilterMask). That keeps this fully unit-testable.

import {
  ColumnRequest,
  CompareOp,
  Predicate,
  ResolvedData,
  Token,
} from './types'

export interface ValidationResult {
  valid: boolean
  error?: string
}

// Operator precedence: NOT binds tightest, then AND, then OR.
const PRECEDENCE: Record<string, number> = { NOT: 3, AND: 2, OR: 1 }

/**
 * Validate the boolean grammar:
 *   expr   := term (('AND'|'OR') term)*
 *   term   := 'NOT'* factor
 *   factor := predicate | '(' expr ')'
 * An empty token list is valid (means "no filter").
 */
export function validateTokens(tokens: Token[]): ValidationResult {
  if (tokens.length === 0) return { valid: true }

  let expectOperand = true
  let depth = 0

  for (const t of tokens) {
    if (expectOperand) {
      switch (t.type) {
        case 'not':
        case 'lparen':
          if (t.type === 'lparen') depth++
          break // still expecting an operand
        case 'predicate':
          expectOperand = false
          break
        case 'op':
          return { valid: false, error: `Unexpected "${t.op}" — expected a condition.` }
        case 'rparen':
          return { valid: false, error: 'Unexpected ")".' }
      }
    } else {
      switch (t.type) {
        case 'op':
          expectOperand = true
          break
        case 'rparen':
          depth--
          if (depth < 0) return { valid: false, error: 'Unbalanced ")".' }
          break // a closed group acts as an operand
        case 'predicate':
        case 'lparen':
        case 'not':
          return { valid: false, error: 'Missing AND/OR between conditions.' }
      }
    }
  }

  if (expectOperand) return { valid: false, error: 'Filter is incomplete.' }
  if (depth !== 0) return { valid: false, error: 'Unbalanced "(".' }
  return { valid: true }
}

/**
 * What the grammar expects *after* the given token prefix — drives the chip
 * builder so it only ever lets the user insert a valid next token. `expectOperand`
 * true ⇒ a predicate / NOT / "(" may come next; false ⇒ AND/OR (or ")" when
 * `depth > 0`) must come next. `valid` is false once the prefix is malformed.
 */
export function builderState(tokens: Token[]): { expectOperand: boolean; depth: number; valid: boolean } {
  let expectOperand = true
  let depth = 0
  for (const t of tokens) {
    if (expectOperand) {
      if (t.type === 'lparen') depth++
      else if (t.type === 'predicate') expectOperand = false
      else if (t.type === 'not') { /* still operand */ }
      else return { expectOperand, depth, valid: false }
    } else {
      if (t.type === 'op') expectOperand = true
      else if (t.type === 'rparen') {
        depth--
        if (depth < 0) return { expectOperand, depth, valid: false }
      } else return { expectOperand, depth, valid: false }
    }
  }
  return { expectOperand, depth, valid: true }
}

export type RpnItem =
  | { kind: 'pred'; id: string }
  | { kind: 'op'; op: 'AND' | 'OR' | 'NOT' }

/** Shunting-yard. Assumes `tokens` already passed `validateTokens`. */
export function tokensToRpn(tokens: Token[]): RpnItem[] {
  const output: RpnItem[] = []
  const ops: string[] = [] // 'AND' | 'OR' | 'NOT' | '('

  for (const t of tokens) {
    switch (t.type) {
      case 'predicate':
        output.push({ kind: 'pred', id: t.id })
        break
      case 'not':
        // Unary, right-associative: only pop operators of *strictly higher*
        // precedence (there are none above NOT), so just push.
        ops.push('NOT')
        break
      case 'op': {
        const cur = PRECEDENCE[t.op]
        while (ops.length) {
          const top = ops[ops.length - 1]
          if (top === '(') break
          // AND/OR are left-associative: pop top when its precedence >= current.
          if (PRECEDENCE[top] >= cur) {
            ops.pop()
            output.push({ kind: 'op', op: top as 'AND' | 'OR' | 'NOT' })
          } else break
        }
        ops.push(t.op)
        break
      }
      case 'lparen':
        ops.push('(')
        break
      case 'rparen':
        while (ops.length && ops[ops.length - 1] !== '(') {
          output.push({ kind: 'op', op: ops.pop() as 'AND' | 'OR' | 'NOT' })
        }
        ops.pop() // discard the '('
        break
    }
  }
  while (ops.length) {
    const op = ops.pop() as string
    if (op !== '(') output.push({ kind: 'op', op: op as 'AND' | 'OR' | 'NOT' })
  }
  return output
}

function compare(v: number, op: CompareOp, value: number): boolean {
  switch (op) {
    case '>': return v > value
    case '>=': return v >= value
    case '<': return v < value
    case '<=': return v <= value
    case '==': return v === value
    case '!=': return v !== value
  }
}

/**
 * Build the per-cell mask for one predicate. Missing data (undefined column /
 * values / indices — e.g. a renamed gene) yields an all-zero mask (matches
 * nothing) so the filter degrades gracefully instead of throwing.
 */
export function buildPredicateMask(
  predicate: Predicate,
  data: ResolvedData,
  nCells: number,
): Uint8Array {
  const mask = new Uint8Array(nCells)

  if (predicate.kind === 'quant' && data.kind === 'quant') {
    const col = data.column
    if (!col) return mask
    const n = Math.min(nCells, col.length)
    for (let i = 0; i < n; i++) {
      const v = col[i]
      if (v === undefined || v === null || Number.isNaN(v)) continue
      if (compare(v, predicate.op, predicate.value)) mask[i] = 1
    }
    return mask
  }

  if (predicate.kind === 'categorical' && data.kind === 'categorical') {
    const values = data.values
    if (!values) return mask
    const set = new Set(predicate.categories)
    const wantIn = predicate.op === 'in'
    const n = Math.min(nCells, values.length)
    for (let i = 0; i < n; i++) {
      const v = values[i]
      // null is treated as a non-member: it fails `in`, passes `not in`.
      const isMember = v !== null && v !== undefined && set.has(v)
      if (isMember === wantIn) mask[i] = 1
    }
    return mask
  }

  if (predicate.kind === 'selection' && data.kind === 'selection') {
    const indices = data.indices
    if (!indices) return mask
    for (const idx of indices) {
      if (idx >= 0 && idx < nCells) mask[idx] = 1
    }
    return mask
  }

  return mask // kind/data mismatch ⇒ matches nothing
}

function notMask(a: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] ? 0 : 1
  return out
}
function andMask(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] && b[i] ? 1 : 0
  return out
}
function orMask(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] || b[i] ? 1 : 0
  return out
}

/** Evaluate RPN given a precomputed mask per predicate id. */
export function evaluateRpn(
  rpn: RpnItem[],
  masksById: Map<string, Uint8Array>,
  nCells: number,
): Uint8Array {
  const stack: Uint8Array[] = []
  for (const item of rpn) {
    if (item.kind === 'pred') {
      stack.push(masksById.get(item.id) ?? new Uint8Array(nCells))
    } else if (item.op === 'NOT') {
      const a = stack.pop() ?? new Uint8Array(nCells)
      stack.push(notMask(a))
    } else {
      const b = stack.pop() ?? new Uint8Array(nCells)
      const a = stack.pop() ?? new Uint8Array(nCells)
      stack.push(item.op === 'AND' ? andMask(a, b) : orMask(a, b))
    }
  }
  // A well-formed expression leaves exactly one mask on the stack.
  return stack.length === 1 ? stack[0] : new Uint8Array(nCells)
}

/**
 * High-level: validate → RPN → evaluate. Returns null for an empty/invalid
 * filter (caller treats null as "no filter ⇒ all cells visible").
 */
export function evaluateTokens(
  tokens: Token[],
  masksById: Map<string, Uint8Array>,
  nCells: number,
): Uint8Array | null {
  if (tokens.length === 0) return null
  if (!validateTokens(tokens).valid) return null
  return evaluateRpn(tokensToRpn(tokens), masksById, nCells)
}

/** The cache key + fetch descriptor for a predicate's per-cell data. */
export function requestForPredicate(p: Predicate): ColumnRequest {
  if (p.kind === 'quant') {
    const prefix = p.source === 'gene' ? 'gene' : 'metric'
    const layer = p.layer ? `${p.layer}:` : ''
    return { key: `${prefix}:${layer}${p.name}`, kind: p.source, name: p.name }
  }
  if (p.kind === 'categorical') {
    return { key: `cat:${p.feature}`, kind: 'categorical', name: p.feature }
  }
  return { key: `sel:${p.selectionId}`, kind: 'selection', name: p.selectionId }
}

/** Unique data requests for every predicate in the token list. */
export function collectColumnRequests(tokens: Token[]): ColumnRequest[] {
  const seen = new Map<string, ColumnRequest>()
  for (const t of tokens) {
    if (t.type !== 'predicate') continue
    const req = requestForPredicate(t.predicate)
    if (!seen.has(req.key)) seen.set(req.key, req)
  }
  return [...seen.values()]
}
