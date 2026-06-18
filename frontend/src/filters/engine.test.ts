import { describe, it, expect } from 'vitest'
import {
  validateTokens,
  buildPredicateMask,
  evaluateTokens,
  collectColumnRequests,
} from './engine'
import { Predicate, Token } from './types'

let counter = 0
const nextId = () => `t${counter++}`

function pred(predicate: Predicate): Token {
  return { id: nextId(), type: 'predicate', predicate }
}
const AND = (): Token => ({ id: nextId(), type: 'op', op: 'AND' })
const OR = (): Token => ({ id: nextId(), type: 'op', op: 'OR' })
const NOT = (): Token => ({ id: nextId(), type: 'not' })
const LP = (): Token => ({ id: nextId(), type: 'lparen' })
const RP = (): Token => ({ id: nextId(), type: 'rparen' })

// A throwaway predicate (its mask is supplied directly in boolean-logic tests).
const dummy = (): Predicate => ({ kind: 'selection', selectionId: nextId() })

describe('validateTokens', () => {
  it('accepts an empty list (no filter)', () => {
    expect(validateTokens([]).valid).toBe(true)
  })

  it('accepts a well-formed boolean expression', () => {
    const tokens = [
      LP(), pred(dummy()), OR(), pred(dummy()), RP(),
      AND(), NOT(), pred(dummy()),
    ]
    expect(validateTokens(tokens).valid).toBe(true)
  })

  it('rejects leading operator, adjacent predicates, trailing AND/NOT, and unbalanced parens', () => {
    expect(validateTokens([AND(), pred(dummy())]).valid).toBe(false)
    expect(validateTokens([pred(dummy()), pred(dummy())]).valid).toBe(false)
    expect(validateTokens([pred(dummy()), AND()]).valid).toBe(false)
    expect(validateTokens([pred(dummy()), AND(), NOT()]).valid).toBe(false)
    expect(validateTokens([LP(), pred(dummy())]).valid).toBe(false)
    expect(validateTokens([pred(dummy()), RP()]).valid).toBe(false)
  })
})

describe('buildPredicateMask', () => {
  it('thresholds a quantitative column and skips NaN', () => {
    const p: Predicate = { kind: 'quant', source: 'gene', name: 'CD8A', op: '>', value: 2 }
    const col = [0, 2, 3, NaN, 10]
    expect(Array.from(buildPredicateMask(p, { kind: 'quant', column: col }, 5)))
      .toEqual([0, 0, 1, 0, 1])
  })

  it('supports == and != exactly', () => {
    const col = [0, 1, 2, 2]
    const eq: Predicate = { kind: 'quant', source: 'metric', name: 'cluster', op: '==', value: 2 }
    const ne: Predicate = { kind: 'quant', source: 'metric', name: 'cluster', op: '!=', value: 2 }
    expect(Array.from(buildPredicateMask(eq, { kind: 'quant', column: col }, 4))).toEqual([0, 0, 1, 1])
    expect(Array.from(buildPredicateMask(ne, { kind: 'quant', column: col }, 4))).toEqual([1, 1, 0, 0])
  })

  it('does categorical in / not-in with null = non-member', () => {
    const values = ['T', 'B', null, 'NK']
    const inP: Predicate = { kind: 'categorical', feature: 'ct', op: 'in', categories: ['T', 'NK'] }
    const notP: Predicate = { kind: 'categorical', feature: 'ct', op: 'not in', categories: ['T', 'NK'] }
    expect(Array.from(buildPredicateMask(inP, { kind: 'categorical', values }, 4))).toEqual([1, 0, 0, 1])
    // null passes "not in"
    expect(Array.from(buildPredicateMask(notP, { kind: 'categorical', values }, 4))).toEqual([0, 1, 1, 0])
  })

  it('builds a selection mask from indices', () => {
    const p: Predicate = { kind: 'selection', selectionId: 's1' }
    expect(Array.from(buildPredicateMask(p, { kind: 'selection', indices: [0, 3] }, 4)))
      .toEqual([1, 0, 0, 1])
  })

  it('returns an all-zero mask when the column is missing', () => {
    const p: Predicate = { kind: 'quant', source: 'gene', name: 'GONE', op: '>', value: 0 }
    expect(Array.from(buildPredicateMask(p, { kind: 'quant', column: undefined }, 3))).toEqual([0, 0, 0])
  })
})

describe('evaluateTokens (boolean logic)', () => {
  const N = 4
  // Fixed masks so we can assert combinations precisely.
  const setup = () => {
    const a = pred(dummy())
    const b = pred(dummy())
    const c = pred(dummy())
    const masks = new Map<string, Uint8Array>([
      [a.id, Uint8Array.from([1, 1, 0, 0])],
      [b.id, Uint8Array.from([1, 0, 1, 0])],
      [c.id, Uint8Array.from([1, 0, 0, 1])],
    ])
    return { a, b, c, masks }
  }

  it('binds AND tighter than OR', () => {
    const { a, b, c, masks } = setup()
    // a OR b AND c  ==  a OR (b AND c)
    const out = evaluateTokens([a, OR(), b, AND(), c], masks, N)
    expect(Array.from(out!)).toEqual([1, 1, 0, 0])
  })

  it('honors explicit grouping over precedence', () => {
    const { a, b, c, masks } = setup()
    // (a OR b) AND c
    const out = evaluateTokens([LP(), a, OR(), b, RP(), AND(), c], masks, N)
    expect(Array.from(out!)).toEqual([1, 0, 0, 0])
  })

  it('applies NOT before AND', () => {
    const { a, b, masks } = setup()
    // NOT a AND b  ==  (NOT a) AND b
    const out = evaluateTokens([NOT(), a, AND(), b], masks, N)
    expect(Array.from(out!)).toEqual([0, 0, 1, 0])
  })

  it('negates a whole group', () => {
    const { a, b, masks } = setup()
    // NOT (a AND b)
    const out = evaluateTokens([NOT(), LP(), a, AND(), b, RP()], masks, N)
    expect(Array.from(out!)).toEqual([0, 1, 1, 1])
  })

  it('returns null for empty or invalid filters', () => {
    expect(evaluateTokens([], new Map(), N)).toBeNull()
    expect(evaluateTokens([AND(), pred(dummy())], new Map(), N)).toBeNull()
  })
})

describe('collectColumnRequests', () => {
  it('dedupes requests and keys them by kind+name', () => {
    const tokens = [
      pred({ kind: 'quant', source: 'gene', name: 'CD8A', op: '>', value: 2 }),
      AND(),
      pred({ kind: 'quant', source: 'gene', name: 'CD8A', op: '<', value: 9 }), // same gene → 1 request
      AND(),
      pred({ kind: 'categorical', feature: 'celltype', op: 'in', categories: ['T'] }),
    ]
    const reqs = collectColumnRequests(tokens)
    expect(reqs.map((r) => r.key).sort()).toEqual(['cat:celltype', 'gene:CD8A'])
  })
})
