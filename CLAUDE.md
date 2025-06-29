# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension called "Devola" that enhances Amazon.co.jp wishlist pages by displaying point rewards for each item. The extension fetches product pages, parses point information, and injects it into the wishlist UI.

**IMPORTANT**: This extension only works with Amazon.co.jp, not Amazon.com or other Amazon domains.

## Development Commands

- `pnpm install` - Install dependencies (faster than yarn/npm)
- `pnpm build` - Build extension for production (outputs to `/dist`)
- `pnpm dev` - Build extension for development with optimizations disabled
- `pnpm watch` - Build in watch mode for development with hot reloading
- `pnpm clean` - Remove the `/dist` directory
- `pnpm type-check` - Run TypeScript type checking without compilation

**Note**: This project uses pnpm for faster installs and better disk space efficiency.

## Architecture

### Core Files
- `src/index.ts` - Entry point that detects wishlist pages and triggers processing
- `src/wishlist.ts` - Main logic for scanning wishlist items and injecting point data
- `src/util.ts` - Utility functions for fetching and parsing point information from product pages

### Key Components

**Content Script Flow**:
1. `index.ts` detects if current page is a wishlist page
2. `doWishlist()` finds all product items in the wishlist
3. For each item, `editItem()` extracts the product URL
4. `fetchPoints()` makes HTTP request to product page
5. `parsePoints()` uses DOM selectors to extract point information
6. Point data is injected into the wishlist item's price section

**Point Parsing Strategy**:
The extension uses multiple CSS selectors to handle different product types:
- Normal items: `#addToCart #pointsInsideBuyBox_feature_div span.a-color-price`
- Kindle items: `.loyalty-points .a-align-bottom`, `.ebooks-aip-points-label .a-color-price`

**Dynamic Content Handling**:
Uses MutationObserver to detect when new wishlist items are dynamically added to the page.

## Build System

- Uses Webpack 5 with TypeScript compilation
- CopyWebpackPlugin copies `public/` folder contents to `dist/`
- Manifest v3 Chrome extension format (compatible until 2025+)
- Target: ES2022 with modern TypeScript configuration
- Development mode includes source maps and faster compilation
- Production mode includes minification and optimization

## Extension Structure

- `public/manifest.json` - Chrome extension manifest with content script configuration
- `public/_locales/` - Internationalization files (Japanese/English)
- `public/images/` - Extension icons
- Content script runs on Amazon.co.jp wishlist pages only