# Usage Examples

## Basic Krautrock Export
Export all Krautrock vinyl from the marketplace:
```bash
npm run export:style -- --style Krautrock --genre Rock --format Vinyl
```

## Filter by Seller Country
Get Krautrock vinyl from US sellers only:
```bash
npm run export:style -- --style Krautrock --genre Rock --format Vinyl --from "United States"
```

## 1970s Releases Only
Export Krautrock from the 1970s:
```bash
npm run export:style -- --style Krautrock --genre Rock --format Vinyl --minYear 1970 --maxYear 1979
```

## Custom Output Path
Specify a custom CSV filename:
```bash
npm run export:style -- --style Krautrock --output krautrock_1970s.csv --minYear 1970 --maxYear 1979
```

## Other Styles

### Ambient Music
```bash
npm run export:style -- --style Ambient --format Vinyl
```

### Jazz-Funk
```bash
npm run export:style -- --style "Jazz-Funk" --genre Jazz --format Vinyl
```

### Death Metal from Europe
```bash
npm run export:style -- --style "Death Metal" --genre Metal --format Vinyl --from Germany
```

### Synthwave (any format)
```bash
npm run export:style -- --style Synthwave --genre Electronic
```

## Advanced Options

### Faster Scraping (shorter delay)
```bash
npm run export:style -- --style Krautrock --delayMs 500
```
*Note: Use responsibly! Too fast may get you rate-limited.*

### Specific Currency
```bash
npm run export:style -- --style Krautrock --currency USD
```

### Combining Filters
```bash
npm run export:style -- \
  --style "Progressive Rock" \
  --genre Rock \
  --format Vinyl \
  --from "United Kingdom" \
  --minYear 1970 \
  --maxYear 1975 \
  --currency GBP \
  --output prog_rock_uk_70s.csv
```

## Popular Styles to Try

- Krautrock
- Ambient
- Jazz-Funk
- Disco
- House
- Techno
- Drum n Bass
- Death Metal
- Black Metal
- Shoegaze
- Post-Punk
- Synthwave
- Vaporwave
- Bossa Nova
- Afrobeat
