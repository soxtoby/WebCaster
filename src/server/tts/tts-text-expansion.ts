export function expandTextForTts(text: string) {
    let expanded = text
    for (let rule of textExpansionRules)
        expanded = expanded.replace(rule.pattern, (...matches) => rule.expand(...matches.slice(0, -2) as string[]))

    return expanded
}

type TextExpansionRule = {
    pattern: RegExp
    expand: (...matches: string[]) => string
}

let storageUnitWords: Record<string, string> = {
    kb: 'kilobytes',
    mb: 'megabytes',
    gb: 'gigabytes',
    tb: 'terabytes',
    pb: 'petabytes'
}

let monthWords: Record<string, string> = {
    jan: 'January',
    feb: 'February',
    mar: 'March',
    apr: 'April',
    jun: 'June',
    jul: 'July',
    aug: 'August',
    sep: 'September',
    sept: 'September',
    oct: 'October',
    nov: 'November',
    dec: 'December'
}

let moneyScaleWords: Record<string, string> = {
    k: 'thousand',
    m: 'million',
    b: 'billion',
    t: 'trillion'
}

let currencyWords: Record<string, string> = {
    $: 'dollar',
    '€': 'euro',
    '£': 'pound',
    usd: 'US dollar',
    aud: 'Australian dollar',
    ukp: 'British pound',
    gbp: 'British pound',
    eur: 'euro'
}

let shorthandWords: Record<string, string> = {
    'w/': 'with',
    'w/o': 'without',
    'b/c': 'because',
    yr: 'year',
    yrs: 'years',
    mo: 'month',
    mos: 'months',
    hr: 'hour',
    hrs: 'hours',
    min: 'minute',
    mins: 'minutes'
}

let currencySymbols = ['$', '€', '£']

let numberPattern = String.raw`[0-9][0-9,]*(?:\.[0-9]+)?`
let wordPattern = String.raw`[A-Za-z][A-Za-z-]*`
let slashPerTokenPattern = `${numberPattern}|${wordPattern}`
let commaNumberPattern = String.raw`[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?`
let dashChars = String.raw`-\u2010-\u2015`
let dashPattern = `[${dashChars}]`
let currencyCodePattern = Object.keys(currencyWords).filter(key => !currencySymbols.includes(key)).join('|')
let currencySymbolPattern = `[${currencySymbols.map(escapeRegex).join('')}]`
let currencyPattern = `${currencySymbolPattern}|\\b(?:${currencyCodePattern})`
let moneyScalePattern = `[${Object.keys(moneyScaleWords).join('')}]`
let moneyScaleWordPattern = Object.values(moneyScaleWords).join('|')
let storageUnitPattern = Object.keys(storageUnitWords).join('|')
let monthPattern = Object.keys(monthWords).map(capitalize).join('|')
let commonFractionPattern = new RegExp(`^${numberPattern}\\s*/\\s*(?:2|3|4|8|10)$`)
let romanNumeralPattern = /\b[MDCLXVI]+\b/g
let canonicalRomanNumeralPattern = /^M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/
let ambiguousRomanNumerals = new Set(['I', 'V', 'X', 'L', 'C', 'D', 'M', 'CD', 'XL', 'DC'])

let textExpansionRules: TextExpansionRule[] = [
    // Approximate number-like values: ~$1,100 -> around $1,100.
    {
        pattern: new RegExp(`~\\s*(?=(?:${currencyPattern})?\\s*[0-9])`, 'gi'),
        expand: () => 'around '
    },
    // Storage ranges: 10-20MB -> 10 to 20 megabytes.
    {
        pattern: new RegExp(`\\b(${numberPattern})\\s*${dashPattern}\\s*(${numberPattern})\\s*(${storageUnitPattern})(?=\\W|$)`, 'gi'),
        expand: (_match, start, end, unit) => `${normalizeAmount(start)} to ${normalizeAmount(end)} ${expandRangeUnit(unit)}`
    },
    // Numeric ranges: 10-20 -> 10 to 20.
    {
        pattern: new RegExp(`(^|[^\\d${dashChars}])(${numberPattern})\\s*${dashPattern}\\s*(${numberPattern})(?!\\s*${dashPattern}\\s*[0-9])(?!\\s*%)(?=\\W|$)`, 'g'),
        expand: (_match, leading, start, end) => `${leading}${normalizeAmount(start)} to ${normalizeAmount(end)}`
    },
    // Comma numbers: 1,100 -> 1100.
    {
        pattern: new RegExp(`\\b${commaNumberPattern}\\b`, 'g'),
        expand: match => normalizeAmount(match)
    },
    // Ordinal dates: 3rd Jan -> 3rd of January.
    {
        pattern: new RegExp(`\\b([0-9]{1,2})(st|nd|rd|th)\\s+(${monthPattern})\\.?(?=\\W|$)`, 'g'),
        expand: (_match, day, ordinal, month) => `${day}${ordinal} of ${monthWords[month.toLowerCase()] || month}`
    },
    // Month names: Sept. -> September.
    {
        pattern: new RegExp(`\\b(${monthPattern})\\.?(?=\\W|$)`, 'g'),
        expand: (_match, month) => monthWords[month.toLowerCase()] || month
    },
    // Roman numerals: XIV -> 14.
    {
        pattern: romanNumeralPattern,
        expand: match => shouldExpandRomanNumeral(match) ? String(romanToNumber(match)) : match
    },
    // Money before nouns: €3B budget -> 3 billion euro budget.
    {
        pattern: new RegExp(`(${currencyPattern})\\s*(${numberPattern})(${moneyScalePattern})(?:${dashPattern}|\\s+)([A-Za-z][A-Za-z-]*)`, 'gi'),
        expand: (_match, currency, amount, scale, noun) => expandCompoundMoney(currency, amount, scale, noun)
    },
    // Money scale words before nouns: $8 million budget -> 8 million dollar budget.
    {
        pattern: new RegExp(`(${currencyPattern})\\s*(${numberPattern})\\s+(${moneyScaleWordPattern})(?:${dashPattern}|\\s+)([A-Za-z][A-Za-z-]*)`, 'gi'),
        expand: (_match, currency, amount, scale, noun) => expandCompoundMoney(currency, amount, scale, noun)
    },
    // Scaled money: £5m -> 5 million pounds.
    {
        pattern: new RegExp(`(${currencyPattern})\\s*(${numberPattern})(${moneyScalePattern})\\b`, 'gi'),
        expand: (_match, currency, amount, scale) => expandMoney(currency, amount, scale)
    },
    // Money scale words: $8 million -> 8 million dollars.
    {
        pattern: new RegExp(`(${currencyPattern})\\s*(${numberPattern})\\s+(${moneyScaleWordPattern})\\b`, 'gi'),
        expand: (_match, currency, amount, scale) => expandMoney(currency, amount, scale)
    },
    // Money: $1,100 -> 1100 dollars.
    {
        pattern: new RegExp(`(${currencyPattern})\\s*(${numberPattern})(?![A-Za-z])\\b`, 'gi'),
        expand: (_match, currency, amount) => expandMoney(currency, amount)
    },
    // Storage units: 512kb -> 512 kilobytes.
    {
        pattern: new RegExp(`\\b(${numberPattern})\\s*(${storageUnitPattern})\\b`, 'gi'),
        expand: (_match, amount, unit) => `${normalizeAmount(amount)} ${storageUnitWords[unit.toLowerCase()]}`
    },
    // Phrase shorthand: w/o -> without.
    {
        pattern: /(^|\s)(w\/o|w\/|b\/c)(?=\s|$)/gi,
        expand: (_match, leading, shorthand) => `${leading}${shorthandWords[shorthand.toLowerCase()]}`
    },
    // Slash rates: 100/year -> 100 per year; users/year -> users per year.
    {
        pattern: new RegExp(`\\b(${slashPerTokenPattern})\\s*/\\s*(${slashPerTokenPattern})\\b`, 'g'),
        expand: (match, numerator, denominator) => isNumberLike(numerator) && isNumberLike(denominator)
            ? match
            : `${expandSlashToken(numerator)} per ${expandSlashToken(denominator)}`
    },
    // Number ratios: 1/1000 -> 1 in 1000.
    {
        pattern: new RegExp(`\\b(${numberPattern})\\s*/\\s*(${numberPattern})\\b`, 'g'),
        expand: (match, numerator, denominator) => commonFractionPattern.test(match) ? match : `${normalizeAmount(numerator)} in ${normalizeAmount(denominator)}`
    },
    // Duration shorthand: 2 yrs -> 2 years.
    {
        pattern: new RegExp(`\\b(${numberPattern})\\s+(yrs?|mos?|hrs?|mins?)\\b`, 'gi'),
        expand: (_match, amount, unit) => `${normalizeAmount(amount)} ${shorthandWords[unit.toLowerCase()]}`
    }
]

function expandRangeUnit(unit: string) {
    let normalized = unit.toLowerCase()
    return storageUnitWords[normalized] || normalized
}

function expandCompoundMoney(currency: string, amount: string, scale: string, noun: string) {
    return `${normalizeAmount(amount)} ${expandMoneyScale(scale)} ${currencyWords[currency.toLowerCase()]} ${noun.replaceAll('-', ' ')}`
}

function expandMoney(currency: string, amount: string, scale?: string) {
    let normalizedAmount = normalizeAmount(amount)
    let currencyWord = currencyWords[currency.toLowerCase()]
    if (scale)
        return `${normalizedAmount} ${expandMoneyScale(scale)} ${currencyWord}s`

    return `${normalizedAmount} ${currencyWord}s`
}

function normalizeAmount(amount: string) {
    return amount.replaceAll(',', '')
}

function expandMoneyScale(scale: string) {
    return moneyScaleWords[scale.toLowerCase()] || scale.toLowerCase()
}

function isNumberLike(value: string) {
    return new RegExp(`^${numberPattern}$`).test(value)
}

function expandSlashToken(value: string) {
    if (isNumberLike(value))
        return normalizeAmount(value)

    return value.replaceAll('-', ' ')
}

function shouldExpandRomanNumeral(value: string) {
    return canonicalRomanNumeralPattern.test(value) && !ambiguousRomanNumerals.has(value)
}

function romanToNumber(value: string) {
    let total = 0
    let previous = 0
    for (let index = value.length - 1; index >= 0; index -= 1) {
        let digit = value.charAt(index)
        let current = romanDigitValues[digit] || 0
        if (current < previous)
            total -= current
        else {
            total += current
            previous = current
        }
    }

    return total
}

let romanDigitValues: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000
}

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}
